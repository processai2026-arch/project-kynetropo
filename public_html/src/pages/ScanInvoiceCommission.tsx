import { useState, useEffect, useRef } from "react";
import { apiFetch } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Upload, FileText, Loader2, CloudUpload, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { CreatableCombobox } from "@/components/ui/creatable-combobox";

interface CommissionInvoice {
  id: number;
  invoice_date: string;
  invoice_number: string;
  platform: string;
  gross_sales: number;
  commission_amount: number;
  tds_amount: number;
  net_settlement: number;
  status?: string;
}

const PLATFORMS = ["amazon", "flipkart", "meesho", "other"];
const TDS_RATES = [
  { label: "0%", value: "0" },
  { label: "1%", value: "1" },
  { label: "2%", value: "2" },
];

const EMPTY_MANUAL = {
  platform: "",
  invoice_number: "",
  invoice_date: "",
  period_from: "",
  period_to: "",
  gross_sales: "",
  commission_rate: "",
  commission_amount: "",
  tds_rate: "0",
  tds_amount: "",
  other_deductions: "",
  net_settlement: "",
  notes: "",
};

export default function ScanInvoiceCommission() {
  const [tab, setTab] = useState<"list" | "upload" | "manual">("list");
  const [items, setItems] = useState<CommissionInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  const [uploadPlatform, setUploadPlatform] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({ ...EMPTY_MANUAL });
  const [saving, setSaving] = useState(false);

  const [sortKey, setSortKey] = useState<string>("invoice_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };
  const resetSort = () => { setSortKey("invoice_date"); setSortDir("desc"); };
  const SortIcon = ({ col }: { col: string }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 text-muted-foreground/40 ml-1 inline" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 text-primary ml-1 inline" /> : <ArrowDown className="h-3 w-3 text-primary ml-1 inline" />;
  };

  const sortedItems = [...items].sort((a, b) => {
    const av = (a as any)[sortKey] ?? "";
    const bv = (b as any)[sortKey] ?? "";
    const numKeys = ["gross_sales", "commission_amount", "tds_amount", "net_settlement"];
    const cmp = numKeys.includes(sortKey) ? Number(av) - Number(bv) : String(av).localeCompare(String(bv));
    return sortDir === "asc" ? cmp : -cmp;
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ data: CommissionInvoice[] }>(
        "/admin/scan-invoices?invoice_type=commission"
      );
      setItems(res.data ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const set = (k: string, v: string) => {
    setForm((f) => {
      const updated = { ...f, [k]: v };
      if (k === "gross_sales" || k === "commission_rate") {
        const g = parseFloat(k === "gross_sales" ? v : f.gross_sales) || 0;
        const r = parseFloat(k === "commission_rate" ? v : f.commission_rate) || 0;
        const comm = ((g * r) / 100).toFixed(2);
        updated.commission_amount = comm;
      }
      if (k === "commission_amount" || k === "tds_rate" || k === "other_deductions" || k === "gross_sales" || k === "commission_rate") {
        const gross = parseFloat(k === "gross_sales" ? v : f.gross_sales) || 0;
        const comm = parseFloat(updated.commission_amount) || 0;
        const tdsR = parseFloat(k === "tds_rate" ? v : f.tds_rate) || 0;
        const tds = ((gross * tdsR) / 100).toFixed(2);
        updated.tds_amount = tds;
        const other = parseFloat(k === "other_deductions" ? v : f.other_deductions) || 0;
        updated.net_settlement = (gross - comm - parseFloat(tds) - other).toFixed(2);
      }
      return updated;
    });
  };

  const totalCommission = items.reduce((s, i) => s + Number(i.commission_amount || 0), 0);
  const totalTds = items.reduce((s, i) => s + Number(i.tds_amount || 0), 0);
  const totalNet = items.reduce((s, i) => s + Number(i.net_settlement || 0), 0);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) setUploadFile(f);
  };

  const handleUpload = async () => {
    if (!uploadFile) { toast.error("Select a file first"); return; }
    if (!uploadPlatform) { toast.error("Select a platform"); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      fd.append("platform", uploadPlatform);
      fd.append("invoice_type", "commission");
      await apiFetch("/admin/scan-invoices/upload", { method: "POST", body: fd });
      toast.success("File uploaded successfully");
      setUploadFile(null);
      setUploadPlatform("");
      load();
      setTab("list");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.platform) { toast.error("Platform is required"); return; }
    if (!form.invoice_number?.trim()) { toast.error("Invoice number is required"); return; }
    if (!form.invoice_date) { toast.error("Invoice date is required"); return; }
    setSaving(true);
    try {
      await apiFetch("/admin/scan-invoices/manual", {
        method: "POST",
        body: JSON.stringify({ ...form, invoice_type: "commission" }),
      });
      toast.success("Invoice saved");
      setForm({ ...EMPTY_MANUAL });
      load();
      setTab("list");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const fmt = (n: number) =>
    "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Commission Invoices</h1>
        {sortKey !== "invoice_date" && (
          <Button variant="outline" size="sm" onClick={resetSort} className="text-xs">
            <RefreshCw className="h-3 w-3 mr-1" />Reset Sort
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Commission" value={fmt(totalCommission)} subtitle="All platforms" icon={FileText} subtitleColor="muted" />
        <StatCard title="Total TDS" value={fmt(totalTds)} subtitle="Deducted at source" icon={FileText} subtitleColor="muted" />
        <StatCard title="Net Settlement" value={fmt(totalNet)} subtitle="After all deductions" icon={FileText} subtitleColor="primary" />
      </div>

      <div className="bg-card rounded-xl border shadow-sm">
        <div className="flex gap-1 p-4 border-b">
          {(["list", "upload", "manual"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
                tab === t
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {t === "list" ? "Invoices" : t === "upload" ? "Upload" : "Manual Entry"}
            </button>
          ))}
        </div>

        {tab === "list" && (
          <div className="p-4">
            <div className="overflow-x-auto eco-float-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th onClick={() => handleSort("invoice_date")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">Date<SortIcon col="invoice_date" /></th>
                    <th onClick={() => handleSort("invoice_number")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">Invoice #<SortIcon col="invoice_number" /></th>
                    <th onClick={() => handleSort("platform")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">Platform<SortIcon col="platform" /></th>
                    <th onClick={() => handleSort("gross_sales")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">Gross Sales<SortIcon col="gross_sales" /></th>
                    <th onClick={() => handleSort("commission_amount")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">Commission<SortIcon col="commission_amount" /></th>
                    <th onClick={() => handleSort("tds_amount")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">TDS<SortIcon col="tds_amount" /></th>
                    <th onClick={() => handleSort("net_settlement")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">Net Settlement<SortIcon col="net_settlement" /></th>
                  </tr>
                </thead>
                <tbody>
                  {loading && Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      {Array.from({ length: 7 }).map((__, j) => (
                        <td key={j} className="py-3 px-4"><Skeleton className="h-4 w-24" /></td>
                      ))}
                    </tr>
                  ))}
                  {!loading && sortedItems.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground text-sm">No commission invoices found</td>
                    </tr>
                  )}
                  {!loading && sortedItems.map((item) => (
                    <tr key={item.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 text-card-foreground whitespace-nowrap">{item.invoice_date}</td>
                      <td className="py-3 px-4 text-card-foreground font-mono text-xs">{item.invoice_number}</td>
                      <td className="py-3 px-4">
                        <Badge className="border capitalize bg-blue-50 text-blue-600 border-blue-200">{item.platform}</Badge>
                      </td>
                      <td className="py-3 px-4 text-card-foreground text-right">{fmt(Number(item.gross_sales))}</td>
                      <td className="py-3 px-4 text-card-foreground text-right">{fmt(Number(item.commission_amount))}</td>
                      <td className="py-3 px-4 text-card-foreground text-right">{fmt(Number(item.tds_amount))}</td>
                      <td className="py-3 px-4 text-card-foreground text-right font-medium">{fmt(Number(item.net_settlement))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "upload" && (
          <div className="p-6 space-y-4 max-w-lg">
            <div className="space-y-1.5">
              <Label>Platform</Label>
              <CreatableCombobox optionsKey="marketplace" value={uploadPlatform} onChange={setUploadPlatform} placeholder="Select platform…" />
            </div>
            <div
              className={cn(
                "border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors",
                dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              )}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <CloudUpload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              {uploadFile ? (
                <p className="text-sm text-foreground font-medium">{uploadFile.name}</p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">Drag & drop or click to select</p>
                  <p className="text-xs text-muted-foreground mt-1">PDF, Excel, CSV supported</p>
                </>
              )}
              <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.xls,.xlsx,.csv" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} />
            </div>
            <Button onClick={handleUpload} disabled={uploading || !uploadFile || !uploadPlatform}>
              {uploading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Uploading…</> : <><Upload className="h-4 w-4 mr-2" />Upload Invoice</>}
            </Button>
          </div>
        )}

        {tab === "manual" && (
          <form onSubmit={handleManualSubmit} className="p-6 space-y-4 max-w-2xl">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Platform *</Label>
                <CreatableCombobox optionsKey="marketplace" value={form.platform} onChange={(v) => set("platform", v)} placeholder="Select platform…" />
              </div>
              <div className="space-y-1.5">
                <Label>Invoice Number *</Label>
                <Input value={form.invoice_number} onChange={(e) => set("invoice_number", e.target.value)} placeholder="INV-001" />
              </div>
              <div className="space-y-1.5">
                <Label>Invoice Date *</Label>
                <Input type="date" value={form.invoice_date} onChange={(e) => set("invoice_date", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Period From</Label>
                <Input type="date" value={form.period_from} onChange={(e) => set("period_from", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Period To</Label>
                <Input type="date" value={form.period_to} onChange={(e) => set("period_to", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Gross Sales (₹)</Label>
                <Input type="number" value={form.gross_sales} onChange={(e) => set("gross_sales", e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <Label>Commission Rate (%)</Label>
                <Input type="number" value={form.commission_rate} onChange={(e) => set("commission_rate", e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <Label>Commission Amount (₹)</Label>
                <Input type="number" value={form.commission_amount} onChange={(e) => set("commission_amount", e.target.value)} placeholder="Auto-calculated" />
              </div>
              <div className="space-y-1.5">
                <Label>TDS Rate</Label>
                <Select value={form.tds_rate} onValueChange={(v) => set("tds_rate", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TDS_RATES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>TDS Amount (₹)</Label>
                <Input type="number" value={form.tds_amount} onChange={(e) => set("tds_amount", e.target.value)} placeholder="Auto-calculated" />
              </div>
              <div className="space-y-1.5">
                <Label>Other Deductions (₹)</Label>
                <Input type="number" value={form.other_deductions} onChange={(e) => set("other_deductions", e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <Label>Net Settlement (₹)</Label>
                <Input type="number" value={form.net_settlement} onChange={(e) => set("net_settlement", e.target.value)} placeholder="Auto-calculated" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Optional notes" />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</> : "Save Invoice"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setForm({ ...EMPTY_MANUAL })}>Reset</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
