import { useState, useEffect, useRef } from "react";
import { apiFetch } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Loader2, Package, AlertTriangle, Upload, FileText, X, CheckCircle, AlertCircle, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { CreatableCombobox } from "@/components/ui/creatable-combobox";
import { Label } from "@/components/ui/label";

interface DamagedSummary {
  total_damaged_units: number;
  total_damaged_value: number;
  total_value_at_cost?: number;
  product_count: number;
}

interface DamagedItem {
  id: number;
  sku: string;
  product_name: string;
  category: string;
  damaged_qty: number;
  cost_price: number;
  total_value: number;
  status: string;
}

interface FileItem { id: string; file: File; status: "idle" | "uploading" | "done" | "error"; }

export default function InvoiceDamaged() {
  const [summary, setSummary] = useState<DamagedSummary | null>(null);
  const [items, setItems] = useState<DamagedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<string>("created_at");
  const [sortDir, setSortDir] = useState<"asc"|"desc">("desc");
  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };
  const resetSort = () => { setSortKey("created_at"); setSortDir("desc"); };
  const SortIcon = ({ col }: { col: string }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 text-muted-foreground/40 ml-1 inline" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 text-primary ml-1 inline" /> : <ArrowDown className="h-3 w-3 text-primary ml-1 inline" />;
  };
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [writingOff, setWritingOff] = useState<number | null>(null);

  // Upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadFiles, setUploadFiles] = useState<FileItem[]>([]);
  const [marketplace, setMarketplace] = useState("amazon");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [sumRes, listRes] = await Promise.all([
        apiFetch<{ data: DamagedSummary }>("/admin/damaged-stock/summary").catch(() => null),
        apiFetch<{ data: DamagedItem[] }>("/admin/damaged-stock").catch(() => null),
      ]);
      setSummary(sumRes?.data ?? null);
      setItems(listRes?.data ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const addFiles = (newFiles: File[]) => {
    const valid = newFiles.filter(f => ["application/pdf","image/jpeg","image/jpg","image/png"].includes(f.type));
    if (valid.length < newFiles.length) toast.error("Only PDF, JPG, PNG accepted");
    setUploadFiles(prev => [...prev, ...valid.map(f => ({ id: Math.random().toString(36).slice(2), file: f, status: "idle" as const }))]);
  };

  const processUploads = async () => {
    const pending2 = uploadFiles.filter(f => f.status === "idle");
    if (!pending2.length) return;
    setUploading(true);
    const raw = localStorage.getItem("erp_admin_auth");
    const token = raw ? JSON.parse(raw).token ?? "" : "";
    for (const item of pending2) {
      setUploadFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: "uploading" } : f));
      try {
        const fd = new FormData();
        fd.append("file", item.file);
        fd.append("marketplace", marketplace);
        fd.append("invoice_type", "return");
        fd.append("is_damaged", "1");
        const r = await fetch(`${import.meta.env.VITE_API_BASE_URL}/admin/scan-invoices/upload`, {
          method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd,
        });
        const json = await r.json();
        if (!json.success) throw new Error(json.message);
        const invoiceId = json.data?.invoice_id ?? json.data?.invoice_ids?.[0];
        // Auto-approve immediately
        const ar = await fetch(`${import.meta.env.VITE_API_BASE_URL}/admin/scan-invoices/${invoiceId}/approve`, {
          method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: "{}",
        });
        const aj = await ar.json();
        if (!aj.success) throw new Error(aj.message ?? "Approve failed");
        setUploadFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: "done" } : f));
        toast.success("Processed — added to Damaged Goods");
      } catch (err) {
        setUploadFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: "error" } : f));
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    }
    setUploading(false);
    load();
  };

  const handleWriteOff = async (id: number) => {
    setWritingOff(id);
    try {
      await apiFetch(`/admin/damaged-stock/${id}/write-off`, { method: "POST" });
      toast.success("Item written off successfully");
      setConfirmId(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Write-off failed");
    } finally {
      setWritingOff(null);
    }
  };

  const fmt = (n: number) =>
    "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Damaged Goods</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard title="Total Damaged Units"
          value={loading ? "—" : String(summary?.total_damaged_units ?? items.reduce((s, i) => s + Number(i.damaged_qty), 0))}
          subtitle="Across all SKUs" icon={Package} subtitleColor="muted" />
        <StatCard title="Total Value at Cost"
          value={loading ? "—" : fmt(summary?.total_damaged_value ?? summary?.total_value_at_cost ?? items.reduce((s, i) => s + Number(i.total_value), 0))}
          subtitle="Cost price basis" icon={AlertTriangle} subtitleColor="muted" />
      </div>

      {/* Upload damaged invoice */}
      <div className="bg-card rounded-xl border shadow-sm p-5 space-y-4">
        <h2 className="text-base font-semibold text-card-foreground">Upload Damaged Invoice</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
          <div className="space-y-1.5">
            <Label>Marketplace</Label>
            <CreatableCombobox optionsKey="marketplace" value={marketplace} onChange={setMarketplace} placeholder="Select marketplace…" />
          </div>
          <div
            onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(Array.from(e.dataTransfer.files)); }}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileInputRef.current?.click()}
            className={cn("border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors",
              dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30")}
          >
            <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" multiple className="hidden"
              onChange={e => { if (e.target.files) addFiles(Array.from(e.target.files)); e.target.value = ""; }} />
            <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">Drop files or click — PDF, JPG, PNG</p>
          </div>
        </div>

        {uploadFiles.length > 0 && (
          <div className="space-y-1.5">
            {uploadFiles.map(item => (
              <div key={item.id} className="flex items-center gap-3 bg-muted/20 border rounded-lg px-3 py-2">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="flex-1 text-sm text-card-foreground truncate">{item.file.name}</span>
                {item.status === "idle" && <button onClick={() => setUploadFiles(p => p.filter(f => f.id !== item.id))}><X className="h-4 w-4 text-muted-foreground hover:text-destructive" /></button>}
                {item.status === "uploading" && <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />}
                {item.status === "done" && <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />}
                {item.status === "error" && <AlertCircle className="h-4 w-4 text-destructive shrink-0" />}
              </div>
            ))}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setUploadFiles([])} disabled={uploading}>Clear</Button>
              <Button onClick={processUploads} disabled={uploading || !uploadFiles.some(f => f.status === "idle")}>
                {uploading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Processing…</> : <><Upload className="h-4 w-4 mr-2" />Process {uploadFiles.filter(f => f.status === "idle").length} File(s)</>}
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-base font-semibold text-card-foreground">Damaged Stock Items</h2>
          {(sortKey !== "created_at" || sortDir !== "desc") && (
            <Button variant="outline" size="sm" onClick={resetSort} className="text-xs">
              <RefreshCw className="h-3 w-3 mr-1" />Reset Sort
            </Button>
          )}
        </div>
        <div className="p-4">
          <div className="overflow-x-auto eco-float-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th onClick={() => handleSort("sku")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">SKU<SortIcon col="sku" /></th>
                  <th onClick={() => handleSort("product_name")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">Product Name<SortIcon col="product_name" /></th>
                  <th onClick={() => handleSort("category")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">Category<SortIcon col="category" /></th>
                  <th onClick={() => handleSort("damaged_qty")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">Damaged Qty<SortIcon col="damaged_qty" /></th>
                  <th onClick={() => handleSort("cost_price")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">Cost Price<SortIcon col="cost_price" /></th>
                  <th onClick={() => handleSort("total_value")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">Total Value<SortIcon col="total_value" /></th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap"></th>
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="py-3 px-4"><Skeleton className="h-4 w-20" /></td>
                    ))}
                  </tr>
                ))}
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground text-sm">
                      No damaged stock yet — approve a damaged return invoice to populate this list
                    </td>
                  </tr>
                )}
                {!loading && [...items].sort((a, b) => {
                  const av = (a as any)[sortKey] ?? "";
                  const bv = (b as any)[sortKey] ?? "";
                  const numKeys = ["total_amount","tax_amount","amount","lifetime_revenue","current_stock","damaged_stock","net_revenue","salary","balance_amount","damaged_qty","cost_price","total_value"];
                  const cmp = numKeys.includes(sortKey) ? Number(av) - Number(bv) : String(av).localeCompare(String(bv));
                  return sortDir === "asc" ? cmp : -cmp;
                }).map((item) => (
                  <tr key={item.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 text-card-foreground font-mono text-xs">{item.sku}</td>
                    <td className="py-3 px-4 text-card-foreground font-medium">{item.product_name}</td>
                    <td className="py-3 px-4 text-card-foreground">{item.category}</td>
                    <td className="py-3 px-4">
                      <Badge className="border bg-red-50 text-red-600 border-red-200">{item.damaged_qty} units</Badge>
                    </td>
                    <td className="py-3 px-4 text-card-foreground text-right">{fmt(Number(item.cost_price))}</td>
                    <td className="py-3 px-4 text-card-foreground text-right font-medium">{fmt(Number(item.total_value))}</td>
                    <td className="py-3 px-4">
                      {item.status !== "written_off" && confirmId !== item.id && (
                        <Button size="sm" variant="outline"
                          className="text-destructive border-destructive/30 hover:bg-destructive/5"
                          onClick={() => setConfirmId(item.id)}>
                          Write Off
                        </Button>
                      )}
                      {confirmId === item.id && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Are you sure?</span>
                          <Button size="sm" variant="destructive" disabled={writingOff === item.id} onClick={() => handleWriteOff(item.id)}>
                            {writingOff === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirm"}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>Cancel</Button>
                        </div>
                      )}
                      {item.status === "written_off" && (
                        <Badge className={cn("border", "bg-gray-100 text-gray-500 border-gray-200")}>Written Off</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

interface DamagedSummary {
  total_damaged_units: number;
  total_damaged_value: number;   // returned by updated controller
  total_value_at_cost?: number;  // legacy fallback
  product_count: number;
}

interface DamagedItem {
  id: number;
  sku: string;
  product_name: string;
  category: string;
  damaged_qty: number;
  cost_price: number;
  total_value: number;
  status: string;
}
