export interface GstRecord {
  gst_record_id: number;
  tenant_id: number;
  invoice_id: number;
  line_item_id: number | null;
  gstin_supplier: string | null;
  gstin_recipient: string | null;
  hsn_code: string | null;
  taxable_value: number;
  cgst_rate: number;
  cgst_amount: number;
  sgst_rate: number;
  sgst_amount: number;
  igst_rate: number;
  igst_amount: number;
  total_tax: number;
  supply_type: "b2b" | "b2c";
  transaction_date: string;
  financial_year: string;
  quarter: number;
  month: number;
  created_at: string;
  invoice_number?: string | null;
  vendor_name?: string | null;
}

export interface GstSummary {
  financial_year: string;
  output_tax: number;
  input_tax_credit: number;
  net_payable: number;
  monthly: GstMonthlyRow[];
  quarterly: GstQuarterRow[];
}

export interface GstMonthlyRow {
  month_num: number;
  month_name: string;
  taxable_value: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

export interface GstQuarterRow {
  quarter: string;
  output: number;
  input: number;
  payable: number;
}

export interface HsnSummaryRow {
  hsn_code: string;
  txn_count: number;
  taxable_value: number;
  total_tax: number;
}
