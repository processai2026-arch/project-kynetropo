import { useState, useEffect, useMemo } from "react";
import { apiFetch } from "@/lib/api/client";
import { toast } from "sonner";
import { Upload, Plus, Trash2, Loader2, CloudUpload, CheckCircle, X, ChevronDown, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { CreatableCombobox } from "@/components/ui/creatable-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useRef } from "react";

interface PurchaseInvoice {
  invoice_id: number;
  invoice_date: string;
  invoice_number: string;
  vendor_name: string;
  total_amount: number;
  tax_amount: number;
  subtotal: number;
  processing_status: string;
  marketplace: string;
  validated_data?: { line_items?: LineItem[] };
  vendor_gstin?: string;
  notes?: string;
}

interface LineItem {
  product_name: string;
  sku: string;
  qty: string;
  unit_price: string;
  supply_type: "interstate" | "intrastate";
  igst_rate: string;  igst_amount: string;
  cgst_rate: string;  cgst_amount: string;
  sgst_rate: string;  sgst_amount: string;
  taxable_value: string;
  total: string;
}

const GST_RATES = ["0", "5", "12", "18", "28"];
const EMPTY_LINE: LineItem = {
  product_name: "", sku: "", qty: "", unit_price: "",
  supply_type: "interstate",
  igst_rate: "18", igst_amount: "",
  cgst_rate: "9",  cgst_amount: "",
  sgst_rate: "9",  sgst_amount: "",
  taxable_value: "", total: "",
};
const EMPTY_FORM = {
  vendor_name: "", vendor_gstin: "", invoice_number: "", invoice_date: "",
  vendor_type: "", notes: "", is_credit: false, credit_days: "",
};

const statusStyles: Record<string, string> = {
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending:  "bg-status-pending/10 text-status-pending border-status-pending/20",
  review:   "bg-amber-50 text-amber-600 border-amber-200",
  rejected: "bg-red-50 text-red-600 border-red-200",
};

function computeLine(line: LineItem, field: string, val: string): LineItem {
  const next = { ...line, [field]: val };
  const qty   = parseFloat(next.qty)        || 0;
  const price = parseFloat(next.unit_price) || 0;
  const taxable = qty * price;
  next.taxable_value = taxable.toFixed(2);

  if (next.supply_type === "interstate") {
    const igstR = parseFloat(next.igst_rate) || 0;
    const igstA = taxable * igstR / 100;
    next.igst_amount = igstA.toFixed(2);
    next.cgst_amount = "0"; next.sgst_amount = "0";
    next.total = (taxable + igstA).toFixed(2);
  } else {
    const cgstR = parseFloat(next.cgst_rate) || 0;
    const sgstR = parseFloat(next.sgst_rate) || 0;
    const cgstA = taxable * cgstR / 100;
    const sgstA = taxable * sgstR / 100;
    next.cgst_amount = cgstA.toFixed(2);
    next.sgst_amount = sgstA.toFixed(2);
    next.igst_amount = "0";
    next.total = (taxable + cgstA + sgstA).toFixed(2);
  }
  return next;
}

export default function InvoicePurchases() {
  const [tab, setTab] = useState<"list" | "upload" | "manual">("list");
  const [items, setItems] = useState<PurchaseInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [detailInvoice, setDetailInvoice] = useState<PurchaseInvoice | null>(null);

  const [uploadVendorType, setUploadVendorType] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [lineItems, setLineItems] = useState<LineItem[]>([{ ...EMPTY_LINE }]);
  const [saving, setSaving] = useState(false);

  const [sortKey, setSortKey] = useState<string>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

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
      const res = await apiFetch<{ data: PurchaseInvoice[] }>("/admin/scan-invoices?invoice_type=purchase&limit=200");
      setItems(res.data ?? []);
    } catch { setItems([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const setF = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const setLine = (idx: number, field: string, val: string) => {
    setLineItems(prev => prev.map((l, i) => i === idx ? computeLine(l, field, val) : l));
  };

  const toggleSupplyType = (idx: number) => {
    setLineItems(prev => prev.map((l, i) => {
      if (i !== idx) return l;
      const next = { ...l, supply_type: l.supply_type === "interstate" ? "intrastate" : "interstate" } as LineItem;
      // When switching to intrastate, split IGST rate into CGST+SGST
      if (next.supply_type === "intrastate") {
        const half = (parseFloat(l.igst_rate) / 2).toFixed(0);
        next.cgst_rate = half; next.sgst_rate = half;
      } else {
        const total = (parseFloat(l.cgst_rate) + parseFloat(l.sgst_rate)).toFixed(0);
        next.igst_rate = total;
      }
      return computeLine(next, "supply_type", next.supply_type);
    }));
  };

  const addLine = () => setLineItems(p => [...p, { ...EMPTY_LINE }]);
  const removeLine = (i: number) => setLineItems(p => p.filter((_, idx) => idx !== i));

  const totals = useMemo(() => {
    const subtotal  = lineItems.reduce((s, l) => s + (parseFloat(l.taxable_value) || 0), 0);
    const igst      = lineItems.reduce((s, l) => s + (parseFloat(l.igst_amount) || 0), 0);
    const cgst      = lineItems.reduce((s, l) => s + (parseFloat(l.cgst_amount) || 0), 0);
    const sgst      = lineItems.reduce((s, l) => s + (parseFloat(l.sgst_amount) || 0), 0);
    const tax       = igst + cgst + sgst;
    const total     = subtotal + tax;
    return { subtotal, igst, cgst, sgst, tax, total };
  }, [lineItems]);

  const totalPurchases = items.reduce((s, i) => s + Number(i.total_amount || 0), 0);
  const totalITC = items.reduce((s, i) => s + Number(i.tax_amount || 0), 0);
  const pendingCount = items.filter(i => i.processing_status === "pending" || i.processing_status === "review").length;

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const av = (a as any)[sortKey] ?? "";
      const bv = (b as any)[sortKey] ?? "";
      const numKeys = ["total_amount", "tax_amount", "amount", "lifetime_revenue", "current_stock", "damaged_stock"];
      const cmp = numKeys.includes(sortKey) ? Number(av) - Number(bv) : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [items, sortKey, sortDir]);

  const handleApprove = async (id: number) => {
    setApprovingId(id);
    try {
      await apiFetch(`/admin/scan-invoices/${id}/approve`, { method: "PUT" });
      toast.success("Invoice approved");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Approve failed");
    } finally { setApprovingId(null); }
  };

  const handleUpload = async () => {
    if (!uploadFile) { toast.error("Select a file first"); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      fd.append("invoice_type", "purchase");
      if (uploadVendorType) fd.append("vendor_type", uploadVendorType);
      await apiFetch("/admin/scan-invoices/upload", { method: "POST", body: fd });
      toast.success("File uploaded successfully");
      setUploadFile(null); setUploadVendorType("");
      load(); setTab("list");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally { setUploading(false); }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.vendor_name?.trim()) { toast.error("Vendor name is required"); return; }
    if (!form.invoice_number?.trim()) { toast.error("Invoice number is required"); return; }
    if (!form.invoice_date) { toast.error("Invoice date is required"); return; }
    setSaving(true);
    try {
      // Build line items for backend with all GST fields
      const backendLines = lineItems.map(l => ({
        product_name: l.product_name,
        sku: l.sku,
        qty: l.qty,
        unit_price: l.unit_price,
        supply_type: l.supply_type,
        gst_rate: l.supply_type === "interstate" ? l.igst_rate : (parseFloat(l.cgst_rate) + parseFloat(l.sgst_rate)).toFixed(0),
        igst_rate:  parseFloat(l.igst_rate || "0"),
        igst_amount: parseFloat(l.igst_amount || "0"),
        cgst_rate:  parseFloat(l.cgst_rate || "0"),
        cgst_amount: parseFloat(l.cgst_amount || "0"),
        sgst_rate:  parseFloat(l.sgst_rate || "0"),
        sgst_amount: parseFloat(l.sgst_amount || "0"),
        taxable_value: parseFloat(l.taxable_value || "0"),
        total_amount: parseFloat(l.total || "0"),
      }));

      await apiFetch("/admin/scan-invoices/manual", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          invoice_type: "purchase",
          is_credit_sale: form.is_credit ? 1 : 0,
          subtotal: Math.round(totals.subtotal * 100) / 100,
          tax_amount: Math.round(totals.tax * 100) / 100,
          total_amount: Math.round(totals.total * 100) / 100,
          line_items: backendLines,
        }),
      });
      toast.success("Purchase invoice saved");
      setForm({ ...EMPTY_FORM });
      setLineItems([{ ...EMPTY_LINE }]);
      load(); setTab("list");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally { setSaving(false); }
  };

  const fmt = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Purchase Invoices</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Purchases" value={fmt(totalPurchases)} subtitle="All vendors" icon={Upload} subtitleColor="muted" />
        <StatCard title="Input GST / ITC" value={fmt(totalITC)} subtitle="Claimable credit" icon={CheckCircle} subtitleColor="primary" />
        <StatCard title="Pending Review" value={String(pendingCount)} subtitle="Awaiting approval" icon={Loader2} subtitleColor="muted" />
      </div>

      <div className="bg-card rounded-xl border shadow-sm">
        <div className="flex gap-1 p-4 border-b">
          {(["list", "upload", "manual"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn("px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
                tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50")}>
              {t === "list" ? "Invoices" : t === "upload" ? "Upload" : "Manual Entry"}
            </button>
          ))}
        </div>

        {/* LIST TAB */}
        {tab === "list" && (
          <div className="p-4">
            {sortKey !== "created_at" && (
              <div className="flex justify-end mb-3">
                <Button variant="outline" size="sm" onClick={resetSort} className="text-xs">
                  <RefreshCw className="h-3 w-3 mr-1" />Reset Sort
                </Button>
              </div>
            )}
            <div className="overflow-x-auto eco-float-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th onClick={() => handleSort("invoice_date")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">
                      Date<SortIcon col="invoice_date" />
                    </th>
                    <th onClick={() => handleSort("invoice_number")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">
                      Invoice #<SortIcon col="invoice_number" />
                    </th>
                    <th onClick={() => handleSort("vendor_name")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">
                      Vendor<SortIcon col="vendor_name" />
                    </th>
                    <th onClick={() => handleSort("total_amount")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">
                      Total<SortIcon col="total_amount" />
                    </th>
                    <th onClick={() => handleSort("tax_amount")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">
                      Input GST<SortIcon col="tax_amount" />
                    </th>
                    <th onClick={() => handleSort("processing_status")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">
                      Status<SortIcon col="processing_status" />
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap"></th>
                  </tr>
                </thead>
                <tbody>
                  {loading && Array.from({length:5}).map((_,i) => (
                    <tr key={i} className="border-b">{Array.from({length:7}).map((_,j) => <td key={j} className="py-3 px-4"><Skeleton className="h-4 w-24" /></td>)}</tr>
                  ))}
                  {!loading && sortedItems.length === 0 && <tr><td colSpan={7} className="px-6 py-8 text-center text-muted-foreground text-sm">No purchase invoices found</td></tr>}
                  {!loading && sortedItems.map(item => (
                    <tr key={item.invoice_id} className="border-b hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setDetailInvoice(item)}>
                      <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">{item.invoice_date}</td>
                      <td className="py-3 px-4 font-mono text-xs text-card-foreground">{item.invoice_number ?? "—"}</td>
                      <td className="py-3 px-4 text-card-foreground">{item.vendor_name ?? "—"}</td>
                      <td className="py-3 px-4 text-card-foreground text-right font-medium">{fmt(Number(item.total_amount))}</td>
                      <td className="py-3 px-4 text-emerald-600 text-right">{fmt(Number(item.tax_amount))}</td>
                      <td className="py-3 px-4">
                        <Badge className={cn("border capitalize", statusStyles[item.processing_status] ?? "bg-muted text-muted-foreground")}>{item.processing_status}</Badge>
                      </td>
                      <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                        {(item.processing_status === "pending" || item.processing_status === "review") && (
                          <Button size="sm" variant="outline" disabled={approvingId === item.invoice_id} onClick={() => handleApprove(item.invoice_id)}>
                            {approvingId === item.invoice_id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Approve"}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* UPLOAD TAB */}
        {tab === "upload" && (
          <div className="p-6 space-y-4 max-w-lg">
            <div className="space-y-1.5">
              <Label>Vendor Type (optional)</Label>
              <CreatableCombobox optionsKey="vendor_type" value={uploadVendorType} onChange={setUploadVendorType} placeholder="Select vendor type…" />
            </div>
            <div className={cn("border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors",
                dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50")}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) setUploadFile(f); }}
              onClick={() => fileInputRef.current?.click()}>
              <CloudUpload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              {uploadFile ? <p className="text-sm font-medium text-foreground">{uploadFile.name}</p> :
                <><p className="text-sm text-muted-foreground">Drag & drop or click to select</p><p className="text-xs text-muted-foreground mt-1">PDF, Excel, CSV</p></>}
              <input ref={fileInputRef} type="file" className="hidden" onChange={e => setUploadFile(e.target.files?.[0] ?? null)} />
            </div>
            <Button onClick={handleUpload} disabled={uploading || !uploadFile}>
              {uploading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Uploading…</> : <><Upload className="h-4 w-4 mr-2" />Upload Invoice</>}
            </Button>
          </div>
        )}

        {/* MANUAL ENTRY TAB */}
        {tab === "manual" && (
          <form onSubmit={handleManualSubmit} className="p-6 space-y-4 max-w-4xl">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Vendor Name *</Label><Input value={form.vendor_name} onChange={e => setF("vendor_name", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Vendor GSTIN</Label><Input value={form.vendor_gstin} onChange={e => setF("vendor_gstin", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Invoice Number *</Label><Input value={form.invoice_number} onChange={e => setF("invoice_number", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Invoice Date *</Label><Input type="date" value={form.invoice_date} onChange={e => setF("invoice_date", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Vendor Type</Label><CreatableCombobox optionsKey="vendor_type" value={form.vendor_type} onChange={v => setF("vendor_type", v)} placeholder="Select vendor type…" /></div>
              <div className="flex items-end gap-3">
                <div className="flex items-center gap-2 pb-2">
                  <input type="checkbox" id="is_credit" checked={form.is_credit} onChange={e => setF("is_credit", e.target.checked)} className="rounded" />
                  <Label htmlFor="is_credit" className="cursor-pointer">Credit Purchase</Label>
                </div>
                {form.is_credit && (
                  <div className="flex-1 space-y-1.5">
                    <Label>Credit Days</Label>
                    <Input type="number" value={form.credit_days} onChange={e => setF("credit_days", e.target.value)} placeholder="30" />
                  </div>
                )}
              </div>
            </div>

            {/* Line Items */}
            <section className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Line Items</h3>
                <Button type="button" size="sm" variant="outline" onClick={addLine}><Plus className="h-4 w-4 mr-1" />Add Item</Button>
              </div>

              <div className="space-y-3">
                {lineItems.map((line, idx) => (
                  <div key={idx} className="border rounded-xl p-4 space-y-3 bg-muted/10">
                    {/* Row 1: Product, SKU, Qty, Unit Price */}
                    <div className="grid grid-cols-4 gap-3">
                      <div className="space-y-1"><Label className="text-xs">Product</Label><Input value={line.product_name} onChange={e => setLine(idx, "product_name", e.target.value)} placeholder="Product name" className="h-8 text-xs" /></div>
                      <div className="space-y-1"><Label className="text-xs">SKU</Label><Input value={line.sku} onChange={e => setLine(idx, "sku", e.target.value)} placeholder="SKU" className="h-8 text-xs" /></div>
                      <div className="space-y-1"><Label className="text-xs">Qty</Label><Input type="number" value={line.qty} onChange={e => setLine(idx, "qty", e.target.value)} placeholder="0" className="h-8 text-xs" /></div>
                      <div className="space-y-1"><Label className="text-xs">Unit Price (₹)</Label><Input type="number" value={line.unit_price} onChange={e => setLine(idx, "unit_price", e.target.value)} placeholder="0.00" className="h-8 text-xs" /></div>
                    </div>

                    {/* Row 2: Supply type toggle + GST fields */}
                    <div className="flex items-start gap-3">
                      {/* Toggle */}
                      <div className="space-y-1">
                        <Label className="text-xs">Supply Type</Label>
                        <button type="button" onClick={() => toggleSupplyType(idx)}
                          className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap",
                            line.supply_type === "interstate"
                              ? "bg-blue-50 text-blue-700 border-blue-300"
                              : "bg-orange-50 text-orange-700 border-orange-300")}>
                          {line.supply_type === "interstate" ? "Inter-state (IGST)" : "Intra-state (CGST+SGST)"}
                          <ChevronDown className="h-3 w-3" />
                        </button>
                      </div>

                      {line.supply_type === "interstate" ? (
                        <div className="space-y-1">
                          <Label className="text-xs">IGST %</Label>
                          <select value={line.igst_rate} onChange={e => setLine(idx, "igst_rate", e.target.value)}
                            className="h-8 rounded-md border border-input bg-background px-2 text-xs w-20">
                            {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                          </select>
                        </div>
                      ) : (
                        <>
                          <div className="space-y-1">
                            <Label className="text-xs">CGST %</Label>
                            <select value={line.cgst_rate} onChange={e => setLine(idx, "cgst_rate", e.target.value)}
                              className="h-8 rounded-md border border-input bg-background px-2 text-xs w-20">
                              {["0","2.5","6","9","14"].map(r => <option key={r} value={r}>{r}%</option>)}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">SGST %</Label>
                            <select value={line.sgst_rate} onChange={e => setLine(idx, "sgst_rate", e.target.value)}
                              className="h-8 rounded-md border border-input bg-background px-2 text-xs w-20">
                              {["0","2.5","6","9","14"].map(r => <option key={r} value={r}>{r}%</option>)}
                            </select>
                          </div>
                        </>
                      )}

                      {/* Computed values */}
                      <div className="space-y-1">
                        <Label className="text-xs">Taxable</Label>
                        <div className="h-8 flex items-center px-2 text-xs text-muted-foreground bg-muted/30 rounded-md border border-border min-w-[70px]">₹{line.taxable_value || "0.00"}</div>
                      </div>
                      {line.supply_type === "interstate" ? (
                        <div className="space-y-1">
                          <Label className="text-xs">IGST Amt</Label>
                          <div className="h-8 flex items-center px-2 text-xs text-blue-600 bg-blue-50 rounded-md border border-blue-200 min-w-[70px]">₹{line.igst_amount || "0.00"}</div>
                        </div>
                      ) : (
                        <>
                          <div className="space-y-1"><Label className="text-xs">CGST Amt</Label><div className="h-8 flex items-center px-2 text-xs text-orange-600 bg-orange-50 rounded-md border border-orange-200 min-w-[60px]">₹{line.cgst_amount || "0.00"}</div></div>
                          <div className="space-y-1"><Label className="text-xs">SGST Amt</Label><div className="h-8 flex items-center px-2 text-xs text-orange-600 bg-orange-50 rounded-md border border-orange-200 min-w-[60px]">₹{line.sgst_amount || "0.00"}</div></div>
                        </>
                      )}
                      <div className="space-y-1">
                        <Label className="text-xs">Total</Label>
                        <div className="h-8 flex items-center px-2 text-xs font-semibold text-card-foreground bg-muted/30 rounded-md border border-border min-w-[70px]">₹{line.total || "0.00"}</div>
                      </div>
                      {lineItems.length > 1 && (
                        <div className="pt-5">
                          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => removeLine(idx)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals Summary */}
              <div className="bg-muted/20 border rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal (Taxable)</span><span className="font-medium">{fmt(totals.subtotal)}</span></div>
                {totals.igst > 0 && <div className="flex justify-between text-sm text-blue-600"><span>IGST</span><span>{fmt(totals.igst)}</span></div>}
                {totals.cgst > 0 && <div className="flex justify-between text-sm text-orange-600"><span>CGST</span><span>{fmt(totals.cgst)}</span></div>}
                {totals.sgst > 0 && <div className="flex justify-between text-sm text-orange-600"><span>SGST</span><span>{fmt(totals.sgst)}</span></div>}
                <div className="flex justify-between text-sm font-semibold border-t pt-2 mt-2">
                  <span>Total Input Tax (ITC)</span><span className="text-emerald-600">{fmt(totals.tax)}</span>
                </div>
                <div className="flex justify-between text-base font-bold">
                  <span>Invoice Total</span><span>{fmt(totals.total)}</span>
                </div>
              </div>
            </section>

            <div className="space-y-1.5"><Label>Notes</Label><Input value={form.notes} onChange={e => setF("notes", e.target.value)} placeholder="Optional notes" /></div>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>{saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</> : "Save Invoice"}</Button>
              <Button type="button" variant="outline" onClick={() => { setForm({ ...EMPTY_FORM }); setLineItems([{ ...EMPTY_LINE }]); }}>Reset</Button>
            </div>
          </form>
        )}
      </div>

      {/* Detail Popup */}
      <Dialog open={!!detailInvoice} onOpenChange={v => !v && setDetailInvoice(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Purchase Invoice — {detailInvoice?.invoice_number ?? "Manual Entry"}</DialogTitle>
          </DialogHeader>
          {detailInvoice && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["Vendor", detailInvoice.vendor_name],
                  ["GSTIN", detailInvoice.vendor_gstin ?? "—"],
                  ["Invoice Date", detailInvoice.invoice_date],
                  ["Status", detailInvoice.processing_status],
                ].map(([k,v]) => (
                  <div key={k as string}><span className="text-muted-foreground">{k}: </span><span className="font-medium">{v}</span></div>
                ))}
              </div>

              {/* Line Items */}
              {(() => {
                const lines = detailInvoice.validated_data?.line_items ?? [];
                if (!lines.length) return <p className="text-muted-foreground text-xs">No line item details available</p>;
                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="border-b bg-muted/50">{["Product","SKU","Qty","Taxable","IGST","CGST","SGST","Total"].map(h=><th key={h} className="text-left py-2 px-2 text-muted-foreground uppercase">{h}</th>)}</tr></thead>
                      <tbody>
                        {lines.map((l: any, i: number) => (
                          <tr key={i} className="border-b">
                            <td className="py-2 px-2 font-medium">{l.product_name}</td>
                            <td className="py-2 px-2 font-mono">{l.sku || "—"}</td>
                            <td className="py-2 px-2">{l.qty || l.quantity}</td>
                            <td className="py-2 px-2">₹{(l.taxable_value||0).toLocaleString("en-IN")}</td>
                            <td className="py-2 px-2 text-blue-600">₹{(l.igst_amount||0).toLocaleString("en-IN")}</td>
                            <td className="py-2 px-2 text-orange-600">₹{(l.cgst_amount||0).toLocaleString("en-IN")}</td>
                            <td className="py-2 px-2 text-orange-600">₹{(l.sgst_amount||0).toLocaleString("en-IN")}</td>
                            <td className="py-2 px-2 font-semibold">₹{(l.total_amount||l.total||0).toLocaleString("en-IN")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}

              {/* GST Summary */}
              <div className="bg-muted/20 rounded-lg p-3 space-y-1.5">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{fmt(detailInvoice.subtotal || 0)}</span></div>
                <div className="flex justify-between text-emerald-600"><span>Total Input Tax (ITC)</span><span>{fmt(detailInvoice.tax_amount || 0)}</span></div>
                <div className="flex justify-between font-bold text-base border-t pt-2"><span>Invoice Total</span><span>{fmt(detailInvoice.total_amount || 0)}</span></div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
