import { useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ShoppingCart,
  Package,
  Receipt,
  BarChart2,
  Globe,
  TrendingUp,
  Users,
  DollarSign,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  FileText,
  Loader2,
} from "lucide-react";

interface ReportField {
  key: string;
  label: string;
  default: boolean;
}

interface ReportType {
  key: string;
  title: string;
  description: string;
  icon: React.ElementType;
  fields: ReportField[];
}

const REPORT_FIELDS: ReportType[] = [
  {
    key: "sales",
    title: "Sales Report",
    description: "Revenue, orders, commissions and settlements by platform",
    icon: ShoppingCart,
    fields: [
      { key: "date", label: "Date", default: true },
      { key: "order_number", label: "Order Number", default: true },
      { key: "marketplace", label: "Marketplace", default: true },
      { key: "revenue", label: "Revenue", default: true },
      { key: "tax", label: "Tax", default: true },
      { key: "net_revenue", label: "Net Revenue", default: true },
      { key: "commission", label: "Commission", default: false },
      { key: "tds", label: "TDS", default: false },
      { key: "customer_name", label: "Customer Name", default: false },
      { key: "status", label: "Status", default: false },
    ],
  },
  {
    key: "purchase",
    title: "Purchase Report",
    description: "Vendor invoices, input GST and purchase history",
    icon: Package,
    fields: [
      { key: "date", label: "Date", default: true },
      { key: "invoice_number", label: "Invoice Number", default: true },
      { key: "vendor_name", label: "Vendor Name", default: true },
      { key: "total_amount", label: "Total Amount", default: true },
      { key: "input_gst", label: "Input GST", default: true },
      { key: "vendor_gstin", label: "Vendor GSTIN", default: false },
      { key: "vendor_type", label: "Vendor Type", default: false },
      { key: "notes", label: "Notes", default: false },
    ],
  },
  {
    key: "gst",
    title: "GST Report",
    description: "Output vs input GST, net liability by period",
    icon: Receipt,
    fields: [
      { key: "period", label: "Period", default: true },
      { key: "output_gst", label: "Output GST", default: true },
      { key: "input_gst", label: "Input GST", default: true },
      { key: "net_gst", label: "Net GST", default: true },
      { key: "cgst", label: "CGST", default: true },
      { key: "sgst", label: "SGST", default: true },
      { key: "igst", label: "IGST", default: true },
      { key: "hsn_code", label: "HSN Code", default: false },
    ],
  },
  {
    key: "inventory",
    title: "Inventory Report",
    description: "Current stock levels, valuation and reorder alerts",
    icon: BarChart2,
    fields: [
      { key: "sku", label: "SKU", default: true },
      { key: "name", label: "Product Name", default: true },
      { key: "category", label: "Category", default: true },
      { key: "current_stock", label: "Current Stock", default: true },
      { key: "cost_price", label: "Cost Price", default: true },
      { key: "selling_price", label: "Selling Price", default: true },
      { key: "min_stock_level", label: "Min Stock Level", default: false },
      { key: "hsn_code", label: "HSN Code", default: false },
      { key: "total_value", label: "Total Value", default: false },
    ],
  },
  {
    key: "marketplace",
    title: "Marketplace Report",
    description: "Platform-wise performance: revenue, orders, commissions",
    icon: Globe,
    fields: [
      { key: "platform", label: "Platform", default: true },
      { key: "revenue", label: "Revenue", default: true },
      { key: "orders", label: "Orders", default: true },
      { key: "commission", label: "Commission", default: true },
      { key: "returns", label: "Returns", default: false },
      { key: "avg_order_value", label: "Avg Order Value", default: false },
    ],
  },
  {
    key: "profit",
    title: "Profit & Loss Report",
    description: "Revenue vs COGS vs expenses, gross and net profit",
    icon: TrendingUp,
    fields: [
      { key: "period", label: "Period", default: true },
      { key: "revenue", label: "Revenue", default: true },
      { key: "cogs", label: "COGS", default: true },
      { key: "gross_profit", label: "Gross Profit", default: true },
      { key: "expenses", label: "Expenses", default: true },
      { key: "net_profit", label: "Net Profit", default: true },
      { key: "commission", label: "Commission", default: false },
      { key: "tax", label: "Tax", default: false },
    ],
  },
  {
    key: "customer",
    title: "Customer Report",
    description: "Customer purchase history and lifetime value",
    icon: Users,
    fields: [
      { key: "name", label: "Customer Name", default: true },
      { key: "total_orders", label: "Total Orders", default: true },
      { key: "total_revenue", label: "Total Revenue", default: true },
      { key: "marketplace", label: "Marketplace", default: true },
      { key: "email", label: "Email", default: false },
      { key: "last_order", label: "Last Order Date", default: false },
      { key: "gstin", label: "GSTIN", default: false },
    ],
  },
  {
    key: "expense",
    title: "Expense Report",
    description: "All business expenses by category and platform",
    icon: DollarSign,
    fields: [
      { key: "date", label: "Date", default: true },
      { key: "category", label: "Category", default: true },
      { key: "amount", label: "Amount", default: true },
      { key: "platform", label: "Platform", default: true },
      { key: "description", label: "Description", default: false },
    ],
  },
];

