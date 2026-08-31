import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { CheckCheck, X, AlertTriangle, Loader2, Plus, PackagePlus, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { scanInvoicesApi } from "@/lib/api/scanInvoices";
import { invoiceProductsApi } from "@/lib/api/invoiceProducts";
import { productMappingsApi } from "@/lib/api/productMappings";
import type { ScanInvoice, InvoiceLineItem, ExtractedInvoiceData } from "@/types/scanInvoice";
import type { InvoiceProduct } from "@/types/invoiceProduct";

// ── Types for the mapping modal ──────────────────────────────────────────────
interface MappingRow { product_id: number | ""; quantity: number }

interface ItemState {
  rows: MappingRow[];
  skipped: boolean;
  addingNew: boolean;
  newProduct: {
    sku: string; name: string; category: string; hsn_code: string;
    cost_price: string; selling_price: string; current_stock: string; min_stock_level: string;
  };
}

const EMPTY_NEW_PRODUCT = {
  sku: "", name: "", category: "", hsn_code: "",
  cost_price: "", selling_price: "", current_stock: "0", min_stock_level: "5",
};

export default function ScanInvoiceReview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [inv, setInv] = useState<ScanInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [edited, setEdited] = useState<ExtractedInvoiceData>({});
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([]);
  const [totalMismatch, setTotalMismatch] = useState(false);

  // Mapping modal state
  const [mappingOpen, setMappingOpen] = useState(false);
  const [unmappedNames, setUnmappedNames] = useState<string[]>([]);
  const [itemStates, setItemStates] = useState<Record<string, ItemState>>({});
  const [allProducts, setAllProducts] = useState<InvoiceProduct[]>([]);
  const [savingNewFor, setSavingNewFor] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      try {
        const data = await scanInvoicesApi.get(Number(id));
        setInv(data);
        const vd = (data.validated_data ?? data.extracted_data ?? {}) as ExtractedInvoiceData;
        setEdited({
          invoice_number: vd.invoice_number ?? data.invoice_number ?? "",
          invoice_date: vd.invoice_date ?? data.invoice_date ?? "",
          vendor_name: vd.vendor_name ?? data.vendor_name ?? "",
          vendor_gstin: vd.vendor_gstin ?? data.vendor_gstin ?? "",
          customer_name: vd.customer_name ?? "",
          customer_gstin: vd.customer_gstin ?? "",
          customer_address: vd.customer_address ?? "",
          shipping_charges: vd.shipping_charges ?? 0,
          commission_amount: vd.commission_amount ?? 0,
          subtotal: vd.subtotal ?? data.subtotal ?? 0,
          tax_amount: vd.tax_amount ?? data.tax_amount ?? 0,
          total_amount: vd.total_amount ?? data.total_amount ?? 0,
        });
        const items = (vd.line_items ?? data.line_items ?? []).map(li => ({ ...li }));
        setLineItems(items);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Not found");
        navigate("/scan-invoices");
      } finally { setLoading(false); }
    })();
  }, [id, navigate]);

  useEffect(() => {
    const sum = lineItems.reduce((acc, li) => acc + (li.total_amount ?? 0), 0);
    const invTotal = edited.total_amount ?? 0;
    setTotalMismatch(Math.abs(invTotal - sum) > 5 && lineItems.length > 0);
  }, [lineItems, edited.total_amount]);

  const updateLineItem = (idx: number, field: keyof InvoiceLineItem, value: number | string) => {
    setLineItems(prev => {
      const items = [...prev];
      const item = { ...items[idx], [field]: value };
      if (field === "quantity" || field === "unit_price") {
        const qty = field === "quantity" ? Number(value) : Number(item.quantity);
        const price = field === "unit_price" ? Number(value) : Number(item.unit_price);
        const discount = Number(item.discount ?? 0);
        const taxable = Math.max(0, qty * price - discount);
        item.taxable_value = parseFloat(taxable.toFixed(2));
        item.igst_amount = parseFloat((taxable * Number(item.igst_rate ?? 0) / 100).toFixed(2));
        item.cgst_amount = parseFloat((taxable * Number(item.cgst_rate ?? 0) / 100).toFixed(2));
        item.sgst_amount = parseFloat((taxable * Number(item.sgst_rate ?? 0) / 100).toFixed(2));
        item.total_amount = parseFloat((taxable + item.igst_amount + item.cgst_amount + item.sgst_amount).toFixed(2));
      }
      items[idx] = item;
      return items;
    });
  };

  // ── Mapping modal helpers ────────────────────────────────────────────────────

  const buildInitialItemStates = (names: string[]): Record<string, ItemState> => {
    const state: Record<string, ItemState> = {};
    names.forEach(name => {
      state[name] = {
        rows: [{ product_id: "", quantity: 1 }],
        skipped: false,
        addingNew: false,
        newProduct: { ...EMPTY_NEW_PRODUCT, name },
      };
    });
    return state;
  };

  const updateRow = (name: string, rowIdx: number, field: keyof MappingRow, value: string | number) => {
    setItemStates(prev => {
      const s = prev[name];
      const rows = s.rows.map((r, i) =>
        i === rowIdx ? { ...r, [field]: field === "quantity" ? Number(value) : value } : r
      );
      return { ...prev, [name]: { ...s, rows } };
    });
  };

  const addRow = (name: string) => {
    setItemStates(prev => ({
      ...prev,
      [name]: { ...prev[name], rows: [...prev[name].rows, { product_id: "", quantity: 1 }] },
    }));
  };

  const removeRow = (name: string, rowIdx: number) => {
    setItemStates(prev => {
      const rows = prev[name].rows.filter((_, i) => i !== rowIdx);
      return { ...prev, [name]: { ...prev[name], rows: rows.length > 0 ? rows : prev[name].rows } };
    });
  };

  const setItemFlag = (name: string, flag: "skipped" | "addingNew", value: boolean) => {
    setItemStates(prev => ({ ...prev, [name]: { ...prev[name], [flag]: value } }));
  };

  const updateNewProduct = (name: string, field: string, value: string) => {
    setItemStates(prev => ({
      ...prev,
      [name]: { ...prev[name], newProduct: { ...prev[name].newProduct, [field]: value } },
    }));
  };

  const handleCreateNewProduct = async (name: string) => {
    const np = itemStates[name].newProduct;
    if (!np.sku.trim()) { toast.error("SKU is required"); return; }
    if (!np.name.trim()) { toast.error("Product name is required"); return; }
    if (!np.selling_price) { toast.error("Selling price is required"); return; }
    setSavingNewFor(prev => ({ ...prev, [name]: true }));
    try {
      const created = await invoiceProductsApi.create({
        sku: np.sku.trim(),
        name: np.name.trim(),
        category: np.category || undefined,
        hsn_code: np.hsn_code || undefined,
        unit: "pcs",
        cost_price: Number(np.cost_price) || 0,
        selling_price: Number(np.selling_price),
        current_stock: Number(np.current_stock) || 0,
        min_stock_level: Number(np.min_stock_level) || 5,
      });
      setAllProducts(prev => [...prev, created]);
      // Auto-select the new product in the first row and exit "addingNew" mode
      setItemStates(prev => ({
        ...prev,
        [name]: {
          ...prev[name],
          addingNew: false,
          rows: [{ product_id: created.product_id, quantity: 1 }],
        },
      }));
      toast.success(`"${created.name}" added to catalog`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create product");
    } finally {
      setSavingNewFor(prev => ({ ...prev, [name]: false }));
    }
  };

  const handleApprove = async () => {
    if (!inv) return;
    // Check product names against the two-table mapping system before approving
    const productNames = lineItems.map(li => li.product_name).filter(Boolean) as string[];
    if (productNames.length > 0) {
      try {
        const result = await productMappingsApi.check(productNames);
        const unmapped = result.unmapped ?? [];
        if (unmapped.length > 0) {
          setUnmappedNames(unmapped);
          setItemStates(buildInitialItemStates(unmapped));
          const pRes = await invoiceProductsApi.list();
          setAllProducts(pRes.data ?? []);
          setMappingOpen(true);
          return;
        }
      } catch { /* proceed — mapping check is optional */ }
    }
    await doApprove();
  };

  const handleSaveMappings = async () => {
    // Validate — every non-skipped item must have at least one mapped product
    for (const name of unmappedNames) {
      const state = itemStates[name];
      if (state.skipped) continue;
      const validRows = state.rows.filter(r => r.product_id !== "" && r.quantity > 0);
      if (validRows.length === 0) {
        toast.error(`Please select a product for "${name}", or skip it.`);
        return;
      }
    }
    // Save each mapping
    for (const name of unmappedNames) {
      const state = itemStates[name];
      if (state.skipped) continue;
      const validRows = state.rows.filter(r => r.product_id !== "" && r.quantity > 0) as Array<{ product_id: number; quantity: number }>;
      if (validRows.length === 0) continue;
      try {
        await productMappingsApi.create({
          invoice_product_name: name,
          items: validRows,
        });
      } catch { /* silently skip duplicates */ }
    }
    setMappingOpen(false);
    await doApprove();
  };

  const doApprove = async () => {
    if (!inv) return;
    setApproving(true);
    try {
      const validatedData: ExtractedInvoiceData = { ...edited, line_items: lineItems };
      await scanInvoicesApi.approve(inv.invoice_id, validatedData);
      toast.success("Invoice approved");
      navigate(`/scan-invoices/${inv.invoice_id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Approval failed");
    } finally { setApproving(false); }
  };

  const handleReject = async () => {
    if (!inv) return;
    setRejecting(true);
    try {
      await scanInvoicesApi.update(inv.invoice_id, { processing_status: "rejected" });
      toast.success("Invoice rejected");
      navigate("/scan-invoices");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reject failed");
    } finally { setRejecting(false); }
  };

  const confidence = (score?: number | null) => score !== null && score !== undefined && score < 80;

  if (loading) return <div className="space-y-4"><Skeleton className="h-12 w-80" /><div className="grid grid-cols-2 gap-4"><Skeleton className="h-96" /><Skeleton className="h-96" /></div></div>;
  if (!inv) return null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate("/scan-invoices")} className="text-muted-foreground hover:text-foreground text-sm">← Invoices</button>
          <span className="text-muted-foreground">/</span>
          <h1 className="text-xl font-bold text-foreground">Review Invoice</h1>
          {inv.ai_confidence_score && (
            <Badge className={cn("border ml-2", inv.ai_confidence_score >= 80 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200")}>
              AI {inv.ai_confidence_score}% confident
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReject} disabled={rejecting || approving}>
            {rejecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4 mr-1" />}Reject
          </Button>
          <Button onClick={handleApprove} disabled={approving || rejecting}>
            {approving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCheck className="h-4 w-4 mr-1" />}Approve
          </Button>
        </div>
      </div>

      {totalMismatch && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Invoice total (₹{(edited.total_amount ?? 0).toFixed(2)}) does not match line items sum by more than ₹5. Please verify.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: file preview */}
        <div className="bg-card rounded-xl border shadow-sm overflow-hidden" style={{ minHeight: 500 }}>
          {inv.file_path && inv.file_path !== "manual" ? (
            inv.file_type === "pdf" ? (
              <iframe src={scanInvoicesApi.downloadUrl(inv.invoice_id)} className="w-full h-full" style={{ minHeight: 500 }} title="Invoice preview" />
            ) : (
              <img src={scanInvoicesApi.downloadUrl(inv.invoice_id)} alt="Invoice" className="w-full h-auto object-contain p-2" />
            )
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
              <p className="text-sm">Manual entry — no file attached</p>
            </div>
          )}
        </div>

        {/* Right: extracted data editor */}
        <div className="space-y-4 overflow-y-auto">
          {/* Invoice Details */}
          <div className="bg-card rounded-xl border shadow-sm p-4 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Invoice Details</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Invoice Number</Label>
                <Input className="h-8 text-sm" value={edited.invoice_number ?? ""} onChange={e => setEdited(d => ({ ...d, invoice_number: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Invoice Date</Label>
                <Input className="h-8 text-sm" type="date" value={edited.invoice_date ?? ""} onChange={e => setEdited(d => ({ ...d, invoice_date: e.target.value }))} />
              </div>
            </div>
          </div>

          {/* Vendor */}
          <div className="bg-card rounded-xl border shadow-sm p-4 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Vendor Details</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Vendor Name</Label>
                <Input className="h-8 text-sm" value={edited.vendor_name ?? ""} onChange={e => setEdited(d => ({ ...d, vendor_name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Vendor GSTIN</Label>
                <Input
                  className={cn("h-8 text-sm font-mono", confidence(inv.validated_data?.field_confidence?.vendor_gstin) ? "border-amber-400 bg-amber-50" : "")}
                  value={edited.vendor_gstin ?? ""}
                  onChange={e => setEdited(d => ({ ...d, vendor_gstin: e.target.value.toUpperCase() }))}
                />
              </div>
            </div>
          </div>

          {/* Customer */}
          <div className="bg-card rounded-xl border shadow-sm p-4 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Customer Details</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Customer Name</Label>
                <Input className="h-8 text-sm" value={edited.customer_name ?? ""} onChange={e => setEdited(d => ({ ...d, customer_name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Customer GSTIN</Label>
                <Input className="h-8 text-sm font-mono" value={edited.customer_gstin ?? ""} onChange={e => setEdited(d => ({ ...d, customer_gstin: e.target.value.toUpperCase() }))} />
              </div>
            </div>
          </div>

          {/* Charges */}
          <div className="bg-card rounded-xl border shadow-sm p-4 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Charges</h2>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Shipping (₹)</Label>
                <Input className="h-8 text-sm" type="number" value={edited.shipping_charges ?? 0} onChange={e => setEdited(d => ({ ...d, shipping_charges: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Commission (₹)</Label>
                <Input className="h-8 text-sm" type="number" value={edited.commission_amount ?? 0} onChange={e => setEdited(d => ({ ...d, commission_amount: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Total (₹)</Label>
                <Input
                  className={cn("h-8 text-sm", totalMismatch ? "border-amber-400 bg-amber-50" : "")}
                  type="number"
                  value={edited.total_amount ?? 0}
                  onChange={e => setEdited(d => ({ ...d, total_amount: Number(e.target.value) }))}
                />
              </div>
            </div>
          </div>

          {/* Line Items */}
          {lineItems.length > 0 && (
            <div className="bg-card rounded-xl border shadow-sm p-4 space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Line Items ({lineItems.length})</h2>
              <div className="space-y-3">
                {lineItems.map((li, idx) => (
                  <div key={idx} className={cn("border rounded-lg p-3 text-xs space-y-2", confidence(li.confidence_score) ? "border-amber-300 bg-amber-50/50" : "border-border")}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-card-foreground">{li.product_name}</span>
                      {confidence(li.confidence_score) && (
                        <Badge className="bg-amber-50 text-amber-600 border-amber-200 border text-xs">{li.confidence_score}%</Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <span className="text-muted-foreground">SKU: </span>
                        <input className="w-full border rounded px-1 py-0.5 text-xs bg-background" value={li.sku ?? ""} onChange={e => updateLineItem(idx, "sku", e.target.value)} />
                      </div>
                      <div>
                        <span className="text-muted-foreground">Qty: </span>
                        <input className="w-full border rounded px-1 py-0.5 text-xs bg-background" type="number" value={li.quantity} onChange={e => updateLineItem(idx, "quantity", Number(e.target.value))} />
                      </div>
                      <div>
                        <span className="text-muted-foreground">Price: </span>
                        <input className="w-full border rounded px-1 py-0.5 text-xs bg-background" type="number" value={li.unit_price} onChange={e => updateLineItem(idx, "unit_price", Number(e.target.value))} />
                      </div>
                    </div>
                    <div className="flex gap-4 text-muted-foreground">
                      <span>Taxable: ₹{(li.taxable_value ?? 0).toFixed(2)}</span>
                      <span>CGST: ₹{(li.cgst_amount ?? 0).toFixed(2)}</span>
                      <span>SGST: ₹{(li.sgst_amount ?? 0).toFixed(2)}</span>
                      <span>IGST: ₹{(li.igst_amount ?? 0).toFixed(2)}</span>
                      <span className="font-medium text-card-foreground">Total: ₹{(li.total_amount ?? 0).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Product Mapping Modal — "Map to existing" + "Add as new product" + Skip All */}
      <Dialog open={mappingOpen} onOpenChange={v => { if (!v && !approving) setMappingOpen(false); }}>
        <DialogContent className="max-w-2xl" onInteractOutside={e => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Map Products to Catalog</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-1">
            These product names from the invoice are not yet mapped. Link each to an existing catalog
            product, or add it as a new product. For combo products, add multiple rows.
          </p>

          <div className="space-y-5 max-h-[55vh] overflow-y-auto pr-1">
            {unmappedNames.map(name => {
              const state = itemStates[name];
              if (!state) return null;
              const isSkipped = state.skipped;
              const isAddingNew = state.addingNew;
              const np = state.newProduct;

              return (
                <div
                  key={name}
                  className={cn(
                    "rounded-lg border p-4 space-y-3",
                    isSkipped ? "border-border bg-muted/30 opacity-60" : "border-border bg-card"
                  )}
                >
                  {/* Item header */}
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground truncate flex-1">"{name}"</p>
                    {!isSkipped ? (
                      <button
                        onClick={() => setItemFlag(name, "skipped", true)}
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0 ml-3"
                      >
                        <SkipForward className="h-3 w-3" /> Skip
                      </button>
                    ) : (
                      <button
                        onClick={() => setItemFlag(name, "skipped", false)}
                        className="text-xs text-primary hover:text-primary/80 shrink-0 ml-3"
                      >
                        Undo skip
                      </button>
                    )}
                  </div>

                  {!isSkipped && (
                    <>
                      {/* Mode toggle */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => setItemFlag(name, "addingNew", false)}
                          className={cn(
                            "text-xs px-3 py-1.5 rounded border font-medium transition-colors",
                            !isAddingNew
                              ? "bg-primary/10 border-primary/30 text-primary"
                              : "bg-background border-border text-muted-foreground hover:bg-muted/30"
                          )}
                        >
                          Map to existing
                        </button>
                        <button
                          onClick={() => setItemFlag(name, "addingNew", true)}
                          className={cn(
                            "text-xs px-3 py-1.5 rounded border font-medium transition-colors flex items-center gap-1",
                            isAddingNew
                              ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                              : "bg-background border-border text-muted-foreground hover:bg-muted/30"
                          )}
                        >
                          <PackagePlus className="h-3 w-3" /> Add as new product
                        </button>
                      </div>

                      {!isAddingNew ? (
                        /* ── Map to existing ─────────────────────────────── */
                        <div className="space-y-2">
                          {allProducts.length === 0 && (
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
                              No products in catalog yet. Use "Add as new product" to create one.
                            </div>
                          )}
                          <div className="flex gap-2 px-1">
                            <span className="flex-1 text-xs text-muted-foreground">Product in catalog</span>
                            <span className="w-20 text-xs text-muted-foreground text-center">Qty/unit</span>
                          </div>
                          {state.rows.map((row, rowIdx) => (
                            <div key={rowIdx} className="flex items-center gap-2">
                              <Select
                                value={row.product_id === "" ? "" : String(row.product_id)}
                                onValueChange={v => updateRow(name, rowIdx, "product_id", Number(v))}
                              >
                                <SelectTrigger className="flex-1 h-8 text-xs">
                                  <SelectValue placeholder="Select product…" />
                                </SelectTrigger>
                                <SelectContent>
                                  {allProducts.map(p => (
                                    <SelectItem key={p.product_id} value={String(p.product_id)} className="text-xs">
                                      {p.name} ({p.sku}) — stock: {p.current_stock}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <div className="flex items-center gap-1 shrink-0">
                                <span className="text-xs text-muted-foreground">×</span>
                                <Input
                                  type="number" min="0.001" step="0.001"
                                  value={row.quantity}
                                  onChange={e => updateRow(name, rowIdx, "quantity", e.target.value)}
                                  className="w-16 h-8 text-xs text-center"
                                />
                              </div>
                              {state.rows.length > 1 && (
                                <button
                                  onClick={() => removeRow(name, rowIdx)}
                                  className="text-muted-foreground hover:text-destructive shrink-0"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                          <button
                            onClick={() => addRow(name)}
                            className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 mt-1"
                          >
                            <Plus className="h-3 w-3" /> Add another product (combo)
                          </button>
                        </div>
                      ) : (
                        /* ── Add as new product ──────────────────────────── */
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-3">New Product Details</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">SKU *</Label>
                              <Input className="h-8 text-xs" placeholder="e.g. PROD-001" value={np.sku} onChange={e => updateNewProduct(name, "sku", e.target.value)} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Product Name *</Label>
                              <Input className="h-8 text-xs" value={np.name} onChange={e => updateNewProduct(name, "name", e.target.value)} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">HSN Code</Label>
                              <Input className="h-8 text-xs" placeholder="e.g. 901720" value={np.hsn_code} onChange={e => updateNewProduct(name, "hsn_code", e.target.value)} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Category</Label>
                              <Input className="h-8 text-xs" placeholder="e.g. Electronics" value={np.category} onChange={e => updateNewProduct(name, "category", e.target.value)} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Cost Price (₹)</Label>
                              <Input className="h-8 text-xs" type="number" placeholder="0.00" value={np.cost_price} onChange={e => updateNewProduct(name, "cost_price", e.target.value)} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Selling Price (₹) *</Label>
                              <Input className="h-8 text-xs" type="number" placeholder="0.00" value={np.selling_price} onChange={e => updateNewProduct(name, "selling_price", e.target.value)} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Current Stock</Label>
                              <Input className="h-8 text-xs" type="number" value={np.current_stock} onChange={e => updateNewProduct(name, "current_stock", e.target.value)} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Min Stock Level</Label>
                              <Input className="h-8 text-xs" type="number" value={np.min_stock_level} onChange={e => updateNewProduct(name, "min_stock_level", e.target.value)} />
                            </div>
                          </div>
                          <Button
                            className="mt-3 w-full bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs"
                            onClick={() => handleCreateNewProduct(name)}
                            disabled={savingNewFor[name]}
                          >
                            {savingNewFor[name]
                              ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Creating…</>
                              : "+ Create & Map Product"}
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground">Mappings saved will apply automatically next time</p>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setItemStates(prev => {
                    const next = { ...prev };
                    Object.keys(next).forEach(k => { next[k] = { ...next[k], skipped: true }; });
                    return next;
                  });
                }}
              >
                Skip All
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setMappingOpen(false); doApprove(); }}>
                Skip &amp; Approve
              </Button>
              <Button size="sm" onClick={handleSaveMappings}>
                Save &amp; Approve
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
