/** Minimal stub — real implementation generates a PDF using jsPDF or similar. */

export interface InvoiceTemplateDraft {
  invoice_number?: string;
  invoice_date?: string;
  due_date?: string;
  customer_name?: string;
  customer_gstin?: string;
  customer_address?: string;
  seller_state?: string;
  customer_state?: string;
  place_of_supply?: string;
  items?: {
    description: string;
    hsn_sac?: string;
    quantity: number;
    unit_price: number;
    gst_rate?: number;
    discount?: number;
  }[];
  terms_and_conditions?: string;
  notes?: string;
  [key: string]: unknown;
}

export const TERMS_AND_CONDITIONS =
  "1. Goods once sold will not be taken back.\n2. All disputes subject to local jurisdiction.\n3. E. & O. E.";

export function placeOfSupplyLabel(stateCode: string | null | undefined): string {
  if (!stateCode) return "—";
  return stateCode;
}

export async function downloadInvoiceTemplatePdf(
  _draft: InvoiceTemplateDraft
): Promise<void> {
  // Stub: In a real implementation this would build a PDF and trigger download.
  console.warn("downloadInvoiceTemplatePdf: stub — no PDF generated");
}
