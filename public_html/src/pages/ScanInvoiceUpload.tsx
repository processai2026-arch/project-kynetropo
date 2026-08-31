import { useState, useRef } from "react";
import { toast } from "sonner";
import { Upload, FileText, X, CheckCircle, AlertCircle, Loader2, Zap, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { CreatableCombobox } from "@/components/ui/creatable-combobox";
import { cn } from "@/lib/utils";
import { extractInvoiceFromPdfPage, getPdfPageCount, parsedInvoiceToValidatedData } from "@/lib/parsers/index";
import { apiFetch } from "@/lib/api/client";

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];

type ExtractionMethod = "parser" | "ai" | "pending";

interface FileItem {
  id: string;
  file: File;
  status: "idle" | "uploading" | "parsing" | "done" | "error";
  invoiceId?: number;
  invoiceIds?: number[];
  pageCount?: number;
  extractionMethod?: ExtractionMethod;
  error?: string;
}

export default function ScanInvoiceUpload() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [marketplace, setMarketplace] = useState("other");
  const [isCreditSale, setIsCreditSale] = useState(false);
  const [creditDays, setCreditDays] = useState(30);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const addFiles = (newFiles: File[]) => {
    const valid = newFiles.filter(f => ALLOWED_TYPES.includes(f.type));
    const invalid = newFiles.filter(f => !ALLOWED_TYPES.includes(f.type));
    if (invalid.length) toast.error(`${invalid.length} file(s) skipped — only PDF, JPG, PNG accepted`);
    setFiles(prev => [
      ...prev,
      ...valid.map(f => ({ id: Math.random().toString(36).slice(2), file: f, status: "idle" as const })),
    ]);
  };

  const getToken = () => {
    const raw = localStorage.getItem("erp_admin_auth");
    return raw ? JSON.parse(raw).token ?? "" : "";
  };

  const uploadAll = async () => {
    const pending = files.filter(f => f.status === "idle");
    if (!pending.length) { toast.error("No files to upload"); return; }
    setUploading(true);

    const token = getToken();
    const uploadedIds: number[] = [];
    const isPlatformParser = ["amazon", "flipkart", "meesho"].includes(marketplace.toLowerCase());

    for (const item of pending) {
      setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: isPlatformParser && item.file.type === "application/pdf" ? "parsing" : "uploading" } : f));

      try {
        // ── Client-side parser path (Amazon / Flipkart / Meesho PDFs) ──────────
        if (isPlatformParser && item.file.type === "application/pdf") {
          const pageCount = await getPdfPageCount(item.file);

          if (pageCount === 1) {
            // Single page — try client-side parser first
            const parsed = await extractInvoiceFromPdfPage(item.file, 1, marketplace);

            if (parsed && parsed.confidence >= 40) {
              // Good parse — upload with pre-extracted data, skip AI processing
              const fd = new FormData();
              fd.append("file", item.file);
              fd.append("marketplace", marketplace);
              fd.append("invoice_type", "sale");
              fd.append("is_credit_sale", isCreditSale ? "1" : "0");
              if (isCreditSale) fd.append("credit_days", String(creditDays));
              fd.append("pre_extracted", JSON.stringify(parsedInvoiceToValidatedData(parsed)));

              const r = await fetch(`${import.meta.env.VITE_API_BASE_URL}/admin/scan-invoices/upload`, {
                method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd,
              });
              const json = await r.json();
              if (!json.success) throw new Error(json.message || "Upload failed");

              const id = json.data.invoice_id as number;
              uploadedIds.push(id);
              setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: "done", invoiceId: id, extractionMethod: "parser" } : f));
              continue;
            }
          }

          if (pageCount > 1) {
            const { PDFDocument } = await import("pdf-lib");
            const srcBytes = await item.file.arrayBuffer();
            const srcDoc = await PDFDocument.load(srcBytes);

            const invoiceIds: number[] = [];
            let parserSuccessCount = 0;

            for (let page = 1; page <= pageCount; page++) {
              // Extract single page as its own PDF
              const singleDoc = await PDFDocument.create();
              const [copiedPage] = await singleDoc.copyPages(srcDoc, [page - 1]);
              singleDoc.addPage(copiedPage);
              const singleBytes = await singleDoc.save();
              const singleBlob = new Blob([singleBytes], { type: "application/pdf" });
              const singleFile = new File([singleBlob], `${item.file.name.replace('.pdf','')}_page${page}.pdf`, { type: "application/pdf" });

              const parsed = await extractInvoiceFromPdfPage(item.file, page, marketplace);
              const fd = new FormData();
              fd.append("file", singleFile);
              fd.append("marketplace", marketplace);
              fd.append("invoice_type", "sale");
              fd.append("is_credit_sale", isCreditSale ? "1" : "0");
              if (isCreditSale) fd.append("credit_days", String(creditDays));
              fd.append("pdf_page", "1"); // single page PDF, always page 1
              if (parsed && parsed.confidence >= 40) {
                fd.append("pre_extracted", JSON.stringify(parsedInvoiceToValidatedData(parsed)));
                parserSuccessCount++;
              }

              const r = await fetch(`${import.meta.env.VITE_API_BASE_URL}/admin/scan-invoices/upload-page`, {
                method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd,
              });
              const json = await r.json();
              if (json.success) invoiceIds.push(json.data.invoice_id);
            }

            uploadedIds.push(...invoiceIds);
            setFiles(prev => prev.map(f => f.id === item.id ? {
              ...f, status: "done", invoiceIds,
              pageCount,
              extractionMethod: parserSuccessCount > pageCount / 2 ? "parser" : "ai",
            } : f));
            continue;
          }
        }

        // ── Fallback: server-side AI (Groq Vision) for images / non-platform PDFs ──
        setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: "uploading" } : f));
        const fd = new FormData();
        fd.append("file", item.file);
        fd.append("marketplace", marketplace);
        fd.append("invoice_type", "sale");
        fd.append("is_credit_sale", isCreditSale ? "1" : "0");
        if (isCreditSale) fd.append("credit_days", String(creditDays));

        const r = await fetch(`${import.meta.env.VITE_API_BASE_URL}/admin/scan-invoices/upload`, {
          method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd,
        });
        const json = await r.json();
        if (!json.success) throw new Error(json.message || "Upload failed");

        const ids: number[] = json.data.multi_page
          ? (json.data.invoice_ids as number[])
          : [json.data.invoice_id as number];
        ids.forEach(id => uploadedIds.push(id));
        setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: "done", invoiceId: ids[0], invoiceIds: ids, extractionMethod: "ai" } : f));

      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: "error", error: msg } : f));
      }
    }

    setUploading(false);

    if (uploadedIds.length > 0) {
      const parserCount = files.filter(f => f.extractionMethod === "parser").length;
      const aiCount = files.filter(f => f.extractionMethod === "ai").length;
      toast.success(`${uploadedIds.length} invoice${uploadedIds.length > 1 ? "s" : ""} processed${parserCount > 0 ? ` (${parserCount} instant via parser)` : ""}`);
      const existing = JSON.parse(sessionStorage.getItem("pendingInvoiceIds") || "[]");
      sessionStorage.setItem("pendingInvoiceIds", JSON.stringify([...existing, ...uploadedIds]));
      setTimeout(() => navigate("/scan-invoices"), 800);
    }
  };

  const doneCount = files.filter(f => f.status === "done").length;
  const errorCount = files.filter(f => f.status === "error").length;
  const idleCount = files.filter(f => f.status === "idle").length;
  const isPlatformParser = ["amazon", "flipkart", "meesho"].includes(marketplace.toLowerCase());

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate("/scan-invoices")} className="text-muted-foreground hover:text-foreground text-sm">← Invoices</button>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-2xl font-bold text-foreground">Upload Invoices</h1>
      </div>

      <div className="bg-card rounded-xl border shadow-sm p-6 space-y-6">
        {/* Marketplace selector — first */}
        <div className="space-y-1.5">
          <Label>Marketplace</Label>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <CreatableCombobox optionsKey="marketplace" value={marketplace} onChange={setMarketplace} placeholder="Select marketplace…" />
            </div>
            {isPlatformParser ? (
              <Badge className="border bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1 shrink-0">
                <Zap className="h-3 w-3" />Instant parser
              </Badge>
            ) : (
              <Badge className="border bg-blue-50 text-blue-600 border-blue-200 flex items-center gap-1 shrink-0">
                <Brain className="h-3 w-3" />AI extraction
              </Badge>
            )}
          </div>
          {isPlatformParser && (
            <p className="text-xs text-emerald-700">PDFs will be parsed instantly in your browser — no rate limits, no waiting</p>
          )}
        </div>

        {/* Drop zone */}
        <div
          onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(Array.from(e.dataTransfer.files)); }}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => inputRef.current?.click()}
          className={cn("border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
            dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30")}
        >
          <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" multiple className="hidden" onChange={e => { if (e.target.files) addFiles(Array.from(e.target.files)); e.target.value = ""; }} />
          <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium text-foreground">Drag & drop multiple files or click to select</p>
          <p className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG — max 10 MB each — multi-page PDFs split automatically</p>
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {files.map(item => (
              <div key={item.id} className="flex items-center gap-3 bg-muted/20 border border-border rounded-lg px-3 py-2">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="flex-1 text-sm text-card-foreground truncate">{item.file.name}</span>
                {item.pageCount && item.pageCount > 1 && (
                  <span className="text-xs text-muted-foreground shrink-0">{item.pageCount}p</span>
                )}
                <span className="text-xs text-muted-foreground shrink-0">{(item.file.size / 1024 / 1024).toFixed(1)} MB</span>
                {item.status === "idle" && (
                  <button onClick={e => { e.stopPropagation(); setFiles(p => p.filter(f => f.id !== item.id)); }} className="text-muted-foreground hover:text-destructive shrink-0">
                    <X className="h-4 w-4" />
                  </button>
                )}
                {(item.status === "uploading" || item.status === "parsing") && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-xs text-muted-foreground">{item.status === "parsing" ? "Parsing…" : "Uploading…"}</span>
                  </div>
                )}
                {item.status === "done" && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    {item.extractionMethod === "parser" && <span className="text-xs text-emerald-600 font-medium">Parsed</span>}
                    {item.extractionMethod === "ai" && <span className="text-xs text-blue-600 font-medium">AI</span>}
                  </div>
                )}
                {item.status === "error" && (
                  <div className="flex items-center gap-1 shrink-0">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <span className="text-xs text-destructive max-w-[120px] truncate">{item.error}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {(doneCount > 0 || errorCount > 0) && !uploading && (
          <div className={cn("text-sm px-3 py-2 rounded-lg border", errorCount > 0 ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-emerald-50 border-emerald-200 text-emerald-700")}>
            {doneCount > 0 && <span>{doneCount} processed successfully</span>}
            {doneCount > 0 && errorCount > 0 && <span className="mx-2">·</span>}
            {errorCount > 0 && <span>{errorCount} failed</span>}
          </div>
        )}

        {/* Credit Sale toggle */}
        <div className="flex items-start gap-3 p-3 border border-border rounded-lg bg-muted/20">
          <button type="button" onClick={() => setIsCreditSale(v => !v)}
            className={cn("mt-0.5 w-10 h-5 rounded-full transition-colors duration-200 flex-shrink-0", isCreditSale ? "bg-primary" : "bg-muted-foreground/30")}>
            <span className={cn("block w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 mx-0.5", isCreditSale ? "translate-x-5" : "translate-x-0")} />
          </button>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Credit Sale</p>
            <p className="text-xs text-muted-foreground">Customer pays later — creates outstanding receivable</p>
          </div>
          {isCreditSale && (
            <select value={creditDays} onChange={e => setCreditDays(Number(e.target.value))}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm shrink-0">
              {[7, 14, 15, 30, 45, 60, 90].map(d => <option key={d} value={d}>{d} days</option>)}
            </select>
          )}
        </div>

        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => navigate("/scan-invoices")} disabled={uploading}>Cancel</Button>
          <div className="flex gap-2">
            {files.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setFiles([])} disabled={uploading} className="text-muted-foreground">Clear all</Button>
            )}
            <Button onClick={uploadAll} disabled={idleCount === 0 || uploading}>
              {uploading
                ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Processing…</>
                : <><Upload className="h-4 w-4 mr-2" />{idleCount > 0 ? `Process ${idleCount} File${idleCount > 1 ? "s" : ""}` : "Process"}</>}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
