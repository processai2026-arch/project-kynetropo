/**
 * GST Invoicing / Invoices API — live backend.
 * Endpoints:
 *   GET    /admin/invoices
 *   GET    /admin/invoices/{id}
 *   POST   /admin/invoices/gst    — standalone GST invoice with line items
 *   PUT    /admin/invoices/{id}
 *   DELETE /admin/invoices/{id}
 *   GET    /admin/invoices/{id}/download
 *   GET/POST /admin/invoices/recurring
 *   PUT    /admin/invoices/recurring/{id}
 *   POST   /admin/invoices/recurring/generate-due
 *   POST   /admin/invoices/{id}/reminders
 *   POST   /admin/gst-compliance/invoices/{id}/irn
 */
import { apiFetch } from "./client";

export type InvoiceStatus = "Draft" | "Sent" | "Paid" | "Overdue" | "Cancelled";

export interface InvoiceLine {
  id: string;
  description: string;
  hsn: string;
  qty: number;
  unitPrice: number;
  gstRate: number;
}

export interface Invoice {
  id: string;
  date: string;
  dueDate: string;
  customer: { name: string; gstin?: string; state: string; address: string };
  sellerState: string;
  lines: InvoiceLine[];
  notes?: string;
  /** Free-text terms & conditions, persisted on the invoice record (one line = one term). */
  termsAndConditions?: string;
  status: InvoiceStatus;
  /** Server-cached totals — present on list rows; absent inside the create/edit form */
  _cached?: InvoiceTotals;
}

export interface InvoiceTotals {
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  grandTotal: number;
  isInterState: boolean;
}

export const GST_RATES = [0, 5, 12, 18, 28] as const;

const round2 = (n: number) => Math.round(n * 100) / 100;

export function calcInvoiceTotals(
  inv: Pick<Invoice, "lines" | "customer" | "sellerState"> & { _cached?: InvoiceTotals }
): InvoiceTotals {
  // Use server-cached amounts when lines haven't been loaded yet (list view)
  if (inv.lines.length === 0 && inv._cached) return inv._cached;

  const isInterState = inv.customer.state.trim().toLowerCase() !== inv.sellerState.trim().toLowerCase();
  let subtotal = 0, cgst = 0, sgst = 0, igst = 0;
  for (const l of inv.lines) {
    const lineSub = l.qty * l.unitPrice;
    const tax = (lineSub * l.gstRate) / 100;
    subtotal += lineSub;
    if (isInterState) igst += tax;
    else { cgst += tax / 2; sgst += tax / 2; }
  }
  const totalTax = cgst + sgst + igst;
  return {
    subtotal: round2(subtotal), cgst: round2(cgst), sgst: round2(sgst),
    igst: round2(igst), totalTax: round2(totalTax),
    grandTotal: round2(subtotal + totalTax), isInterState,
  };
}

// ── API row shapes ─────────────────────────────────────────────────────────
interface ApiInvoiceRow {
  invoice_id: number;
  invoice_number: string;
  order_id: number | null;
  customer_name: string | null;
  customer_gstin: string | null;
  customer_state: string | null;
  customer_address: string | null;
  seller_state: string | null;
  due_date: string | null;
  subtotal: number;
  gst_rate: number;
  gst_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  delivery_fee: number;
  total: number;
  status: string;
  payment_method: string | null;
  notes: string | null;
  terms_and_conditions?: string | null;
  created_at: string;
  order_customer_name?: string | null;
  order_customer_gstin?: string | null;
  items?: ApiInvoiceItem[];
}

interface ApiInvoiceItem {
  item_id: number;
  description: string;
  hsn_code: string | null;
  quantity: number;
  unit_price: number;
  gst_rate: number;
  line_total: number;
  sort_order: number;
}

interface Paginated<T> { success: boolean; data: T[] }
interface Envelope<T>  { success: boolean; data: T }

function normalizeStatus(raw: string): InvoiceStatus {
  const s = (raw || "").toLowerCase();
  if (s === "paid") return "Paid";
  if (s === "sent") return "Sent";
  if (s === "overdue") return "Overdue";
  if (s === "cancelled") return "Cancelled";
  if (s === "unpaid" || s === "draft") return "Draft";
  // Already title-cased
  const v = (raw as InvoiceStatus);
  return ["Draft", "Sent", "Paid", "Overdue", "Cancelled"].includes(v) ? v : "Draft";
}