type FieldMap = Record<string, Record<string, boolean>>;

function buildDefaultFields(): FieldMap {
  const map: FieldMap = {};
  for (const r of REPORT_FIELDS) {
    map[r.key] = {};
    for (const f of r.fields) {
      map[r.key][f.key] = f.default;
    }
  }
  return map;
}

export default function InvoiceReports() {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 8) + "01";

  const [fromDate, setFromDate] = useState(firstOfMonth);
  const [toDate, setToDate] = useState(today);
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const [fieldMap, setFieldMap] = useState<FieldMap>(buildDefaultFields);
  const [downloading, setDownloading] = useState<Record<string, boolean>>({});

  const toggleField = (reportKey: string, fieldKey: string) => {
    setFieldMap((prev) => ({
      ...prev,
      [reportKey]: { ...prev[reportKey], [fieldKey]: !prev[reportKey][fieldKey] },
    }));
  };

  const selectAll = (reportKey: string) => {
    const report = REPORT_FIELDS.find((r) => r.key === reportKey);
    if (!report) return;
    const all: Record<string, boolean> = {};
    for (const f of report.fields) all[f.key] = true;
    setFieldMap((prev) => ({ ...prev, [reportKey]: all }));
  };

  const resetDefault = (reportKey: string) => {
    const report = REPORT_FIELDS.find((r) => r.key === reportKey);
    if (!report) return;
    const defaults: Record<string, boolean> = {};
    for (const f of report.fields) defaults[f.key] = f.default;
    setFieldMap((prev) => ({ ...prev, [reportKey]: defaults }));
  };

  const handleDownload = async (reportKey: string, format: "excel" | "pdf") => {
    const dlKey = `${reportKey}_${format}`;
    setDownloading((d) => ({ ...d, [dlKey]: true }));
    try {
      const selectedFields = Object.entries(fieldMap[reportKey] ?? {})
        .filter(([, v]) => v)
        .map(([k]) => k);

      const genRes = await apiFetch<{ data: { report_id: string } }>("/admin/reports/generate", {
        method: "POST",
        body: JSON.stringify({
          type: reportKey,
          from_date: fromDate,
          to_date: toDate,
          format,
          fields: selectedFields,
        }),
      });

      const reportId = genRes.data?.report_id;
      if (!reportId) { toast.error("No report ID returned"); return; }

      const token = localStorage.getItem("erp_admin_auth");
      const t = token ? JSON.parse(token).token : null;
      const base = import.meta.env.VITE_API_BASE_URL;

      if (format === "pdf") {
        window.open(`${base}/admin/reports/${reportId}/download?token=${t ?? ""}`, "_blank");
      } else {
        const dlRes = await fetch(`${base}/admin/reports/${reportId}/download`, {
          headers: { Authorization: t ? `Bearer ${t}` : "" },
        });
        if (!dlRes.ok) throw new Error("Download failed");
        const blob = await dlRes.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${reportKey}_report_${fromDate}_${toDate}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
      }
      toast.success("Report downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reports require the backend to be running");
    } finally {
      setDownloading((d) => ({ ...d, [dlKey]: false }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Reports</h1>
      </div>

      <div className="bg-card rounded-xl border shadow-sm p-4">
        <div className="flex items-end gap-4 flex-wrap">
          <div className="space-y-1.5">
            <Label>From Date</Label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1.5">
            <Label>To Date</Label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-40" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {REPORT_FIELDS.map((report) => {
          const Icon = report.icon;
          const expanded = expandedReport === report.key;
          const fields = report.fields;
          const selectedCount = Object.values(fieldMap[report.key] ?? {}).filter(Boolean).length;
          const dlExcel = downloading[`${report.key}_excel`];
          const dlPdf = downloading[`${report.key}_pdf`];

          return (
            <div key={report.key} className="bg-card rounded-xl border shadow-sm">
              <div className="p-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold text-card-foreground">{report.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{report.description}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground">{selectedCount}/{fields.length} fields</span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={dlExcel}
                    onClick={() => handleDownload(report.key, "excel")}
                    className="gap-1"
                  >
                    {dlExcel ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileSpreadsheet className="h-3 w-3" />}
                    Excel
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={dlPdf}
                    onClick={() => handleDownload(report.key, "pdf")}
                    className="gap-1"
                  >
                    {dlPdf ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
                    PDF
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => setExpandedReport(expanded ? null : report.key)}
                  >
                    {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {expanded && (
                <div className="border-t p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium text-card-foreground">Select Fields</span>
                    <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => selectAll(report.key)}>Select All</Button>
                    <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => resetDefault(report.key)}>Reset Default</Button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {fields.map((field) => (
                      <label
                        key={field.key}
                        className={cn(
                          "flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors text-sm",
                          fieldMap[report.key]?.[field.key]
                            ? "bg-primary/5 border-primary/30 text-foreground"
                            : "border-border text-muted-foreground hover:bg-muted/30"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={!!fieldMap[report.key]?.[field.key]}
                          onChange={() => toggleField(report.key, field.key)}
                          className="rounded"
                        />
                        <span>{field.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
