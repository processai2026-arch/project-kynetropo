import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, FileDown, Pencil, FileText, ChevronLeft, GripVertical, Library } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  listQuotations, getQuotation, createQuotation, updateQuotation, deleteQuotation,
  type QuotationListRow, type QuotationItem, type QuotationInput,
} from "@/lib/api/quotations";
import {
  listComponents, createComponent, bulkCreateComponents, deleteComponent,
  type LibraryComponent,
} from "@/lib/api/components";
import { downloadQuotationPdf } from "@/lib/quotationPdf";

const DEFAULT_TERMS = "1. 50% Advance payment\n2. 50% at Delivery\n3. Freight Charge Extra";
const today = () => new Date().toISOString().slice(0, 10);
const inr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const blankComponent = () => ({ group: "", name: "", make: "", qty: 1 });
const blankItem = (): QuotationItem => ({ name: "", make: "", qty: 1, unit: "Nos", rate: 0, amount: 0, components: [] });

type Header = {
  customer_name: string; customer_address: string; particular: string;
  quotation_date: string; gst_rate: number; terms: string; notes: string;
};
const blankHeader = (): Header => ({
  customer_name: "", customer_address: "", particular: "", quotation_date: today(),
  gst_rate: 18, terms: DEFAULT_TERMS, notes: "",
});