function rowToInvoice(row: ApiInvoiceRow): Invoice {
  const items = row.items ?? [];
  const cgst  = round2(row.cgst_amount || 0);
  const sgst  = round2(row.sgst_amount || 0);
  const igst  = round2(row.igst_amount || 0);
  const storedTax = round2(cgst + sgst + igst) || round2(row.gst_amount || 0);
  return {
    id: row.invoice_number,
    date: (row.created_at || "").slice(0, 10),
    dueDate: (row.due_date || "").slice(0, 10) || (row.created_at || "").slice(0, 10),
    sellerState: row.seller_state || "Tamil Nadu",
    customer: {
      name: row.customer_name || row.order_customer_name || "",
      gstin: row.customer_gstin || row.order_customer_gstin || "",
      state: row.customer_state || "Tamil Nadu",
      address: row.customer_address || "",
    },
    lines: items.map((i) => ({
      id: String(i.item_id),
      description: i.description,
      hsn: i.hsn_code || "",
      qty: Number(i.quantity) || 0,
      unitPrice: Number(i.unit_price) || 0,
      gstRate: Number(i.gst_rate) || 0,
    })),
    notes: row.notes ?? "",
    termsAndConditions: row.terms_and_conditions ?? "",
    status: normalizeStatus(row.status),
    _cached: {
      subtotal:     round2(row.subtotal || 0),
      cgst, sgst, igst,
      totalTax:     storedTax,
      grandTotal:   round2(row.total || 0),
      isInterState: igst > 0,
    },
  };
}

async function numericId(invoiceNumber: string): Promise<number> {
  const res = await apiFetch<Paginated<ApiInvoiceRow>>(`/admin/invoices?limit=200`);
  const row = res.data.find((r) => r.invoice_number === invoiceNumber);
  if (!row) throw new Error(`Invoice ${invoiceNumber} not found`);
  return row.invoice_id;
}

