import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { Upload, FileText, X, CheckCircle, AlertCircle, RotateCcw, AlertTriangle, ArrowRight, History, Loader2, Zap, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { scanInvoicesApi } from "@/lib/api/scanInvoices";
import type { ScanInvoice } from "@/types/scanInvoice";
import { CreatableCombobox } from "@/components/ui/creatable-combobox";
import { extractInvoiceFromPdfPage, getPdfPageCount, parsedInvoiceToValidatedData } from "@/lib/parsers/index";

interface FileItem {
  id: string;
  file: File;
  status: "idle" | "parsing" | "uploading" | "done" | "error";
  error?: string;
}

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-status-delivered/10 text-status-delivered border-status-delivered/20",
  review:   "bg-status-processing/10 text-status-processing border-status-processing/20",
  pending:  "bg-status-pending/10 text-status-pending border-status-pending/20",
  error:    "bg-red-50 text-red-600 border-red-200",
};

export default function ScanInvoiceReturns() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"upload" | "history">("upload");
  const [files, setFiles] = useState<FileItem[]>([]);
  const [marketplace, setMarketplace] = useState("amazon");
  const [returnType, setReturnType] = useState<"regular" | "damaged">("regular");
  const [uploading, setUploading] = useState(false);
  const [history, setHistory] = useState<ScanInvoice[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const isPlatformParser = ["amazon", "flipkart", "meesho"].includes(marketplace.toLowerCase());

  const getToken = () => {
    const raw = localStorage.getItem("erp_admin_auth");
    return raw ? JSON.parse(raw).token ?? "" : "";
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await scanInvoicesApi.list({ invoice_type: "return", limit: "200" });
      setHistory(res.data ?? []);
    } catch { /* silent */ }
    finally { setHistoryLoading(false); }
  };

  useEffect(() => { if (tab === "history") loadHistory(); }, [tab]);

  const addFiles = (newFiles: File[]) => {
    const valid = newFiles.filter(f => ["application/pdf","image/jpeg","image/jpg","image/png"].includes(f.type));
    if (valid.length < newFiles.length) toast.error("Only PDF, JPG, PNG accepted");
    setFiles(prev => [...prev, ...valid.map(f => ({ id: Math.random().toString(36).slice(2), file: f, status: "idle" as const }))]);
  };

  const processAll = async () => {
    const pending = files.filter(f => f.status === "idle");
    if (!pending.length) { toast.error("No files to process"); return; }
    setUploading(true);

    const token = getToken();
    let successCount = 0;

    for (const item of pending) {
      const isPdf = item.file.type === "application/pdf";
      setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: isPlatformParser && isPdf ? "parsing" : "uploading" } : f));

      try {
        if (isPlatformParser && isPdf) {
          // Multi-page PDF: split and process each page separately
          const pageCount = await getPdfPageCount(item.file);
          const { PDFDocument } = await import("pdf-lib");
          const srcBytes = await item.file.arrayBuffer();
          const srcDoc = await PDFDocument.load(srcBytes);

          for (let page = 1; page <= pageCount; page++) {
            const singleDoc = await PDFDocument.create();
            const [copiedPage] = await singleDoc.copyPages(srcDoc, [page - 1]);
            singleDoc.addPage(copiedPage);
            const singleBytes = await singleDoc.save();
            const singleFile = new File([singleBytes], `${item.file.name.replace('.pdf','')}_page${page}.pdf`, { type: "application/pdf" });

            const parsed = await extractInvoiceFromPdfPage(item.file, page, marketplace);
            const fd = new FormData();
            fd.append("file", singleFile);
            fd.append("marketplace", marketplace);
            fd.append("invoice_type", "return");
            fd.append("is_damaged", returnType === "damaged" ? "1" : "0");
            fd.append("pdf_page", "1");
            if (parsed && parsed.confidence >= 40) {
              fd.append("pre_extracted", JSON.stringify(parsedInvoiceToValidatedData(parsed)));
            }

            const r = await fetch(`${import.meta.env.VITE_API_BASE_URL}/admin/scan-invoices/upload-page`, {
              method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd,
            });
            const json = await r.json();
            if (!json.success) throw new Error(json.message);

            // Auto-approve immediately
            const invoiceId = json.data?.invoice_id;
            await fetch(`${import.meta.env.VITE_API_BASE_URL}/admin/scan-invoices/${invoiceId}/approve`, {
              method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: "{}",
            });
          }
        } else {
          // Single file (image or non-platform PDF) — use AI
          const fd = new FormData();
          fd.append("file", item.file);
          fd.append("marketplace", marketplace);
          fd.append("invoice_type", "return");
          fd.append("is_damaged", returnType === "damaged" ? "1" : "0");

          const r = await fetch(`${import.meta.env.VITE_API_BASE_URL}/admin/scan-invoices/upload`, {
            method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd,
          });
          const json = await r.json();
          if (!json.success) throw new Error(json.message);

          const invoiceId = json.data?.invoice_id ?? json.data?.invoice_ids?.[0];
          await fetch(`${import.meta.env.VITE_API_BASE_URL}/admin/scan-invoices/${invoiceId}/approve`, {
            method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: "{}",
          });
        }

        setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: "done" } : f));
        successCount++;
      } catch (err) {
        setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: "error", error: err instanceof Error ? err.message : "Failed" } : f));
        toast.error(`${item.file.name}: ${err instanceof Error ? err.message : "Failed"}`);
      }
    }

    setUploading(false);
    if (successCount > 0) {
      const msg = returnType === "damaged" ? "moved to Damaged Goods" : "stock restored to inventory";
      toast.success(`${successCount} file${successCount > 1 ? "s" : ""} processed — ${msg}`);
      setTab("history");
      loadHistory();
    }
  };

  const TAB = (t: string) => cn("px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
    tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Sales Returns</h1>
        <p className="text-sm text-muted-foreground mt-1">Upload return invoices to update inventory.</p>
      </div>

      <div className="flex border-b border-border">
        <button className={TAB("upload")} onClick={() => setTab("upload")}><Upload className="h-4 w-4 inline mr-1.5" />Upload Return</button>
        <button className={TAB("history")} onClick={() => setTab("history")}><History className="h-4 w-4 inline mr-1.5" />Returns History</button>
      </div>

      {tab === "upload" && (
        <div className="space-y-5 max-w-2xl">
          {/* Return type */}
          <div className="space-y-2">
            <Label>Return Type</Label>
            <div className="inline-flex items-center bg-muted rounded-lg p-1 gap-1">
              {(["regular","damaged"] as const).map(t => (
                <button key={t} onClick={() => setReturnType(t)}
                  className={cn("flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
                    returnType === t ? "bg-background text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground")}>
                  {t === "regular" ? <RotateCcw className="h-3.5 w-3.5" /> : <AlertTriangle className={cn("h-3.5 w-3.5", returnType === "damaged" && "text-amber-500")} />}
                  {t === "regular" ? "Regular Return" : "Damaged Goods"}
                </button>
              ))}
            </div>
            <div className={cn("p-3 rounded-lg border text-xs flex items-start gap-2",
              returnType === "regular" ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-amber-50 border-amber-200 text-amber-700")}>
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              {returnType === "regular" ? "Product will be added back to active stock." : "Product will be moved to Damaged Goods."}
            </div>
          </div>

          {/* Marketplace */}
          <div className="space-y-1.5">
            <Label>Marketplace</Label>
            <div className="flex items-center gap-3">
              <div className="w-64">
                <CreatableCombobox optionsKey="marketplace" value={marketplace} onChange={setMarketplace} placeholder="Select marketplace…" />
              </div>
              {isPlatformParser ? (
                <Badge className="border bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1">
                  <Zap className="h-3 w-3" />Instant parser
                </Badge>
              ) : (
                <Badge className="border bg-blue-50 text-blue-600 border-blue-200 flex items-center gap-1">
                  <Brain className="h-3 w-3" />AI extraction
                </Badge>
              )}
            </div>
            {isPlatformParser && <p className="text-xs text-emerald-700">Multi-page PDFs split automatically — each page is one return invoice</p>}
          </div>

          {/* Drop zone */}
          <div
            onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(Array.from(e.dataTransfer.files)); }}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => inputRef.current?.click()}
            className={cn("border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all",
              dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30")}
          >
            <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" multiple className="hidden"
              onChange={e => { if (e.target.files) addFiles(Array.from(e.target.files)); e.target.value = ""; }} />
            <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium text-foreground">Drop return invoices here or click to browse</p>
            <p className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG — multi-page PDFs split automatically</p>
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="space-y-2">
              {files.map(item => (
                <div key={item.id} className="flex items-center gap-3 bg-card border rounded-xl p-3">
                  <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-card-foreground truncate">{item.file.name}</p>
                    <p className="text-xs text-muted-foreground">{(item.file.size/1024/1024).toFixed(1)} MB</p>
                  </div>
                  {item.status === "idle" && <button onClick={() => setFiles(p => p.filter(f => f.id !== item.id))}><X className="h-4 w-4 text-muted-foreground hover:text-foreground" /></button>}
                  {(item.status === "parsing" || item.status === "uploading") && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      {item.status === "parsing" ? "Parsing…" : "Uploading…"}
                    </div>
                  )}
                  {item.status === "done" && <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />}
                  {item.status === "error" && <div className="flex items-center gap-1"><AlertCircle className="h-4 w-4 text-destructive" /><span className="text-xs text-destructive">{item.error}</span></div>}
                </div>
              ))}
            </div>
          )}

          {files.some(f => f.status === "idle") && (
            <Button onClick={processAll} disabled={uploading} className="w-full">
              {uploading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Processing…</> : `Process ${files.filter(f => f.status === "idle").length} Return Invoice${files.filter(f => f.status === "idle").length > 1 ? "s" : ""}`}
            </Button>
          )}

          <div className="p-4 bg-muted/50 border border-border rounded-lg">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">What happens automatically</p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              {["Upload invoice", isPlatformParser ? "Parser extracts data" : "AI reads product & qty", returnType === "damaged" ? "Moved to Damaged Goods" : "Stock added back to Inventory"].map((step, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">{i+1}</span>
                  {step}
                  {i < 2 && <ArrowRight className="h-3 w-3 text-muted-foreground/50 ml-1" />}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "history" && (
        <div className="bg-card rounded-xl border shadow-sm">
          <div className="p-4 overflow-x-auto eco-float-scroll">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50">{["Date","Invoice #","Platform","Amount","Status"].map(h => <th key={h} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>)}</tr></thead>
              <tbody>
                {historyLoading && Array.from({ length: 4 }).map((_, i) => <tr key={i} className="border-b">{Array.from({ length: 5 }).map((_, j) => <td key={j} className="py-3 px-4"><Skeleton className="h-4 w-24" /></td>)}</tr>)}
                {!historyLoading && history.length === 0 && <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground text-sm">No returns yet</td></tr>}
                {!historyLoading && history.map(inv => (
                  <tr key={inv.invoice_id} className="border-b hover:bg-muted/30 cursor-pointer" onClick={() => navigate(inv.processing_status === "review" ? `/scan-invoices/${inv.invoice_id}/review` : `/scan-invoices/${inv.invoice_id}`)}>
                    <td className="py-3 px-4 text-muted-foreground">{inv.invoice_date ?? new Date(inv.created_at).toLocaleDateString("en-IN")}</td>
                    <td className="py-3 px-4 font-mono text-xs">{inv.invoice_number ?? "—"}</td>
                    <td className="py-3 px-4 capitalize">{inv.marketplace}</td>
                    <td className="py-3 px-4">₹{inv.total_amount.toLocaleString("en-IN")}</td>
                    <td className="py-3 px-4"><Badge className={cn("border capitalize", STATUS_STYLES[inv.processing_status] ?? "bg-muted text-muted-foreground")}>{inv.processing_status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
