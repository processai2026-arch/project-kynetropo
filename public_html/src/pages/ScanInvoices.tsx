import { useState, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { FileText, Upload, Trash2, Plus, RefreshCw, Zap, Link2, Loader2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/StatCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { CreatableCombobox } from "@/components/ui/creatable-combobox";
import { scanInvoicesApi } from "@/lib/api/scanInvoices";
import { apiFetch } from "@/lib/api/client";
import type { ScanInvoice } from "@/types/scanInvoice";

const STATUS_STYLES: Record<string, string> = {
  pending:    "bg-status-pending/10 text-status-pending border-status-pending/20",
  processing: "bg-status-processing/10 text-status-processing border-status-processing/20",
  review:     "bg-status-processing/10 text-status-processing border-status-processing/20",
  approved:   "bg-status-delivered/10 text-status-delivered border-status-delivered/20",
  rejected:   "bg-status-cancelled/10 text-status-cancelled border-status-cancelled/20",
  error:      "bg-red-50 text-red-600 border-red-200",
};

const MANUAL_EMPTY = { invoice_number: "", invoice_date: "", vendor_name: "", vendor_gstin: "", customer_name: "", marketplace: "other" as const, subtotal: 0, tax_amount: 0, total_amount: 0 };

export default function ScanInvoices() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ScanInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [mpFilter, setMpFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [manualOpen, setManualOpen] = useState(false);
  const [manualForm, setManualForm] = useState(MANUAL_EMPTY);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ScanInvoice | null>(null);
  const [autoApproving, setAutoApproving] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
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

  const load = async () => {
    setLoading(true);
    try {
      // Only show sale/purchase/commission invoices — returns go to Sales Returns page
      const res = await scanInvoicesApi.list({ limit: "200", invoice_type: "sale" });
      setItems(res.data ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load");
    } finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    // Poll for in-progress invoices every 3s via sessionStorage (matches upload page pattern)
    pollingRef.current = setInterval(async () => {
      // Read items from sessionStorage set by upload page
      const stored = sessionStorage.getItem("pendingInvoiceIds");
      if (stored) {
        sessionStorage.removeItem("pendingInvoiceIds");
        load(); // refresh list once IDs are available
      }
    }, 3000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  // Poll server while any invoice is still processing/pending
  useEffect(() => {
    const inProgress = items.some(i => i.processing_status === "processing" || i.processing_status === "pending");
    if (!inProgress) return;
    const t = setTimeout(() => load(), 3000);
    return () => clearTimeout(t);
  }, [items]);

  const filtered = useMemo(() => {
    const f = items.filter(inv => {
      const q = search.toLowerCase();
      const mq = !q || (inv.invoice_number ?? "").toLowerCase().includes(q) || (inv.vendor_name ?? "").toLowerCase().includes(q) || inv.original_filename.toLowerCase().includes(q);
      const mm = mpFilter === "all" || inv.marketplace === mpFilter;
      const ms = statusFilter === "all" || inv.processing_status === statusFilter;
      return mq && mm && ms;
    });
    return [...f].sort((a, b) => {
      const av = (a as any)[sortKey] ?? "";
      const bv = (b as any)[sortKey] ?? "";
      const numKeys = ["total_amount","tax_amount"];
      const cmp = numKeys.includes(sortKey)
        ? Number(av) - Number(bv)
        : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [items, search, mpFilter, statusFilter, sortKey, sortDir]);

  const counts = useMemo(() => ({
    total: items.length,
    approved: items.filter(i => i.processing_status === "approved").length,
    review: items.filter(i => i.processing_status === "review").length,
    error: items.filter(i => i.processing_status === "error").length,
  }), [items]);

  const set = (k: string, v: unknown) => setManualForm(f => ({ ...f, [k]: v }));

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await scanInvoicesApi.storeManual(manualForm);
      toast.success("Invoice created");
      setManualOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await scanInvoicesApi.remove(confirmDelete.invoice_id);
      toast.success("Deleted");
      setConfirmDelete(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const handleAutoApprove = async () => {
    const reviewCount = items.filter(i => i.processing_status === "review").length;
    if (reviewCount === 0) { toast.error("No invoices ready for review"); return; }
    setAutoApproving(true);
    try {
      const res = await apiFetch<{ data: { approved_count: number; skipped_count: number; error_count: number; skipped: Array<{ invoice_id: number; unmapped: string[] }> } }>(
        "/admin/scan-invoices/auto-approve", { method: "POST" }
      );
      const d = res.data;
      if (d.approved_count > 0) toast.success(`✓ ${d.approved_count} invoice${d.approved_count > 1 ? "s" : ""} approved`);
      if (d.skipped_count > 0) toast.warning(`${d.skipped_count} invoice${d.skipped_count > 1 ? "s" : ""} need product mappings`);
      if (d.error_count > 0)   toast.error(`${d.error_count} invoice${d.error_count > 1 ? "s" : ""} failed`);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Auto-approve failed");
    } finally { setAutoApproving(false); }
  };

  // Check if invoice has mapping_required flag in error_message
  const isMappingRequired = (inv: ScanInvoice) => {
    if (inv.processing_status !== "review") return false;
    if (!inv.error_message) return false;
    try {
      const parsed = typeof inv.error_message === "string" ? JSON.parse(inv.error_message) : inv.error_message;
      return !!(parsed as Record<string, unknown>)?.mapping_required;
    } catch { return false; }
  };

  const handleRowClick = (inv: ScanInvoice) => {
    if (inv.processing_status === "processing" || inv.processing_status === "pending") {
      navigate(`/scan-invoices/${inv.invoice_id}/processing`);
    } else if (inv.processing_status === "review") {
      navigate(`/scan-invoices/${inv.invoice_id}/review`);
    } else {
      navigate(`/scan-invoices/${inv.invoice_id}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-foreground">Invoice Scanner</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setManualOpen(true)}><Plus className="h-4 w-4 mr-2" />Manual Entry</Button>
          <Button onClick={() => navigate("/scan-invoices/upload")}><Upload className="h-4 w-4 mr-2" />Upload Invoice</Button>
        </div>
      </div>

      {/* Auto-approve banner when there are review-ready invoices */}
      {items.filter(i => i.processing_status === "review").length > 0 && (
        <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {items.filter(i => i.processing_status === "review").length} invoice{items.filter(i => i.processing_status === "review").length > 1 ? "s" : ""} ready for review
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Auto-approve will skip invoices with unmapped products and show them as "Mapping Required"
            </p>
          </div>
          <Button onClick={handleAutoApprove} disabled={autoApproving} className="shrink-0">
            {autoApproving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
            {autoApproving ? "Approving…" : "Auto-Approve All"}
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard title="Total" value={String(counts.total)} icon={FileText} subtitleColor="muted" />
        <StatCard title="Approved" value={String(counts.approved)} icon={FileText} subtitleColor="primary" />
        <StatCard title="Needs Review" value={String(counts.review)} icon={FileText} subtitleColor="muted" />
        <StatCard title="Errors" value={String(counts.error)} icon={FileText} subtitleColor="muted" />
      </div>

      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-4 border-b flex flex-wrap items-center gap-3">
          <Input placeholder="Search invoice #, vendor, filename…" value={search} onChange={e => setSearch(e.target.value)} className="w-64" />
          <Select value={mpFilter} onValueChange={setMpFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Platform" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              {["amazon","flipkart","meesho","other"].map(m => <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {["pending","processing","review","approved","rejected","error"].map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
          {sortKey !== "created_at" && (
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
                  {([
                    ["Invoice #","invoice_number"],
                    ["Vendor","vendor_name"],
                    ["Invoice Date","invoice_date"],
                    ["Uploaded","created_at"],
                    ["Platform","marketplace"],
                    ["Amount","total_amount"],
                    ["GST","tax_amount"],
                    ["Status","processing_status"],
                  ] as [string,string][]).map(([h,key]) => (
                    <th key={h} onClick={() => handleSort(key)}
                      className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">
                      {h}<SortIcon col={key} />
                    </th>
                  ))}
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">{Array.from({ length: 9 }).map((_, j) => <td key={j} className="py-3 px-4"><Skeleton className="h-4 w-20" /></td>)}</tr>
                ))}
                {!loading && filtered.length === 0 && <tr><td colSpan={9} className="px-6 py-8 text-center text-muted-foreground text-sm">No invoices found</td></tr>}
                {!loading && filtered.map(inv => {
                  const needsMapping = isMappingRequired(inv);
                  return (
                    <tr key={inv.invoice_id} className="border-b hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => handleRowClick(inv)}>
                      <td className="py-3 px-4 font-mono text-xs text-card-foreground">{inv.invoice_number ?? "—"}</td>
                      <td className="py-3 px-4 text-card-foreground max-w-[160px] truncate">{inv.vendor_name ?? inv.original_filename}</td>
                      <td className="py-3 px-4 text-muted-foreground">{inv.invoice_date ?? "—"}</td>
                      <td className="py-3 px-4 text-muted-foreground">{new Date(inv.created_at).toLocaleDateString("en-IN")}</td>
                      <td className="py-3 px-4 capitalize text-card-foreground">{inv.marketplace}</td>
                      <td className="py-3 px-4 text-card-foreground">₹{inv.total_amount.toLocaleString("en-IN")}</td>
                      <td className="py-3 px-4 text-muted-foreground">₹{inv.tax_amount.toLocaleString("en-IN")}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge className={cn("border capitalize", STATUS_STYLES[inv.processing_status] ?? "bg-muted text-muted-foreground")}>
                            {inv.processing_status}
                          </Badge>
                          {needsMapping && (
                            <Badge className="border bg-amber-50 text-amber-700 border-amber-200 text-xs flex items-center gap-1">
                              <Link2 className="h-3 w-3" />Mapping Required
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(inv)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Manual Entry Dialog */}
      <Dialog open={manualOpen} onOpenChange={v => { if (!saving) setManualOpen(v); }}>
        <DialogContent className="max-w-xl" onInteractOutside={e => e.preventDefault()}>
          <DialogHeader><DialogTitle>Manual Invoice Entry</DialogTitle></DialogHeader>
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Invoice Number</Label><Input value={manualForm.invoice_number} onChange={e => set("invoice_number", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Invoice Date</Label><Input type="date" value={manualForm.invoice_date} onChange={e => set("invoice_date", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Vendor Name</Label><Input value={manualForm.vendor_name} onChange={e => set("vendor_name", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Vendor GSTIN</Label><Input value={manualForm.vendor_gstin} onChange={e => set("vendor_gstin", e.target.value.toUpperCase())} /></div>
              <div className="space-y-1.5"><Label>Customer Name</Label><Input value={manualForm.customer_name} onChange={e => set("customer_name", e.target.value)} /></div>
              <div className="space-y-1.5 col-span-2">
                <Label>Marketplace</Label>
                <CreatableCombobox optionsKey="marketplace" value={manualForm.marketplace} onChange={v => set("marketplace", v)} placeholder="Select marketplace…" />
              </div>
              <div className="space-y-1.5"><Label>Subtotal (₹)</Label><Input type="number" value={manualForm.subtotal} onChange={e => set("subtotal", Number(e.target.value))} /></div>
              <div className="space-y-1.5"><Label>Tax Amount (₹)</Label><Input type="number" value={manualForm.tax_amount} onChange={e => set("tax_amount", Number(e.target.value))} /></div>
              <div className="space-y-1.5 col-span-2"><Label>Total Amount (₹)</Label><Input type="number" value={manualForm.total_amount} onChange={e => set("total_amount", Number(e.target.value))} /></div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setManualOpen(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Create Invoice"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={v => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Invoice?</AlertDialogTitle><AlertDialogDescription>Permanently delete invoice {confirmDelete?.invoice_number ?? confirmDelete?.original_filename}?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
