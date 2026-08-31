import { apiFetch } from "@/lib/api/client";

export interface InvoiceDashboardSummary {
  today_sales: number;
  monthly_revenue: number;
  net_profit: number;
  gst_payable: number;
  total_products: number;
  low_stock_count: number;
  out_of_stock_count: number;
  unread_notifications: number;
  recent_invoices: Array<{
    invoice_id: number;
    invoice_number: string | null;
    original_filename: string;
    marketplace: string;
    total_amount: number;
    processing_status: string;
    created_at: string;
  }>;
}

export interface InvoiceDashboardChart {
  year: number;
  labels: string[];
  datasets: Array<{ name: string; data: number[] }>;
}

export const invoiceDashboardApi = {
  async summary(): Promise<InvoiceDashboardSummary> {
    return (await apiFetch<{ data: InvoiceDashboardSummary }>("/admin/invoice-dashboard/summary")).data;
  },
  async revenueChart(year?: number): Promise<InvoiceDashboardChart> {
    const q = year ? `?year=${year}` : "";
    return (await apiFetch<{ data: InvoiceDashboardChart }>(`/admin/invoice-dashboard/revenue-chart${q}`)).data;
  },
  async recentActivity(): Promise<Array<Record<string, unknown>>> {
    return (await apiFetch<{ data: Array<Record<string, unknown>> }>("/admin/invoice-dashboard/recent-activity")).data;
  },
};