export const invoicesApi = {
  async list(): Promise<Invoice[]> {
    // Fetch list first (no line items), then hydrate each with /show.
    const res = await apiFetch<Paginated<ApiInvoiceRow>>(`/admin/invoices?limit=200`);
    const rows = res.data ?? [];
    // For the list we return without line items (faster). Pages that need items call get(id).
    return rows.map(rowToInvoice);
  },

  async get(invoiceNumber: string): Promise<Invoice> {
    const id  = await numericId(invoiceNumber);
    const res = await apiFetch<Envelope<ApiInvoiceRow>>(`/admin/invoices/${id}`);
    return rowToInvoice(res.data);
  },

  async create(data: Omit<Invoice, "id">): Promise<Invoice> {
    const body = {
      customer_name:    data.customer.name,
      customer_gstin:   data.customer.gstin || "",
      customer_state:   data.customer.state,
      customer_address: data.customer.address,
      seller_state:     data.sellerState,
      due_date:         data.dueDate,
      notes:            data.notes || "",
      terms_and_conditions: data.termsAndConditions || "",
      status:           data.status,
      items: data.lines.map((l) => ({
        description: l.description,
        hsn_code:    l.hsn,
        quantity:    l.qty,
        unit_price:  l.unitPrice,
        gst_rate:    l.gstRate,
      })),
    };
    const res = await apiFetch<Envelope<ApiInvoiceRow>>("/admin/invoices/gst", {
      method: "POST",
      body: JSON.stringify(body),
    });
    // Backend returns row without items; fetch via show to hydrate
    return this.get(res.data.invoice_number);
  },

  async update(invoiceNumber: string, patch: Partial<Invoice>): Promise<Invoice> {
    const id = await numericId(invoiceNumber);
    const body: Record<string, unknown> = {};
    if (patch.status)              body.status          = patch.status;
    if (patch.notes !== undefined) body.notes           = patch.notes;
    if (patch.termsAndConditions !== undefined) body.terms_and_conditions = patch.termsAndConditions;
    if (patch.dueDate)             body.due_date        = patch.dueDate;
    if (patch.sellerState)         body.seller_state    = patch.sellerState;
    if (patch.customer) {
      if (patch.customer.name !== undefined)    body.customer_name    = patch.customer.name;
      if (patch.customer.gstin !== undefined)   body.customer_gstin   = patch.customer.gstin;
      if (patch.customer.state !== undefined)   body.customer_state   = patch.customer.state;
      if (patch.customer.address !== undefined) body.customer_address = patch.customer.address;
    }
    if (patch.lines && patch.lines.length > 0) {
      body.items = patch.lines.map((l) => ({
        description: l.description,
        hsn_code:    l.hsn,
        quantity:    l.qty,
        unit_price:  l.unitPrice,
        gst_rate:    l.gstRate,
      }));
    }
    await apiFetch<Envelope<ApiInvoiceRow>>(`/admin/invoices/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    return this.get(invoiceNumber);
  },

  async remove(invoiceNumber: string): Promise<void> {
    const id = await numericId(invoiceNumber);
    await apiFetch<void>(`/admin/invoices/${id}`, { method: "DELETE" });
  },
};

// ── Recurring invoices, reminders, and e-invoice IRN ──────────────────────

export type RecurringFrequency = "weekly" | "monthly" | "quarterly";

export interface RecurringInvoiceItem {
  item_id?: number;
  description: string;
  hsn_code?: string | null;
  quantity: number;
  unit?: string | null;
  unit_price: number;
  gst_rate: number;
  sort_order?: number;
}

export interface RecurringInvoiceTemplate {
  template_id: number;
  template_name: string;
  customer_name: string;
  customer_email: string | null;
  customer_gstin: string | null;
  customer_state: string;
  customer_address: string | null;
  seller_state: string;
  frequency: RecurringFrequency;
  next_run_date: string;
  due_days: number;
  delivery_fee: number;
  discount: number;
  notes: string | null;
  terms_and_conditions: string | null;
  active: boolean;
  generated_count?: number;
  items: RecurringInvoiceItem[];
}

export interface CreateRecurringInvoiceInput {
  template_name: string;
  customer_name: string;
  customer_email?: string;
  customer_gstin?: string;
  customer_state: string;
  customer_address?: string;
  seller_state: string;
  frequency: RecurringFrequency;
  next_run_date: string;
  due_days?: number;
  delivery_fee?: number;
  discount?: number;
  notes?: string;
  terms_and_conditions?: string;
  active?: boolean;
  items: RecurringInvoiceItem[];
}

export const recurringInvoicesApi = {
  async list(): Promise<RecurringInvoiceTemplate[]> {
    const res = await apiFetch<Envelope<RecurringInvoiceTemplate[]>>("/admin/invoices/recurring");
    return res.data ?? [];
  },

  async create(input: CreateRecurringInvoiceInput): Promise<RecurringInvoiceTemplate> {
    const res = await apiFetch<Envelope<RecurringInvoiceTemplate>>("/admin/invoices/recurring", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return res.data;
  },

  async update(id: number, patch: Partial<CreateRecurringInvoiceInput>): Promise<RecurringInvoiceTemplate> {
    const res = await apiFetch<Envelope<RecurringInvoiceTemplate>>(`/admin/invoices/recurring/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    });
    return res.data;
  },

  async generateDue(throughDate?: string): Promise<{
    generated_count: number;
    failed_count: number;
    invoices: ApiInvoiceRow[];
    failures: Array<{ template_id: number; scheduled_for: string; error: string }>;
  }> {
    const res = await apiFetch<Envelope<{
      generated_count: number;
      failed_count: number;
      invoices: ApiInvoiceRow[];
      failures: Array<{ template_id: number; scheduled_for: string; error: string }>;
    }>>("/admin/invoices/recurring/generate-due", {
      method: "POST",
      body: JSON.stringify({ through_date: throughDate }),
    });
    return res.data;
  },
};

