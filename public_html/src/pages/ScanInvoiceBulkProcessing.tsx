import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle, AlertCircle, ArrowRight, FileText, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { scanInvoicesApi } from "@/lib/api/scanInvoices";

interface InvoiceProgress {
  id: number;
  filename: string;
  status: "pending" | "processing" | "review" | "approved" | "error";
  stage: string;
  progress: number;
  label: string | null;
  error?: string;
  retrying?: boolean;
}

export default function ScanInvoiceBulkProcessing() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const idsParam      = searchParams.get("ids")   ?? "";
  const namesParam    = searchParams.get("names") ?? "";

  const ids       = idsParam.split(",").map(Number).filter(Boolean);
  const filenames = namesParam.split("||");

  const [invoices, setInvoices] = useState<InvoiceProgress[]>(() =>
    ids.map((id, i) => ({
      id,
      filename: filenames[i] || `Invoice #${id}`,
      status: "pending" as const,
      stage: "pending",
      progress: 0,
      label: "Queued…",
    }))
  );

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = async () => {
    const updates = await Promise.all(
      ids.map(async id => {
        try {
          const s = await scanInvoicesApi.getStatus(id);
          return {
            id,
            status: s.status as InvoiceProgress["status"],
            stage: s.stage ?? s.status,
            progress: s.progress ?? 0,
            label: null,
            error: s.status === "error" ? "Extraction failed" : undefined,
          };
        } catch { return null; }
      })
    );

    setInvoices(prev => prev.map((inv, i) => {
      const u = updates[i];
      if (!u || inv.retrying) return inv;
      return { ...inv, ...u };
    }));

    const allDone = updates.every(u => u && ["review","approved","error"].includes(u.status));
    if (allDone && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  useEffect(() => {
    if (ids.length === 0) { navigate("/scan-invoices"); return; }
    poll();
    pollingRef.current = setInterval(poll, 2500);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [idsParam]);

  const readyCount   = invoices.filter(i => i.status === "review").length;
  const doneCount    = invoices.filter(i => ["review","approved"].includes(i.status)).length;
  const errorCount   = invoices.filter(i => i.status === "error").length;
  const pendingCount = invoices.filter(i => ["pending","processing"].includes(i.status) || i.retrying).length;

  const statusIcon = (inv: InvoiceProgress) => {
    if (inv.status === "review")   return <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />;
    if (inv.status === "approved") return <CheckCircle className="h-4 w-4 text-primary shrink-0" />;
    if (inv.status === "error" && !inv.retrying) return <AlertCircle className="h-4 w-4 text-destructive shrink-0" />;
    return <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />;
  };

  const statusText = (inv: InvoiceProgress) => {
    if (inv.retrying)                return "Retrying upload…";
    if (inv.status === "review")     return "Ready to Review";
    if (inv.status === "approved")   return "Approved";
    if (inv.status === "error")      return "Extraction failed";
    if (inv.status === "processing") return inv.label ?? "Processing…";
    return "Queued…";
  };

  const statusColor = (inv: InvoiceProgress) => {
    if (inv.status === "review")   return "text-emerald-600";
    if (inv.status === "approved") return "text-primary";
    if (inv.status === "error")    return "text-destructive";
    return "text-muted-foreground";
  };

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mx-auto mb-4">
            <FileText className="h-5 w-5 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            Processing {ids.length} Invoice{ids.length > 1 ? "s" : ""}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {pendingCount > 0
              ? `AI is extracting data — ${pendingCount} still processing…`
              : errorCount > 0
              ? `${readyCount} ready · ${errorCount} failed`
              : "All done!"}
          </p>
        </div>

        {/* Overall progress */}
        <div className="bg-card border rounded-xl p-4 mb-4 shadow-sm">
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            <span>{doneCount} of {ids.length} extracted</span>
            {errorCount > 0 && <span className="text-destructive">{errorCount} failed</span>}
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${(doneCount / Math.max(ids.length, 1)) * 100}%` }}
            />
          </div>
        </div>

        {/* Individual invoice cards */}
        <div className="space-y-3 mb-6">
          {invoices.map(inv => (
            <div key={inv.id} className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 p-4">
                {statusIcon(inv)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-card-foreground truncate">{inv.filename}</p>
                  <p className={cn("text-xs mt-0.5", statusColor(inv))}>{statusText(inv)}</p>
                </div>

                {inv.status === "review" && (
                  <Button size="sm" onClick={() => navigate(`/scan-invoices/${inv.id}/review`)} className="shrink-0 text-xs h-7 px-2.5">
                    Review <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                )}

                {inv.status === "error" && !inv.retrying && (
                  <button
                    onClick={() => navigate("/scan-invoices/upload")}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 border border-destructive/30 text-destructive text-xs font-medium rounded-md hover:bg-destructive/5 transition-colors shrink-0"
                  >
                    <RefreshCw className="h-3 w-3" /> Retry
                  </button>
                )}

                {(inv.status === "processing" || inv.retrying) && (
                  <span className="text-xs text-muted-foreground font-mono shrink-0">{inv.progress}%</span>
                )}
              </div>

              {/* Per-item progress bar */}
              {(inv.status === "processing" || inv.retrying) && (
                <div className="h-0.5 bg-muted">
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: `${inv.progress}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Bottom actions */}
        <div className="flex gap-3">
          {readyCount > 0 && (
            <Button
              className="flex-1"
              onClick={() => {
                const first = invoices.find(i => i.status === "review");
                if (first) navigate(`/scan-invoices/${first.id}/review`);
              }}
            >
              Review Next <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          )}
          <Button variant="outline" className="flex-1" onClick={() => navigate("/scan-invoices")}>
            View All Invoices
          </Button>
        </div>
      </div>
    </div>
  );
}
