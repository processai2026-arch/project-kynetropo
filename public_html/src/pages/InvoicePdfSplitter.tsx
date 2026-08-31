import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import { Scissors, Upload, Download, Loader2, AlertCircle, RefreshCw, RotateCcw, CheckCircle, X, FileText, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { CreatableCombobox } from "@/components/ui/creatable-combobox";

type SplitMode = "crop" | "alternate"; // crop = sticker+invoice on same page; alternate = odd=sticker, even=invoice

interface Box { x: number; y: number; w: number; h: number; }

interface SavedTemplate {
  stickerBox: Box;
  invoiceBox: Box;
  pdfWidth: number;
  pdfHeight: number;
  imgWidth: number;
  imgHeight: number;
}

interface PreviewData {
  preview_url: string;
  page_count: number;
  pdf_width: number;
  pdf_height: number;
  img_width: number;
  img_height: number;
}

interface FileItem {
  id: string;
  file: File;
  status: "idle" | "processing" | "done" | "error";
  error?: string;
}

type DrawMode = "sticker" | "invoice" | null;

const STORAGE_KEY = "pdf_splitter_templates";

function loadTemplates(): Record<string, SavedTemplate> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
}
function saveTemplate(marketplace: string, tpl: SavedTemplate) {
  const all = loadTemplates();
  all[marketplace] = tpl;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}