export const paymentRemindersApi = {
  async send(invoiceId: number, input: { email?: string; subject?: string; message?: string }) {
    const res = await apiFetch<Envelope<{ invoice_id: number; recipient_email: string; sent_at: string }>>(
      `/admin/invoices/${invoiceId}/reminders`,
      { method: "POST", body: JSON.stringify(input) },
    );
    return res.data;
  },
};

export interface InvoiceIrnResult {
  invoice_id: number;
  invoice_number: string;
  irn: string;
  irn_qr: string | null;
  irn_status: "not_generated" | "placeholder" | "provided" | "generated" | "failed";
}

export const eInvoiceApi = {
  async generateIrn(invoiceId: number, input: { irn?: string; irn_qr?: string; force?: boolean } = {}): Promise<InvoiceIrnResult> {
    const res = await apiFetch<Envelope<InvoiceIrnResult>>(`/admin/gst-compliance/invoices/${invoiceId}/irn`, {
      method: "POST",
      body: JSON.stringify(input),
    });
    return res.data;
  },
};

// ── Credit notes ─────────────────────────────────────────────────────────
// A credit note corrects/reduces a previously issued invoice (return, pricing
// error, goodwill adjustment). Linked to exactly one invoice via invoice_id.
// Endpoints: GET/POST /admin/credit-notes, GET/PUT/DELETE /admin/credit-notes/{id}

export type CreditNoteStatus = "Draft" | "Issued" | "Cancelled";

export interface CreditNoteLine {
  item_id?: number;
  description: string;
  hsn_code?: string;
  quantity: number;
  unit?: string;
  unit_price: number;
  gst_rate: number;
  line_total?: number;
}

export interface CreditNoteRow {
  credit_note_id: number;
  credit_note_number: string;
  invoice_id: number;
  invoice_number?: string | null;
  customer_name?: string | null;
  credit_note_date: string;
  reason: string | null;
  notes: string | null;
  subtotal: number;
  gst_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total: number;
  status: CreditNoteStatus;
  created_at: string;
  item_count?: number;
  items?: CreditNoteLine[];
}

export interface CreateCreditNoteInput {
  invoice_id: number;
  credit_note_date?: string;
  reason?: string;
  notes?: string;
  status?: CreditNoteStatus;
  /** Either provide line items (preferred — GST recalculated per line)… */
  items?: Array<{
    description: string;
    hsn_code?: string;
    quantity: number;
    unit?: string;
    unit_price: number;
    gst_rate?: number;
  }>;
  /** …or a flat amount (no line items) — gst_rate applied to the whole amount. */
  amount?: number;
  gst_rate?: number;
}

interface CreditNoteEnvelope { success: boolean; data: CreditNoteRow }
interface CreditNotePaginated { success: boolean; data: CreditNoteRow[] }

export const creditNotesApi = {
  async list(invoiceId?: number): Promise<CreditNoteRow[]> {
    const qs = invoiceId ? `?invoice_id=${invoiceId}&limit=200` : "?limit=200";
    const res = await apiFetch<CreditNotePaginated>(`/admin/credit-notes${qs}`);
    return res.data ?? [];
  },

  async get(id: number): Promise<CreditNoteRow> {
    const res = await apiFetch<CreditNoteEnvelope>(`/admin/credit-notes/${id}`);
    return res.data;
  },

  async create(input: CreateCreditNoteInput): Promise<CreditNoteRow> {
    const res = await apiFetch<CreditNoteEnvelope>("/admin/credit-notes", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return res.data;
  },

  async update(id: number, patch: Partial<Pick<CreditNoteRow, "credit_note_date" | "reason" | "notes" | "status">>): Promise<CreditNoteRow> {
    const res = await apiFetch<CreditNoteEnvelope>(`/admin/credit-notes/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    });
    return res.data;
  },

  /** Finalizes a Draft credit note so it reduces the linked invoice's balance due. */
  async issue(id: number): Promise<CreditNoteRow> {
    return this.update(id, { status: "Issued" });
  },

  async cancel(id: number): Promise<CreditNoteRow> {
    return this.update(id, { status: "Cancelled" });
  },

  async remove(id: number): Promise<void> {
    await apiFetch<void>(`/admin/credit-notes/${id}`, { method: "DELETE" });
  },
};