export default function QuotationBuilder() {
  const [view, setView] = useState<"list" | "form">("list");
  const [rows, setRows] = useState<QuotationListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [header, setHeader] = useState<Header>(blankHeader());
  const [items, setItems] = useState<QuotationItem[]>([blankItem()]);

  // ── component library ─────────────────────────────────────────────────────
  const [library, setLibrary] = useState<LibraryComponent[]>([]);
  const [dragOverItem, setDragOverItem] = useState<number | null>(null);
  const blankNewLib = () => ({ name: "", make: "", default_unit: "", category: "", default_qty: 1 });
  const [newLib, setNewLib] = useState(blankNewLib());

  const loadLibrary = () =>
    listComponents()
      .then(setLibrary)
      .catch(() => { /* library is best-effort; don't block the page */ });

  const load = () => {
    setLoading(true);
    listQuotations().then(setRows).catch((e) => toast.error(e?.message ?? "Failed to load quotations")).finally(() => setLoading(false));
  };
  useEffect(load, []);
  useEffect(() => { loadLibrary(); }, []);

  const subtotal = useMemo(() => items.reduce((s, it) => s + (Number(it.amount) || 0), 0), [items]);
  const gstAmount = useMemo(() => (subtotal * (Number(header.gst_rate) || 0)) / 100, [subtotal, header.gst_rate]);
  const grandTotal = subtotal + gstAmount;

  // ── form helpers ──────────────────────────────────────────────────────────
  const setH = (k: keyof Header, v: any) => setHeader((h) => ({ ...h, [k]: v }));
  const updItem = (i: number, patch: Partial<QuotationItem>) =>
    setItems((arr) => arr.map((it, idx) => {
      if (idx !== i) return it;
      const next = { ...it, ...patch };
      if (("qty" in patch || "rate" in patch) && !("amount" in patch)) next.amount = (Number(next.qty) || 0) * (Number(next.rate) || 0);
      return next;
    }));
  const addItem = () => setItems((a) => [...a, blankItem()]);
  const delItem = (i: number) => setItems((a) => (a.length > 1 ? a.filter((_, idx) => idx !== i) : a));
  const addComp = (i: number) => setItems((a) => a.map((it, idx) => idx === i ? { ...it, components: [...it.components, blankComponent()] } : it));
  const updComp = (i: number, ci: number, patch: any) =>
    setItems((a) => a.map((it, idx) => idx === i ? { ...it, components: it.components.map((c, cj) => cj === ci ? { ...c, ...patch } : c) } : it));
  const delComp = (i: number, ci: number) =>
    setItems((a) => a.map((it, idx) => idx === i ? { ...it, components: it.components.filter((_, cj) => cj !== ci) } : it));

  // ── library helpers ───────────────────────────────────────────────────────
  // Unique library names for the shared <datalist>.
  const libNames = useMemo(() => {
    const seen = new Set<string>();
    const out: LibraryComponent[] = [];
    for (const c of library) {
      const key = (c.name || "").trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key); out.push(c);
    }
    return out;
  }, [library]);

  // Library grouped by category for the palette.
  const libByCategory = useMemo(() => {
    const groups = new Map<string, LibraryComponent[]>();
    for (const c of library) {
      const cat = (c.category || "").trim() || "Uncategorised";
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(c);
    }
    return Array.from(groups.entries());
  }, [library]);

  const compFromLibrary = (c: LibraryComponent) => ({
    group: c.category || "", name: c.name, make: c.make || "", qty: c.default_qty || 1,
  });

  // Append a library component to a specific item's components list.
  const appendLibToItem = (i: number, c: LibraryComponent) =>
    setItems((a) => a.map((it, idx) => idx === i ? { ...it, components: [...it.components, compFromLibrary(c)] } : it));

  // "+" on a chip: append to the LAST item.
  const addLibToLastItem = (c: LibraryComponent) => {
    if (items.length === 0) return;
    appendLibToItem(items.length - 1, c);
    toast.success(`Added "${c.name}" to Item ${items.length}`);
  };

  const onDropOnItem = (i: number, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverItem(null);
    try {
      const raw = e.dataTransfer.getData("application/json");
      if (!raw) return;
      const c = JSON.parse(raw) as LibraryComponent;
      if (!c?.name) return;
      appendLibToItem(i, c);
    } catch { /* ignore malformed drag payloads */ }
  };

  // When a component name matches a library entry, auto-fill its make.
  const autofillFromLibrary = (i: number, ci: number, name: string) => {
    const match = library.find((c) => (c.name || "").trim().toLowerCase() === name.trim().toLowerCase());
    if (match) updComp(i, ci, { name, make: match.make || "" });
  };

  const addToLibrary = async () => {
    const name = newLib.name.trim();
    if (!name) { toast.error("Component name is required"); return; }
    try {
      await createComponent({
        name,
        make: newLib.make.trim() || undefined,
        default_unit: newLib.default_unit.trim() || undefined,
        category: newLib.category.trim() || undefined,
        default_qty: Number(newLib.default_qty) || undefined,
      });
      setNewLib(blankNewLib());
      await loadLibrary();
      toast.success(`"${name}" added to library`);
    } catch (e: any) { toast.error(e?.message ?? "Failed to add component"); }
  };

  const removeFromLibrary = async (c: LibraryComponent) => {
    try {
      await deleteComponent(c.component_id);
      await loadLibrary();
    } catch (e: any) { toast.error(e?.message ?? "Failed to delete component"); }
  };

  // Persist any manually-entered components not yet in the library (best-effort).
  const syncLibraryFromItems = async () => {
    try {
      const existing = new Set(
        library.map((c) => `${(c.name || "").trim().toLowerCase()}|${(c.make || "").trim().toLowerCase()}|${(c.category || "").trim().toLowerCase()}`)
      );
      const toAdd = new Map<string, Omit<LibraryComponent, "component_id">>();
      for (const it of items) {
        for (const c of it.components || []) {
          const name = (c.name || "").trim();
          if (!name) continue;
          const make = (c.make || "").trim();
          const category = (c.group || "").trim();
          const key = `${name.toLowerCase()}|${make.toLowerCase()}|${category.toLowerCase()}`;
          if (existing.has(key) || toAdd.has(key)) continue;
          toAdd.set(key, {
            name,
            make: make || undefined,
            category: category || undefined,
            default_qty: Number(c.qty) || undefined,
          });
        }
      }
      if (toAdd.size === 0) return;
      await bulkCreateComponents(Array.from(toAdd.values()));
      await loadLibrary();
    } catch { /* library sync must never block saving */ }
  };

  const startNew = () => { setEditingId(null); setHeader(blankHeader()); setItems([blankItem()]); setView("form"); };
  const startEdit = async (id: number) => {
    try {
      const q = await getQuotation(id);
      setEditingId(id);
      setHeader({
        customer_name: q.customer_name || "", customer_address: q.customer_address || "",
        particular: q.particular || "", quotation_date: (q.quotation_date || today()).slice(0, 10),
        gst_rate: Number(q.gst_rate ?? 18), terms: q.terms || DEFAULT_TERMS, notes: q.notes || "",
      });
      setItems(q.items?.length ? q.items.map((it) => ({ ...it, components: it.components || [] })) : [blankItem()]);
      setView("form");
    } catch (e: any) { toast.error(e?.message ?? "Failed to open quotation"); }
  };

  const payload = (): QuotationInput => ({
    ...header, gst_rate: Number(header.gst_rate) || 0,
    items: items.filter((it) => it.name.trim()).map((it) => ({
      ...it, qty: Number(it.qty) || 0, rate: Number(it.rate) || 0, amount: Number(it.amount) || 0,
      components: (it.components || []).filter((c) => (c.name || "").trim() || (c.group || "").trim()),
    })),
  });

  // mode "update" saves the open quotation; "new" always creates a fresh copy
  // (so an edited quotation can be saved as a separate new one).
  const save = async (downloadAfter = false, mode: "update" | "new" = "update") => {
    if (!header.customer_name.trim()) { toast.error("Customer (M/S) name is required"); return; }
    if (!items.some((it) => it.name.trim())) { toast.error("Add at least one line item"); return; }
    setSaving(true);
    try {
      const saved = editingId && mode === "update"
        ? await updateQuotation(editingId, payload())
        : await createQuotation(payload());
      toast.success(`Quotation ${saved.quotation_no} saved`);
      // Best-effort: remember any new manual components for next time.
      await syncLibraryFromItems();
      if (downloadAfter) await downloadQuotationPdf(saved);
      setView("list"); load();
    } catch (e: any) { toast.error(e?.message ?? "Failed to save quotation"); }
    finally { setSaving(false); }
  };

  const onDownload = async (id: number) => {
    try { await downloadQuotationPdf(await getQuotation(id)); }
    catch (e: any) { toast.error(e?.message ?? "Failed to generate PDF"); }
  };
  const onDelete = async (id: number, no: string) => {
    if (!confirm(`Delete quotation ${no}?`)) return;
    try { await deleteQuotation(id); toast.success("Quotation deleted"); load(); }
    catch (e: any) { toast.error(e?.message ?? "Failed to delete"); }
  };

  // ── LIST VIEW ───────────────────────────────────────────────────────────
  if (view === "list") {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Quotation Builder</h1>
            <p className="text-muted-foreground">Assemble quotations and download branded PDFs.</p>
          </div>
          <Button onClick={startNew} className="gap-2"><Plus className="h-4 w-4" /> New Quotation</Button>
        </div>

        <div className="rounded-xl border bg-card">
          <div className="grid grid-cols-12 gap-2 border-b px-4 py-2.5 text-xs font-semibold text-muted-foreground">
            <div className="col-span-2">Quotation No.</div>
            <div className="col-span-3">Customer</div>
            <div className="col-span-3">Particular</div>
            <div className="col-span-1">Date</div>
            <div className="col-span-1 text-right">Total</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>
          {loading ? (
            <div className="px-4 py-10 text-center text-muted-foreground">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="px-4 py-12 text-center text-muted-foreground">
              <FileText className="mx-auto mb-3 h-8 w-8 opacity-40" />
              No quotations yet. Click <span className="font-medium text-foreground">New Quotation</span> to create one.
            </div>
          ) : rows.map((r) => (
            <div key={r.quotation_id} className="grid grid-cols-12 items-center gap-2 border-b px-4 py-3 text-sm last:border-0">
              <div className="col-span-2 font-medium text-foreground">{r.quotation_no}</div>
              <div className="col-span-3 truncate">{r.customer_name}</div>
              <div className="col-span-3 truncate text-muted-foreground">{r.particular || "—"}</div>
              <div className="col-span-1 text-xs text-muted-foreground">{r.quotation_date ? r.quotation_date.slice(0, 10) : "—"}</div>
              <div className="col-span-1 text-right font-medium">{inr(r.grand_total)}</div>
              <div className="col-span-2 flex justify-end gap-1">
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => onDownload(r.quotation_id)} title="Download PDF"><FileDown className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => startEdit(r.quotation_id)} title="Edit"><Pencil className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => onDelete(r.quotation_id, r.quotation_no)} title="Delete"><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── FORM VIEW ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="gap-1" onClick={() => setView("list")}><ChevronLeft className="h-4 w-4" /> Back</Button>
          <h1 className="text-2xl font-bold text-foreground">{editingId ? "Edit Quotation" : "New Quotation"}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => save(false, "update")} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          {editingId && (
            <Button variant="outline" onClick={() => save(false, "new")} disabled={saving} title="Save the current edits as a brand-new quotation">Save as New</Button>
          )}
          <Button className="gap-2" onClick={() => save(true, "update")} disabled={saving}><FileDown className="h-4 w-4" /> Save &amp; Download PDF</Button>
        </div>
      </div>

      {/* Header */}
      <div className="rounded-xl border bg-card p-5 grid gap-4 md:grid-cols-2">
        <div><label className="text-sm font-medium">Customer (M/S) *</label><Input value={header.customer_name} onChange={(e) => setH("customer_name", e.target.value)} placeholder="Customer / company name" className="mt-1" /></div>
        <div><label className="text-sm font-medium">Particular</label><Input value={header.particular} onChange={(e) => setH("particular", e.target.value)} placeholder="e.g. BURNER PANEL" className="mt-1" /></div>
        <div className="md:col-span-2"><label className="text-sm font-medium">Customer Address</label><Input value={header.customer_address} onChange={(e) => setH("customer_address", e.target.value)} className="mt-1" /></div>
        <div><label className="text-sm font-medium">Quotation Date</label><Input type="date" value={header.quotation_date} onChange={(e) => setH("quotation_date", e.target.value)} className="mt-1" /></div>
        <div><label className="text-sm font-medium">GST %</label><Input type="number" value={header.gst_rate} onChange={(e) => setH("gst_rate", e.target.value)} className="mt-1" /></div>
      </div>

      {/* Shared datalist for component-name dropdown (manual selection) */}
      <datalist id="component-options">
        {libNames.map((c) => <option key={c.component_id} value={c.name} />)}
      </datalist>

      {/* Component Library palette */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Library className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Component Library</span>
          <span className="text-xs text-muted-foreground">Drag a chip onto an item, or click + to add it to the last item.</span>
        </div>

        {library.length === 0 ? (
          <p className="text-xs text-muted-foreground">No saved components yet. Add one below, or save a quotation to remember its components.</p>
        ) : (
          <div className="space-y-3">
            {libByCategory.map(([cat, comps]) => (
              <div key={cat}>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{cat}</div>
                <div className="flex flex-wrap gap-2">
                  {comps.map((c) => (
                    <div
                      key={c.component_id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/json", JSON.stringify(c));
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      className="group flex cursor-grab items-center gap-1 rounded-full border bg-muted/40 py-1 pl-2 pr-1 text-xs hover:bg-muted active:cursor-grabbing"
                      title={c.make ? `${c.name} · ${c.make}` : c.name}
                    >
                      <GripVertical className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium text-foreground">{c.name}</span>
                      {c.make && <span className="text-muted-foreground">· {c.make}</span>}
                      <button
                        type="button"
                        onClick={() => addLibToLastItem(c)}
                        className="ml-0.5 grid h-5 w-5 place-items-center rounded-full text-muted-foreground hover:bg-primary hover:text-primary-foreground"
                        title="Add to last item"
                      ><Plus className="h-3 w-3" /></button>
                      <button
                        type="button"
                        onClick={() => removeFromLibrary(c)}
                        className="grid h-5 w-5 place-items-center rounded-full text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
                        title="Remove from library"
                      ><Trash2 className="h-3 w-3" /></button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Inline add-to-library form */}
        <div className="grid items-end gap-2 border-t pt-3 md:grid-cols-12">
          <Input placeholder="Name *" value={newLib.name} onChange={(e) => setNewLib((s) => ({ ...s, name: e.target.value }))} className="md:col-span-3 h-8 text-sm" />
          <Input placeholder="Make" value={newLib.make} onChange={(e) => setNewLib((s) => ({ ...s, make: e.target.value }))} className="md:col-span-2 h-8 text-sm" />
          <Input placeholder="Unit" value={newLib.default_unit} onChange={(e) => setNewLib((s) => ({ ...s, default_unit: e.target.value }))} className="md:col-span-2 h-8 text-sm" />
          <Input placeholder="Category" value={newLib.category} onChange={(e) => setNewLib((s) => ({ ...s, category: e.target.value }))} className="md:col-span-2 h-8 text-sm" />
          <Input type="number" placeholder="Qty" value={newLib.default_qty} onChange={(e) => setNewLib((s) => ({ ...s, default_qty: Number(e.target.value) }))} className="md:col-span-1 h-8 text-sm" />
          <Button size="sm" variant="outline" className="md:col-span-2 h-8 gap-1 text-xs" onClick={addToLibrary}><Plus className="h-3.5 w-3.5" /> Add to library</Button>
        </div>
      </div>

      {/* Items */}
      <div className="space-y-4">
        {items.map((it, i) => (
          <div key={i} className="rounded-xl border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-muted-foreground">Item {i + 1}</span>
              <Button size="sm" variant="ghost" className="h-8 gap-1 text-destructive" onClick={() => delItem(i)} disabled={items.length === 1}><Trash2 className="h-4 w-4" /> Remove</Button>
            </div>
            <div className="grid gap-3 md:grid-cols-12">
              <div className="md:col-span-4"><label className="text-xs text-muted-foreground">Product name *</label><Input value={it.name} onChange={(e) => updItem(i, { name: e.target.value })} className="mt-1" /></div>
              <div className="md:col-span-2"><label className="text-xs text-muted-foreground">Make</label><Input value={it.make} onChange={(e) => updItem(i, { make: e.target.value })} className="mt-1" /></div>
              <div className="md:col-span-1"><label className="text-xs text-muted-foreground">Qty</label><Input type="number" value={it.qty} onChange={(e) => updItem(i, { qty: Number(e.target.value) })} className="mt-1" /></div>
              <div className="md:col-span-1"><label className="text-xs text-muted-foreground">Unit</label><Input value={it.unit} onChange={(e) => updItem(i, { unit: e.target.value })} className="mt-1" /></div>
              <div className="md:col-span-2"><label className="text-xs text-muted-foreground">Rate (₹)</label><Input type="number" value={it.rate} onChange={(e) => updItem(i, { rate: Number(e.target.value) })} className="mt-1" /></div>
              <div className="md:col-span-2"><label className="text-xs text-muted-foreground">Amount (₹)</label><Input type="number" value={it.amount} onChange={(e) => updItem(i, { amount: Number(e.target.value) })} className="mt-1" /></div>
            </div>

            {/* Components — drop target for library chips */}
            <div
              onDragOver={(e) => { e.preventDefault(); if (dragOverItem !== i) setDragOverItem(i); }}
              onDragLeave={() => setDragOverItem((cur) => (cur === i ? null : cur))}
              onDrop={(e) => onDropOnItem(i, e)}
              className={`rounded-lg p-3 transition-colors ${dragOverItem === i ? "bg-primary/10 ring-2 ring-primary ring-inset" : "bg-muted/30"}`}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Components / specification {dragOverItem === i && <span className="text-primary">— drop to add</span>}</span>
                <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => addComp(i)}><Plus className="h-3.5 w-3.5" /> Add component</Button>
              </div>
              {it.components.length === 0 && <p className="text-xs text-muted-foreground">No components added. Drag a chip from the library above.</p>}
              {it.components.map((c, ci) => (
                <div key={ci} className="mb-2 grid items-center gap-2 md:grid-cols-12">
                  <Input placeholder="Group (optional)" value={c.group} onChange={(e) => updComp(i, ci, { group: e.target.value })} className="md:col-span-3 h-8 text-sm" />
                  <Input list="component-options" placeholder="Component name" value={c.name} onChange={(e) => updComp(i, ci, { name: e.target.value })} onBlur={(e) => autofillFromLibrary(i, ci, e.target.value)} className="md:col-span-4 h-8 text-sm" />
                  <Input placeholder="Make" value={c.make} onChange={(e) => updComp(i, ci, { make: e.target.value })} className="md:col-span-3 h-8 text-sm" />
                  <Input type="number" placeholder="Qty" value={c.qty} onChange={(e) => updComp(i, ci, { qty: Number(e.target.value) })} className="md:col-span-1 h-8 text-sm" />
                  <Button size="sm" variant="ghost" className="md:col-span-1 h-8 w-8 p-0 text-destructive" onClick={() => delComp(i, ci)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          </div>
        ))}
        <Button variant="outline" onClick={addItem} className="gap-2"><Plus className="h-4 w-4" /> Add Item</Button>
      </div>

      {/* Totals + terms */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-5">
          <label className="text-sm font-medium">Terms &amp; Conditions</label>
          <Textarea value={header.terms} onChange={(e) => setH("terms", e.target.value)} rows={4} className="mt-1" />
        </div>
        <div className="rounded-xl border bg-card p-5 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="font-medium">{inr(subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">{header.gst_rate || 0}% GST</span><span className="font-medium">{inr(gstAmount)}</span></div>
          <div className="flex justify-between border-t pt-2 text-base font-bold text-primary"><span>Grand Total</span><span>{inr(grandTotal)}</span></div>
        </div>
      </div>
    </div>
  );
}
