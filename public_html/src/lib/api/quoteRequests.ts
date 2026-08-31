/**
 * Quote Requests API
 * GET  /admin/quote-requests
 * GET  /admin/quote-requests/{id}
 * PUT  /admin/quote-requests/{id}
 * POST /admin/quote-requests/{id}/accept
 * POST /admin/quote-requests/{id}/decline
 * POST /admin/quote-requests/{id}/convert-to-order
 */
import { apiFetch } from "./client";

export type QuoteStatus = "New" | "Contacted" | "Quoted" | "Closed";
export type QuoteDecision = "pending" | "accepted" | "declined";

export interface QuoteRequest {
  id: string;
  _quoteId: number;
  customerName: string;
  phone: string;
  email: string;
  date: string;
  product: string;
  quantityPerMonth: string;
  currentFuel: string;
  currentCost: string;
  biomassCost: string;
  monthlySavings: string;
  annualSavings: string;
  status: QuoteStatus;
  adminNotes: string;
  quotedPrice: string;
  validUntil: string;
  decision: QuoteDecision;
  acceptedAt: string;
  declinedAt: string;
  declineReason: string;
  decidedByName: string;
  emailSentAt: string;
  emailDeliveryStatus: string;
  salesDocumentId: number | null;
  convertedOrderId: number | null;
}

interface ApiQuoteRow {
  quote_id: number;
  quote_number: string;
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  product: string | null;
  quantity_per_month: number | null;
  current_fuel: string | null;
  current_cost: number | null;
  biomass_cost: number | null;
  monthly_savings: number | null;
  annual_savings: number | null;
  admin_notes: string | null;
  quoted_price: string | null;
  valid_until: string | null;
  accepted_at: string | null;
  accepted_by: number | null;
  declined_at: string | null;
  decline_reason: string | null;
  decided_by_name: string | null;
  email_sent_at: string | null;
  email_delivery_status: string | null;
  sales_document_id: number | null;
  converted_order_id: number | null;
  decision?: QuoteDecision;
  status: string;
  created_at: string;
}

interface Paginated<T> { success: boolean; data: T[] }
interface Envelope<T>  { success: boolean; data: T }

function fmtMoney(n: number | null, suffix = ""): string {
  if (n == null) return "";
  return `₹${n.toLocaleString("en-IN")}${suffix}`;
}

function rowToQuote(row: ApiQuoteRow): QuoteRequest {
  return {
    id:                  row.quote_number,
    _quoteId:            row.quote_id,
    customerName:        row.name,
    phone:               row.phone || "",
    email:               row.email,
    date:                (row.created_at || "").slice(0, 10),
    product:             row.product || "Biomass Pellets",
    quantityPerMonth:    row.quantity_per_month != null ? `${row.quantity_per_month} kg/month` : "",
    currentFuel:         row.current_fuel || "",
    currentCost:         fmtMoney(row.current_cost, "/month"),
    biomassCost:         fmtMoney(row.biomass_cost, "/month"),
    monthlySavings:      fmtMoney(row.monthly_savings, "/month"),
    annualSavings:       fmtMoney(row.annual_savings, "/year"),
    status:              (row.status as QuoteStatus) || "New",
    adminNotes:          row.admin_notes || "",
    quotedPrice:         row.quoted_price || "",
    validUntil:          row.valid_until || "",
    decision:            row.decision || (row.accepted_at ? "accepted" : row.declined_at ? "declined" : "pending"),
    acceptedAt:          row.accepted_at || "",
    declinedAt:          row.declined_at || "",
    declineReason:       row.decline_reason || "",
    decidedByName:       row.decided_by_name || "",
    emailSentAt:         row.email_sent_at || "",
    emailDeliveryStatus: row.email_delivery_status || "",
    salesDocumentId:     row.sales_document_id ?? null,
    convertedOrderId:    row.converted_order_id ?? null,
  };
}

export const quoteRequestsApi = {
  async list(): Promise<QuoteRequest[]> {
    const res = await apiFetch<Paginated<ApiQuoteRow>>("/admin/quote-requests?limit=100");
    return (res.data ?? []).map(rowToQuote);
  },

  async update(
    quoteId: number,
    patch: { status: QuoteStatus; adminNotes: string; quotedPrice: string; validUntil?: string }
  ): Promise<{ email_sent: boolean; valid_until: string | null }> {
    const res = await apiFetch<Envelope<{ quote_id: number; status: string; valid_until: string | null; email_sent: boolean }>>(
      `/admin/quote-requests/${quoteId}`,
      {
        method: "PUT",
        body: JSON.stringify({
          status:       patch.status,
          admin_notes:  patch.adminNotes,
          quoted_price: patch.quotedPrice,
          valid_until:  patch.validUntil || null,
        }),
      }
    );
    return { email_sent: res.data?.email_sent ?? false, valid_until: res.data?.valid_until ?? null };
  },

  /** Record that the customer accepted this quote (who/when). */
  async accept(quoteId: number, decidedByName?: string): Promise<QuoteRequest> {
    const res = await apiFetch<Envelope<ApiQuoteRow>>(`/admin/quote-requests/${quoteId}/accept`, {
      method: "POST",
      body: JSON.stringify({ decided_by_name: decidedByName || undefined }),
    });
    return rowToQuote(res.data);
  },

  /** Record that the customer declined this quote (who/when/reason). */
  async decline(quoteId: number, reason?: string, decidedByName?: string): Promise<QuoteRequest> {
    const res = await apiFetch<Envelope<ApiQuoteRow>>(`/admin/quote-requests/${quoteId}/decline`, {
      method: "POST",
      body: JSON.stringify({ reason: reason || undefined, decided_by_name: decidedByName || undefined }),
    });
    return rowToQuote(res.data);
  },

  /** Convert an accepted quote directly into a sales order. */
  async convertToOrder(quoteId: number): Promise<{ orderId: number }> {
    const res = await apiFetch<Envelope<{ quote_id: number; order_id: number }>>(
      `/admin/quote-requests/${quoteId}/convert-to-order`,
      { method: "POST" }
    );
    return { orderId: res.data?.order_id ?? 0 };
  },
};
