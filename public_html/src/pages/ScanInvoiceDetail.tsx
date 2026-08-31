import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { FileText } from "lucide-react";
import { scanInvoicesApi } from "@/lib/api/scanInvoices";
import type { ScanInvoice } from "@/types/scanInvoice";

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-status-delivered/10 text-status-delivered border-status-delivered/20",
  rejected: "bg-status-cancelled/10 text-status-cancelled border-status-cancelled/20",
  review:   "bg-status-processing/10 text-status-processing border-status-processing/20",
};

export default function ScanInvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [inv, setInv] = useState<ScanInvoice | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      try {
        const data = await scanInvoicesApi.get(Number(id));
        setInv(data);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Not found");
        navigate("/scan-invoices");
      } finally { setLoading(false); }
    })();
  }, [id, navigate]);

  if (loading) return <div className="space-y-4"><Skeleton className="h-40" /><Skeleton className="h-60" /></div>;
  if (!inv) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => navigate("/scan-invoices")} className="text-muted-foreground hover:text-foreground text-sm">← Invoices</button>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-2xl font-bold text-foreground">{inv.invoice_number ?? "Invoice Detail"}</h1>
        <Badge className={cn("border capitalize ml-2", STATUS_STYLES[inv.processing_status] ?? "bg-muted text-muted-foreground")}>
          {inv.processing_status}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left col: main details */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-card rounded-xl border shadow-sm p-5">
            <h2 className="text-base font-semibold text-card-foreground mb-4">Invoice Details</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {[
                ["Invoice Number", inv.invoice_number],
                ["Invoice Date", inv.invoice_date],
                ["Marketplace", inv.marketplace],
                ["File Type", inv.file_type?.toUpperCase()],
                ["Vendor Name", inv.vendor_name],
                ["Vendor GSTIN", inv.vendor_gstin],
                ["Processed At", inv.processed_at ? new Date(inv.processed_at).toLocaleString("en-IN") : null],
                ["Approved At", inv.approved_at ? new Date(inv.approved_at).toLocaleString("en-IN") : null],
                ["AI Confidence", inv.ai_confidence_score ? `${inv.ai_confidence_score}%` : null],
              ].map(([label, value]) => value ? (
                <div key={label as string}>
                  <p className="text-muted-foreground text-xs">{label as string}</p>
                  <p className="text-card-foreground capitalize">{value as string}</p>
                </div>
              ) : null)}
            </div>
          </div>

          {/* Line items */}
          {inv.line_items && inv.line_items.length > 0 && (
            <div className="bg-card rounded-xl border shadow-sm">
              <div className="p-4 border-b"><h2 className="text-base font-semibold text-card-foreground">Line Items</h2></div>
              <div className="p-4 overflow-x-auto eco-float-scroll">
                <table className="w-full text-xs">
                  <thead><tr className="border-b bg-muted/50">{["Product","SKU","HSN","Qty","Unit Price","Taxable","CGST","SGST","IGST","Total"].map(h => <th key={h} className="text-left py-2 px-3 text-muted-foreground uppercase">{h}</th>)}</tr></thead>
                  <tbody>
                    {inv.line_items.map((li, idx) => (
                      <tr key={li.line_item_id ?? idx} className="border-b hover:bg-muted/30">
                        <td className="py-2 px-3 font-medium">{li.product_name}</td>
                        <td className="py-2 px-3 font-mono">{li.sku ?? "—"}</td>
                        <td className="py-2 px-3">{li.hsn_code ?? "—"}</td>
                        <td className="py-2 px-3">{li.quantity}</td>
                        <td className="py-2 px-3">₹{li.unit_price.toFixed(2)}</td>
                        <td className="py-2 px-3">₹{li.taxable_value.toFixed(2)}</td>
                        <td className="py-2 px-3">₹{li.cgst_amount.toFixed(2)}</td>
                        <td className="py-2 px-3">₹{li.sgst_amount.toFixed(2)}</td>
                        <td className="py-2 px-3">₹{li.igst_amount.toFixed(2)}</td>
                        <td className="py-2 px-3 font-medium">₹{li.total_amount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right col: summary */}
        <div className="space-y-4">
          <div className="bg-card rounded-xl border shadow-sm p-5">
            <h2 className="text-base font-semibold text-card-foreground mb-4">Financial Summary</h2>
            <div className="space-y-2 text-sm">
              {[["Subtotal", inv.subtotal], ["Tax Amount", inv.tax_amount], ["Total Amount", inv.total_amount]].map(([label, val]) => (
                <div key={label as string} className="flex justify-between border-b py-1.5 last:border-0">
                  <span className="text-muted-foreground">{label as string}</span>
                  <span className="font-medium text-card-foreground">₹{(val as number).toLocaleString("en-IN")}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-card rounded-xl border shadow-sm p-5">
            <h2 className="text-base font-semibold text-card-foreground mb-2 flex items-center gap-2"><FileText className="h-4 w-4" />File</h2>
            <p className="text-xs text-muted-foreground">{inv.original_filename}</p>
            {inv.file_path && inv.file_path !== "manual" && (
              <a href={scanInvoicesApi.downloadUrl(inv.invoice_id)} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs text-primary hover:underline">View original file</a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