function deleteTemplate(marketplace: string) {
  const all = loadTemplates();
  delete all[marketplace];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export default function InvoicePdfSplitter() {
  const navigate = useNavigate();
  const previewInputRef = useRef<HTMLInputElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const [marketplace, setMarketplace] = useState("amazon");
  const [splitMode, setSplitMode] = useState<SplitMode>("alternate"); // amazon default = alternate
  const [template, setTemplate] = useState<SavedTemplate | null>(() => loadTemplates()["amazon"] ?? null);

  // Preview / crop state
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [drawMode, setDrawMode] = useState<DrawMode>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [stickerBox, setStickerBox] = useState<Box | null>(null);
  const [invoiceBox, setInvoiceBox] = useState<Box | null>(null);
  const [liveBox, setLiveBox] = useState<Box | null>(null);

  // Batch upload state
  const [files, setFiles] = useState<FileItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [combinedResult, setCombinedResult] = useState<{
    stickersBlob: Blob; invoicesBlob: Blob; pageCount: number; fileCount: number;
  } | null>(null);

  const getToken = () => {
    const raw = localStorage.getItem("erp_admin_auth");
    return raw ? JSON.parse(raw).token ?? "" : "";
  };

  // When marketplace changes, load its saved template
  const handleMarketplaceChange = (mp: string) => {
    setMarketplace(mp);
    // Amazon: sticker and invoice on alternating pages → alternate mode
    // Flipkart/Meesho: both on same page → crop mode
    setSplitMode(mp === "amazon" ? "alternate" : "crop");
    const saved = loadTemplates()[mp] ?? null;
    setTemplate(saved);
    setStickerBox(null); setInvoiceBox(null); setPreview(null); setDrawMode(null);
  };

  // Upload PDF for preview/crop
  const uploadForPreview = useCallback(async (f: File) => {
    if (f.type !== "application/pdf") { toast.error("Please select a PDF file"); return; }
    setLoadingPreview(true); setPreview(null); setStickerBox(null); setInvoiceBox(null);
    try {
      const fd = new FormData(); fd.append("file", f);
      const r = await fetch(`${import.meta.env.VITE_API_BASE_URL}/admin/pdf-splitter/preview`, {
        method: "POST", headers: { Authorization: `Bearer ${getToken()}` }, body: fd,
      });
      const json = await r.json();
      if (!json.success) throw new Error(json.message || "Preview failed");
      setPreview(json.data);
      setDrawMode("sticker");
      toast.success("PDF loaded — draw the Sticker box first");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load preview");
    } finally { setLoadingPreview(false); }
  }, []);

  const toImgCoords = (e: React.MouseEvent) => {
    const rect = imgRef.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(e.clientX - rect.left, rect.width)),
      y: Math.max(0, Math.min(e.clientY - rect.top, rect.height)),
    };
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (!drawMode || !imgRef.current) return;
    e.preventDefault();
    const { x, y } = toImgCoords(e);
    setDragStart({ x, y }); setLiveBox({ x, y, w: 0, h: 0 });
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragStart || !drawMode || !imgRef.current) return;
    const { x, y } = toImgCoords(e);
    setLiveBox({ x: Math.min(dragStart.x, x), y: Math.min(dragStart.y, y), w: Math.abs(x - dragStart.x), h: Math.abs(y - dragStart.y) });
  };
  const onMouseUp = (e: React.MouseEvent) => {
    if (!dragStart || !drawMode || !imgRef.current) return;
    const { x, y } = toImgCoords(e);
    const box = { x: Math.min(dragStart.x, x), y: Math.min(dragStart.y, y), w: Math.abs(x - dragStart.x), h: Math.abs(y - dragStart.y) };
    setDragStart(null); setLiveBox(null);
    if (box.w < 10 || box.h < 10) return;
    if (drawMode === "sticker") { setStickerBox(box); setDrawMode("invoice"); }
    else { setInvoiceBox(box); setDrawMode(null); }
  };

  const saveCurrentTemplate = () => {
    if (!stickerBox || !invoiceBox || !preview) return;
    const rect = imgRef.current!.getBoundingClientRect();
    const scaleX = preview.pdf_width / rect.width;
    const scaleY = preview.pdf_height / rect.height;
    const toPdfCoords = (box: Box) => ({
      x: box.x * scaleX, y: box.y * scaleY, w: box.w * scaleX, h: box.h * scaleY,
    });
    const tpl: SavedTemplate = {
      stickerBox: toPdfCoords(stickerBox),
      invoiceBox: toPdfCoords(invoiceBox),
      pdfWidth: preview.pdf_width,
      pdfHeight: preview.pdf_height,
      imgWidth: preview.img_width,
      imgHeight: preview.img_height,
    };
    saveTemplate(marketplace, tpl);
    setTemplate(tpl);
    toast.success(`Crop saved for ${marketplace} — all uploads will use this automatically`);
  };

  const resetTemplate = () => {
    deleteTemplate(marketplace);
    setTemplate(null);
    setStickerBox(null); setInvoiceBox(null); setPreview(null); setDrawMode(null);
    toast.success(`Crop reset for ${marketplace}`);
  };

  // Split a single file using saved template coordinates


  const processAll = async () => {
    if (splitMode === "crop" && !template) { toast.error("Draw and save crop boxes first"); return; }
    // Reset done/error files back to idle so they reprocess
    setFiles(prev => prev.map(f => f.status !== "processing" ? { ...f, status: "idle" } : f));
    const pending = files.filter(f => f.status !== "processing");
    if (!pending.length) { toast.error("No files to process"); return; }
    setProcessing(true);

    try {
      const { PDFDocument } = await import("pdf-lib");
      const stickersDoc = await PDFDocument.create();
      const invoicesDoc = await PDFDocument.create();

      for (const item of pending) {
        setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: "processing" } : f));
        try {
          const srcBytes = await item.file.arrayBuffer();
          const srcDoc = await PDFDocument.load(srcBytes);
          const n = srcDoc.getPageCount();

          if (splitMode === "alternate") {
            // Amazon: odd pages (0-indexed: 0,2,4...) = stickers, even pages (1,3,5...) = invoices
            for (let i = 0; i < n; i++) {
              if (i % 2 === 0) {
                const [sp] = await stickersDoc.copyPages(srcDoc, [i]);
                stickersDoc.addPage(sp);
              } else {
                const [ip] = await invoicesDoc.copyPages(srcDoc, [i]);
                invoicesDoc.addPage(ip);
              }
            }
          } else {
            // Crop mode: Flipkart/Meesho — same page, crop top/bottom
            const tpl = template!;
            const { stickerBox: sb, invoiceBox: ib, pdfHeight } = tpl;
            const s  = { x: sb.x, pdfY: pdfHeight - (sb.y + sb.h), w: sb.w, h: sb.h };
            const iv = { x: ib.x, pdfY: pdfHeight - (ib.y + ib.h), w: ib.w, h: ib.h };

            for (let i = 0; i < n; i++) {
              const [sp] = await stickersDoc.copyPages(srcDoc, [i]);
              sp.setMediaBox(s.x, s.pdfY, s.x + s.w, s.pdfY + s.h);
              sp.setCropBox(s.x, s.pdfY, s.x + s.w, s.pdfY + s.h);
              sp.setSize(s.w, s.h);
              stickersDoc.addPage(sp);

              const [ip] = await invoicesDoc.copyPages(srcDoc, [i]);
              ip.setMediaBox(iv.x, iv.pdfY, iv.x + iv.w, iv.pdfY + iv.h);
              ip.setCropBox(iv.x, iv.pdfY, iv.x + iv.w, iv.pdfY + iv.h);
              ip.setSize(iv.w, iv.h);
              invoicesDoc.addPage(ip);
            }
          }

          setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: "done" } : f));
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Failed";
          setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: "error", error: msg } : f));
          toast.error(`${item.file.name}: ${msg}`);
        }
      }

      const sBytes = await stickersDoc.save();
      const iBytes = await invoicesDoc.save();
      const totalPages = stickersDoc.getPageCount();

      setCombinedResult({
        stickersBlob: new Blob([sBytes], { type: "application/pdf" }),
        invoicesBlob: new Blob([iBytes], { type: "application/pdf" }),
        pageCount: totalPages,
        fileCount: pending.length,
      });
      toast.success(`Done — ${pending.length} PDF${pending.length > 1 ? "s" : ""} split (${totalPages} pages each)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Processing failed");
    }
    setProcessing(false);
  };

  const download = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const addFiles = (newFiles: File[]) => {
    const valid = newFiles.filter(f => f.type === "application/pdf");
    if (valid.length < newFiles.length) toast.error("Only PDF files accepted");
    setFiles(prev => [...prev, ...valid.map(f => ({ id: Math.random().toString(36).slice(2), file: f, status: "idle" as const }))]);
  };

  const BoxOverlay = ({ box, color, label }: { box: Box; color: "blue" | "amber"; label: string }) => (
    <div className={cn("absolute border-2 pointer-events-none", color === "blue" ? "border-blue-500 bg-blue-400/10" : "border-amber-500 bg-amber-400/10")}
      style={{ left: box.x, top: box.y, width: box.w, height: box.h }}>
      <span className={cn("absolute top-1 left-1 text-[10px] font-bold px-1.5 py-0.5 rounded", color === "blue" ? "bg-blue-500 text-white" : "bg-amber-500 text-white")}>{label}</span>
    </div>
  );

  const hasSavedBoxes = !!template;
  const canProcess = (splitMode === "alternate" || hasSavedBoxes) && files.some(f => f.status === "idle");

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate("/scan-invoices")} className="text-muted-foreground hover:text-foreground text-sm">← Invoices</button>
        <span className="text-muted-foreground">/</span>
        <Scissors className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">PDF Splitter</h1>
      </div>

      {/* Step 1: Select marketplace */}
      <div className="bg-card rounded-xl border shadow-sm p-5 space-y-4">
        <h2 className="text-base font-semibold text-card-foreground">1. Select Marketplace & Split Mode</h2>
        <div className="flex items-end gap-4 flex-wrap">
          <div className="space-y-1.5 w-56">
            <Label>Marketplace</Label>
            <CreatableCombobox optionsKey="marketplace" value={marketplace} onChange={handleMarketplaceChange} placeholder="Select marketplace…" />
          </div>
          <div className="space-y-1.5">
            <Label>Split Mode</Label>
            <div className="flex gap-2">
              <button onClick={() => setSplitMode("alternate")}
                className={cn("flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors",
                  splitMode === "alternate" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50")}>
                <Layers className="h-3.5 w-3.5" />Alternate Pages
              </button>
              <button onClick={() => setSplitMode("crop")}
                className={cn("flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors",
                  splitMode === "crop" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50")}>
                <Scissors className="h-3.5 w-3.5" />Crop Same Page
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {splitMode === "alternate"
                ? "Amazon: odd pages = stickers, even pages = invoices"
                : "Flipkart/Meesho: top half = sticker, bottom half = invoice"}
            </p>
          </div>
          {hasSavedBoxes ? (            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-700">
                <CheckCircle className="h-3.5 w-3.5" />Crop saved for {marketplace}
              </div>
              <Button variant="outline" size="sm" onClick={resetTemplate} className="text-destructive hover:text-destructive border-destructive/30">
                <RotateCcw className="h-3.5 w-3.5 mr-1" />Reset
              </Button>
            </div>
          ) : (
            splitMode === "crop" ? <p className="text-xs text-amber-600 font-medium">⚠ No crop saved for {marketplace} — draw boxes below first</p> : null
          )}
        </div>
      </div>

      {/* Step 2: Setup crop (only shown if crop mode and no template saved) */}
      {splitMode === "crop" && !hasSavedBoxes && (
        <div className="bg-card rounded-xl border shadow-sm p-5 space-y-4">
          <h2 className="text-base font-semibold text-card-foreground">2. Set Crop Template for {marketplace}</h2>
          <p className="text-xs text-muted-foreground">Upload one PDF to define where the sticker and invoice are. This is saved once per marketplace.</p>

          {!preview && (
            <div onClick={() => previewInputRef.current?.click()}
              className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
              <input ref={previewInputRef} type="file" accept="application/pdf" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadForPreview(f); e.target.value = ""; }} />
              {loadingPreview
                ? <div className="flex items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Rendering first page…</div>
                : <><Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" /><p className="text-sm text-muted-foreground">Upload a sample PDF to draw crop boxes</p></>}
            </div>
          )}

          {preview && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium">Draw:</span>
                <button onClick={() => setDrawMode(d => d === "sticker" ? null : "sticker")}
                  className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors",
                    drawMode === "sticker" ? "bg-blue-600 text-white border-blue-600" : stickerBox ? "bg-blue-50 text-blue-700 border-blue-300" : "bg-card text-card-foreground border-border hover:border-blue-400")}>
                  {stickerBox ? "✓ " : "1. "}📦 Sticker Box {drawMode === "sticker" && <span className="animate-pulse">●</span>}
                </button>
                <button onClick={() => setDrawMode(d => d === "invoice" ? null : "invoice")}
                  className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors",
                    drawMode === "invoice" ? "bg-amber-500 text-white border-amber-500" : invoiceBox ? "bg-amber-50 text-amber-700 border-amber-300" : "bg-card text-card-foreground border-border hover:border-amber-400")}>
                  {invoiceBox ? "✓ " : "2. "}🧾 Invoice Box {drawMode === "invoice" && <span className="animate-pulse">●</span>}
                </button>
                {(stickerBox || invoiceBox) && (
                  <button onClick={() => { setStickerBox(null); setInvoiceBox(null); setDrawMode("sticker"); }}
                    className="flex items-center gap-1 px-2 py-1.5 rounded-lg border text-xs text-muted-foreground hover:text-destructive hover:border-destructive">
                    <RotateCcw className="h-3 w-3" />Redraw
                  </button>
                )}
                <Button size="sm" variant="outline" onClick={() => { setPreview(null); setStickerBox(null); setInvoiceBox(null); }}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />Change PDF
                </Button>
              </div>

              <div className={cn("relative border border-border rounded-lg overflow-hidden select-none", drawMode ? "cursor-crosshair" : "cursor-default")}
                onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>
                <img ref={imgRef} src={preview.preview_url} alt="PDF preview" className="w-full block" draggable={false} />
                {stickerBox && <BoxOverlay box={stickerBox} color="blue" label="Sticker" />}
                {invoiceBox && <BoxOverlay box={invoiceBox} color="amber" label="Invoice" />}
                {liveBox && liveBox.w > 4 && liveBox.h > 4 && <BoxOverlay box={liveBox} color={drawMode === "sticker" ? "blue" : "amber"} label={drawMode === "sticker" ? "Sticker" : "Invoice"} />}
              </div>

              {stickerBox && invoiceBox && (
                <Button onClick={saveCurrentTemplate} className="w-full">
                  <CheckCircle className="h-4 w-4 mr-2" />Save Crop Template for {marketplace}
                </Button>
              )}
              {(!stickerBox || !invoiceBox) && (
                <p className="text-xs text-center text-muted-foreground">{!stickerBox ? "Draw the Sticker box first" : "Now draw the Invoice box"}</p>
              )}
            </>
          )}
        </div>
      )}

      {/* Step 3: Upload PDFs to split */}
      <div className="bg-card rounded-xl border shadow-sm p-5 space-y-4">
        <h2 className="text-base font-semibold text-card-foreground">{hasSavedBoxes || splitMode === "alternate" ? "2." : "3."} Upload PDFs to Split</h2>
        {splitMode === "crop" && !hasSavedBoxes && <p className="text-xs text-amber-600">Save the crop template above first</p>}

        <div onClick={() => (splitMode === "alternate" || hasSavedBoxes) && batchInputRef.current?.click()}
          className={cn("border-2 border-dashed rounded-xl p-6 text-center transition-colors",
            (splitMode === "alternate" || hasSavedBoxes) ? "cursor-pointer hover:border-primary/50 hover:bg-muted/30" : "opacity-40 cursor-not-allowed")}>
          <input ref={batchInputRef} type="file" accept="application/pdf" multiple className="hidden"
            onChange={e => { if (e.target.files) addFiles(Array.from(e.target.files)); e.target.value = ""; }} />
          <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Click to select PDFs for {marketplace}</p>
          <p className="text-xs text-muted-foreground">Multiple files supported — all use the saved crop</p>
        </div>

        {files.length > 0 && (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {files.map(item => (
              <div key={item.id} className="flex items-center gap-3 bg-muted/20 border rounded-lg px-3 py-2">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="flex-1 text-sm text-card-foreground truncate">{item.file.name}</span>
                <span className="text-xs text-muted-foreground">{(item.file.size/1024/1024).toFixed(1)}MB</span>
                {item.status === "idle" && <button onClick={() => setFiles(p => p.filter(f => f.id !== item.id))}><X className="h-4 w-4 text-muted-foreground hover:text-destructive" /></button>}
                {item.status === "processing" && <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />}
                {item.status === "done" && <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />}
                {item.status === "error" && <span className="text-xs text-destructive shrink-0">{item.error}</span>}
              </div>
            ))}
          </div>
        )}

        {files.length > 0 && (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setFiles([]); setCombinedResult(null); }} disabled={processing} className="text-muted-foreground">Clear all</Button>
            <Button onClick={processAll} disabled={!canProcess || processing} className="flex-1">
              {processing
                ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Processing…</>
                : <><Scissors className="h-4 w-4 mr-2" />Split & Combine {files.filter(f => f.status === "idle").length || files.length} PDF{(files.filter(f => f.status === "idle").length || files.length) !== 1 ? "s" : ""}</>}
            </Button>
          </div>
        )}

        {/* Combined download result */}
        {combinedResult && (
          <div className="border border-emerald-200 bg-emerald-50 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-emerald-800">
              ✓ {combinedResult.fileCount} PDF{combinedResult.fileCount > 1 ? "s" : ""} combined — {combinedResult.pageCount} pages each
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => download(combinedResult.stickersBlob, `${marketplace}_stickers_combined.pdf`)}
                className="flex items-center gap-3 p-3 rounded-xl border border-blue-200 bg-white hover:bg-blue-50 transition-colors text-left">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                  <Download className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-blue-800 text-xs">All Stickers PDF</p>
                  <p className="text-xs text-blue-500">{combinedResult.pageCount} pages</p>
                </div>
              </button>
              <button onClick={() => download(combinedResult.invoicesBlob, `${marketplace}_invoices_combined.pdf`)}
                className="flex items-center gap-3 p-3 rounded-xl border border-amber-200 bg-white hover:bg-amber-50 transition-colors text-left">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                  <Download className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <p className="font-semibold text-amber-800 text-xs">All Invoices PDF</p>
                  <p className="text-xs text-amber-500">{combinedResult.pageCount} pages</p>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-start gap-2 bg-muted/30 rounded-xl border p-3 text-xs text-muted-foreground">
        <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        PDF splitting runs entirely in your browser. Crop templates are saved locally per marketplace.
      </div>
    </div>
  );
}
