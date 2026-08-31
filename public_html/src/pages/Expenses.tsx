import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Banknote, Camera, CheckCircle2, Eye,
  ImageIcon, Layers, Loader2, Pencil, Plus, Receipt, RefreshCw, Search, Sparkles, Trash2,
  TrendingUp, Upload, Wallet, X, XCircle,
} from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreatableCombobox } from "@/components/ui/creatable-combobox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "@/components/StatCard";
import { toast } from "sonner";
import {
  EXPENSE_CATEGORIES, expenseClaimsApi, expensesApi, type Expense, type ExpenseClaim,
  type ExpenseClaimPolicies, type ExpenseClaimStatus,
} from "@/lib/api/expenses";
import { employeesApi, type Employee } from "@/lib/api/hr";
import { extractBillData } from "@/lib/api/billExtract";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { ScrollableX } from "@/components/ui/scrollable-x";

const PAYMENT_MODES: Expense["paymentMode"][] = ["Cash", "Bank Transfer", "UPI", "Cheque", "Card"];
const OTHER = "Other" as const;

const expenseSchema = z.object({
  date: z.string().min(1, "Date is required"),
  category: z.string().trim().min(2, "Category required").max(60),
  vendor: z.string().trim().min(2, "Vendor required").max(120),
  description: z.string().trim().max(300).optional().default(""),
  amount: z.number().positive("Amount must be > 0").max(10_000_000),
  paymentMode: z.enum(["Cash", "Bank Transfer", "UPI", "Cheque", "Card"]),
  billUrl: z.string().optional(),
});

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const CHART_COLORS = [
  "hsl(200,70%,52%)", "hsl(210,70%,55%)", "hsl(30,90%,52%)", "hsl(280,55%,52%)",
  "hsl(45,90%,50%)", "hsl(0,72%,51%)", "hsl(240,60%,55%)", "hsl(185,72%,42%)",
  "hsl(330,60%,55%)", "hsl(190,65%,45%)", "hsl(265,55%,55%)",
];

interface FormState {
  date: string;
  category: string;          // any string (preset OR custom from "Other")
  categoryChoice: string;    // dropdown value: a preset OR "Other"
  vendor: string;
  description: string;
  amount: string;
  paymentMode: Expense["paymentMode"];
  billUrl?: string;
}

const emptyForm = (): FormState => ({
  date: new Date().toISOString().slice(0, 10),
  category: "Office Stationery",
  categoryChoice: "Office Stationery",
  vendor: "",
  description: "",
  amount: "",
  paymentMode: "Bank Transfer",
  billUrl: undefined,
});

export default function Expenses() {
  const [activeTab, setActiveTab] = useState("tracking");
  const [items, setItems] = useState<Expense[]>([]);
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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [minAmt, setMinAmt] = useState("");
  const [maxAmt, setMaxAmt] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [confirmDelete, setConfirmDelete] = useState<Expense | null>(null);

  const load = async () => {
    setLoading(true);
    try { setItems(await expensesApi.list()); } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const result = items.filter((e) => {
      if (filterCategory !== "all" && e.category !== filterCategory) return false;
      if (fromDate && e.date < fromDate) return false;
      if (toDate && e.date > toDate) return false;
      if (minAmt && e.amount < Number(minAmt)) return false;
      if (maxAmt && e.amount > Number(maxAmt)) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!e.vendor.toLowerCase().includes(q) &&
            !e.description.toLowerCase().includes(q) &&
            !e.id.toLowerCase().includes(q)) return false;
      }
      return true;
    });
    return [...result].sort((a, b) => {
      const av = (a as any)[sortKey] ?? "";
      const bv = (b as any)[sortKey] ?? "";
      const numKeys = ["total_amount","tax_amount","amount","lifetime_revenue","current_stock","damaged_stock","net_revenue","salary","balance_amount"];
      const cmp = numKeys.includes(sortKey) ? Number(av) - Number(bv) : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [items, filterCategory, fromDate, toDate, minAmt, maxAmt, search, sortKey, sortDir]);

  const summary = useMemo(() => {
    const total = filtered.reduce((s, e) => s + e.amount, 0);
    const byCat = new Map<string, number>();
    filtered.forEach((e) => byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount));
    const pieData = Array.from(byCat, ([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    const byMonth = new Map<string, number>();
    filtered.forEach((e) => {
      const m = e.date.slice(0, 7);
      byMonth.set(m, (byMonth.get(m) ?? 0) + e.amount);
    });
    const barData = Array.from(byMonth, ([month, amount]) => ({ month, amount }))
      .sort((a, b) => a.month.localeCompare(b.month));
    const top = pieData[0];
    return { total, count: filtered.length, pieData, barData, topCategory: top };
  }, [filtered]);

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [extracting, setExtracting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setDialogOpen(true); };
  const openEdit = (e: Expense) => {
    setEditing(e);
    const isPreset = (EXPENSE_CATEGORIES as readonly string[]).includes(e.category);
    setForm({
      date: e.date,
      category: e.category,
      categoryChoice: isPreset ? e.category : OTHER,
      vendor: e.vendor,
      description: e.description,
      amount: String(e.amount),
      paymentMode: e.paymentMode,
      billUrl: e.billUrl,
    });
    setDialogOpen(true);
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { toast.error("File must be under 5MB"); return; }
    if (!/^(image\/|application\/pdf)/.test(f.type)) { toast.error("Only images or PDF allowed"); return; }
    const reader = new FileReader();
    reader.onload = () => setForm((prev) => ({ ...prev, billUrl: reader.result as string }));
    reader.readAsDataURL(f);
  };

  const autoFillFromBill = async () => {
    if (!form.billUrl) { toast.error("Upload a bill first"); return; }
    setExtracting(true);
    try {
      const extracted = await extractBillData(form.billUrl);

      // If AI category matches a preset → select it directly
      // If not → select "Other" and fill custom text box with AI's suggestion
      const isPreset = (EXPENSE_CATEGORIES as readonly string[]).includes(extracted.category);
      const categoryChoice = isPreset ? extracted.category : OTHER;
      const category       = isPreset ? extracted.category : (extracted.category || "");

      setForm((prev) => ({
        ...prev,
        date:           extracted.date        || prev.date,
        vendor:         extracted.vendor      || prev.vendor,
        amount:         extracted.amount > 0  ? String(extracted.amount) : prev.amount,
        description:    extracted.description || prev.description,
        category,
        categoryChoice,
      }));

      toast.success("Bill scanned — please review and correct any fields.");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not extract bill");
    } finally {
      setExtracting(false);
    }
  };

  const onSubmit = async () => {
    const parsed = expenseSchema.safeParse({ ...form, amount: Number(form.amount) });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Invalid input"); return; }
    try {
      if (editing) {
        await expensesApi.update(editing.id, parsed.data as Partial<Expense>);
        toast.success("Expense updated");
      } else {
        await expensesApi.create(parsed.data as Omit<Expense, "id" | "createdBy">);
        toast.success("Expense added");
      }
      setDialogOpen(false);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const onDelete = async () => {
    if (!confirmDelete) return;
    try {
      await expensesApi.remove(confirmDelete.id);
      toast.success("Expense deleted");
      setConfirmDelete(null);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Expense Management</h1>
          <p className="text-muted-foreground">Track business expenses and manage employee reimbursements.</p>
        </div>
        {activeTab === "tracking" && (
          <div className="flex items-center gap-2">
            {(sortKey !== "created_at" || sortDir !== "desc") && (
              <Button variant="outline" size="sm" onClick={resetSort} className="text-xs">
                <RefreshCw className="h-3 w-3 mr-1" />Reset Sort
              </Button>
            )}
            <Button onClick={openCreate}><Plus className="h-4 w-4" />Add Expense</Button>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="tracking">Expense Tracking</TabsTrigger>
          <TabsTrigger value="claims">Employee Claims</TabsTrigger>
        </TabsList>

        <TabsContent value="tracking" className="space-y-6 mt-6">
      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Expenses" value={inr(summary.total)} subtitle={`${summary.count} entries`} icon={Wallet} />
        <StatCard title="Categories" value={String(new Set(filtered.map((e) => e.category)).size)} subtitle="active" icon={Layers} />
        <StatCard title="Top Category" value={summary.topCategory ? summary.topCategory.name.split(" - ")[0] : "—"} subtitle={summary.topCategory ? inr(summary.topCategory.value) : ""} icon={TrendingUp} />
        <StatCard title="Avg / Entry" value={summary.count ? inr(Math.round(summary.total / summary.count)) : "₹0"} subtitle="filtered set" icon={Receipt} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border p-6 shadow-sm">
          <h3 className="font-semibold text-card-foreground mb-1">Expense Breakdown</h3>
          <p className="text-xs text-muted-foreground mb-4">Share by category</p>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={summary.pieData} dataKey="value" nameKey="name" outerRadius={90} innerRadius={50}>
                {summary.pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => inr(v)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-card rounded-xl border p-6 shadow-sm">
          <h3 className="font-semibold text-card-foreground mb-1">Monthly Spend</h3>
          <p className="text-xs text-muted-foreground mb-4">Aggregated by month (filtered)</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={summary.barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `₹${v / 1000}k`} />
              <Tooltip formatter={(v: number) => inr(v)} />
              <Bar dataKey="amount" fill="hsl(200,70%,52%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-xl border p-4 shadow-sm grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="lg:col-span-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search vendor, description, ID..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {EXPENSE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} placeholder="From" />
        <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} placeholder="To" />
        <div className="flex gap-2">
          <Input type="number" placeholder="Min ₹" value={minAmt} onChange={(e) => setMinAmt(e.target.value.replace(/^0+(?=\d)/, ''))} />
          <Input type="number" placeholder="Max ₹" value={maxAmt} onChange={(e) => setMaxAmt(e.target.value.replace(/^0+(?=\d)/, ''))} />
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <ScrollableX>
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-medium cursor-pointer hover:text-foreground select-none" onClick={() => handleSort("id")}>ID<SortIcon col="id" /></th>
                <th className="text-left px-4 py-3 font-medium cursor-pointer hover:text-foreground select-none" onClick={() => handleSort("date")}>Date<SortIcon col="date" /></th>
                <th className="text-left px-4 py-3 font-medium cursor-pointer hover:text-foreground select-none" onClick={() => handleSort("category")}>Category<SortIcon col="category" /></th>
                <th className="text-left px-4 py-3 font-medium cursor-pointer hover:text-foreground select-none" onClick={() => handleSort("vendor")}>Vendor<SortIcon col="vendor" /></th>
                <th className="text-left px-4 py-3 font-medium cursor-pointer hover:text-foreground select-none" onClick={() => handleSort("description")}>Description<SortIcon col="description" /></th>
                <th className="text-left px-4 py-3 font-medium cursor-pointer hover:text-foreground select-none" onClick={() => handleSort("paymentMode")}>Mode<SortIcon col="paymentMode" /></th>
                <th className="text-right px-4 py-3 font-medium cursor-pointer hover:text-foreground select-none" onClick={() => handleSort("amount")}>Amount<SortIcon col="amount" /></th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">Loading…</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">No expenses match the filters.</td></tr>
              )}
              {!loading && filtered.map((e) => (
                <tr key={e.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium text-card-foreground">{e.id}</td>
                  <td className="px-4 py-3">{e.date}</td>
                  <td className="px-4 py-3"><span className="text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground">{e.category}</span></td>
                  <td className="px-4 py-3">{e.vendor}</td>
                  <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{e.description}</td>
                  <td className="px-4 py-3">{e.paymentMode}</td>
                  <td className="px-4 py-3 text-right font-semibold">{inr(e.amount)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(e)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setConfirmDelete(e)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollableX>
      </div>

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" onInteractOutside={e => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Expense" : "Add Expense"}</DialogTitle>
            <DialogDescription>Snap a photo of the bill — we'll auto-fill the details. You can edit before saving.</DialogDescription>
          </DialogHeader>

          {/* === Bill / Receipt — TOP === */}
          <div
            className={`rounded-xl border-2 border-dashed bg-muted/30 p-4 space-y-3 transition-colors ${dragOver ? "border-primary bg-primary/5" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Bill / Receipt</Label>
              <span className="text-xs text-muted-foreground">Image or PDF · max 5MB</span>
            </div>

            {/* Hidden inputs driven by the two buttons */}
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            <input
              ref={galleryRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0])}
            />

            {!form.billUrl && (
              <>
                {dragOver ? (
                  <div className="flex flex-col items-center justify-center py-6 gap-2 pointer-events-none">
                    <Upload className="h-8 w-8 text-primary animate-bounce" />
                    <span className="text-sm font-medium text-primary">Drop file here</span>
                  </div>
                ) : (
                  <>
                    <div
                      className="flex flex-col items-center justify-center py-4 gap-1 cursor-pointer rounded-lg hover:bg-muted/50 transition-colors"
                      onClick={() => galleryRef.current?.click()}
                    >
                      <Upload className="h-6 w-6 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Drag & drop a file here, or click to browse</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button type="button" variant="outline" onClick={() => cameraRef.current?.click()}>
                        <Camera className="h-4 w-4" /> Take Photo
                      </Button>
                      <Button type="button" variant="outline" onClick={() => galleryRef.current?.click()}>
                        <ImageIcon className="h-4 w-4" /> Upload from Gallery
                      </Button>
                    </div>
                  </>
                )}
              </>
            )}

            {form.billUrl && (
              <div className="space-y-2">
                <div className="relative bg-background rounded-lg border overflow-hidden">
                  {form.billUrl.startsWith("data:image") ? (
                    <img src={form.billUrl} alt="Bill preview" className="w-full max-h-48 object-contain bg-muted/40" />
                  ) : (
                    <div className="p-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                      <Upload className="h-4 w-4" /> PDF attached
                    </div>
                  )}
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="absolute top-2 right-2 h-7 w-7"
                    onClick={() => setForm({ ...form, billUrl: undefined })}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => galleryRef.current?.click()}>
                    Replace
                  </Button>
                  <Button type="button" size="sm" className="flex-1" disabled={extracting} onClick={autoFillFromBill}>
                    {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    Auto-fill from photo
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* === Form fields === */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-1">
              <Label>Date</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="col-span-1">
              <Label>Amount (₹)</Label>
              <Input type="number" min="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/^0+(?=\d)/, '') })} />
            </div>

            <div className="col-span-2">
              <Label>Category</Label>
              <Select
                value={form.categoryChoice}
                onValueChange={(v) => setForm({
                  ...form,
                  categoryChoice: v,
                  category: v === OTHER ? "" : v,
                })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>

              {form.categoryChoice === OTHER && (
                <div className="mt-2">
                  <Input
                    autoFocus
                    placeholder="Enter custom category name"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  />
                </div>
              )}
            </div>

            <div className="col-span-2">
              <Label>Vendor / Payee</Label>
              <Input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} placeholder="e.g. Sri Lakshmi Traders" />
            </div>
            <div className="col-span-2">
              <Label>Description</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Notes / reference" />
            </div>
            <div className="col-span-2">
              <Label>Payment Mode</Label>
              <CreatableCombobox optionsKey="expense_payment_mode" value={form.paymentMode ?? ""} onChange={v => setForm({ ...form, paymentMode: v as any })} placeholder="Select payment mode…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={onSubmit}>{editing ? "Save changes" : "Add expense"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete expense?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete && <>This will permanently remove <strong>{confirmDelete.id}</strong> ({inr(confirmDelete.amount)}). This cannot be undone.</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
        </TabsContent>

        <TabsContent value="claims" className="mt-6">
          <ClaimsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface ClaimLineForm {
  expenseDate: string;
  category: string;
  description: string;
  amount: string;
  receiptUrl?: string;
  receiptName?: string;
}

const emptyClaimLine = (): ClaimLineForm => ({
  expenseDate: new Date().toISOString().slice(0, 10),
  category: "Office Stationery",
  description: "",
  amount: "",
});

function ClaimsPanel() {
  const [claims, setClaims] = useState<ExpenseClaim[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [policies, setPolicies] = useState<ExpenseClaimPolicies>({
    categoryLimits: {},
    defaultLimit: 5000,
    mode: "warning",
  });
  const [status, setStatus] = useState<ExpenseClaimStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [selected, setSelected] = useState<ExpenseClaim | null>(null);
  const [employeeKey, setEmployeeKey] = useState("");
  const [purpose, setPurpose] = useState("");
  const [lines, setLines] = useState<ClaimLineForm[]>([emptyClaimLine()]);
  const [saving, setSaving] = useState(false);
  const [decision, setDecision] = useState<{ claim: ExpenseClaim; kind: "approve" | "reject" | "reimburse" } | null>(null);
  const [reason, setReason] = useState("");
  const [reimbursementDate, setReimbursementDate] = useState(new Date().toISOString().slice(0, 10));
  const [reimbursementReference, setReimbursementReference] = useState("");

  const loadClaims = async (nextStatus = status) => {
    setLoading(true);
    try {
      setClaims(await expenseClaimsApi.list(nextStatus));
    } catch (e: any) {
      toast.error(e.message ?? "Could not load expense claims");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.all([expenseClaimsApi.policies(), employeesApi.list()])
      .then(([policyData, employeeData]) => {
        setPolicies(policyData);
        setEmployees(employeeData.filter((employee) => employee.active));
      })
      .catch((e: any) => toast.error(e.message ?? "Could not load claim setup"));
    loadClaims("all");
  }, []);

  const categoryTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    lines.forEach((line) => {
      totals[line.category] = (totals[line.category] ?? 0) + (Number(line.amount) || 0);
    });
    return totals;
  }, [lines]);

  const total = useMemo(
    () => lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0),
    [lines],
  );

  const summary = useMemo(() => ({
    pending: claims.filter((claim) => claim.status === "pending").length,
    approved: claims.filter((claim) => claim.status === "approved").length,
    reimbursed: claims.filter((claim) => claim.status === "reimbursed").length,
    amount: claims.reduce((sum, claim) => sum + claim.totalAmount, 0),
  }), [claims]);

  const policyLimit = (category: string) => policies.categoryLimits[category] ?? policies.defaultLimit;
  const hasWarning = (line: ClaimLineForm) => categoryTotals[line.category] > policyLimit(line.category);

  const updateLine = (index: number, patch: Partial<ClaimLineForm>) => {
    setLines((current) => current.map((line, lineIndex) => (
      lineIndex === index ? { ...line, ...patch } : line
    )));
  };

  const attachReceipt = (index: number, file?: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Receipt must be under 5MB");
      return;
    }
    if (!/^(image\/|application\/pdf)/.test(file.type)) {
      toast.error("Receipt must be an image or PDF");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => updateLine(index, { receiptUrl: reader.result as string, receiptName: file.name });
    reader.readAsDataURL(file);
  };

  const resetSubmit = () => {
    setEmployeeKey("");
    setPurpose("");
    setLines([emptyClaimLine()]);
  };

  const submitClaim = async () => {
    if (!employeeKey) {
      toast.error("Select an employee");
      return;
    }
    if (!purpose.trim()) {
      toast.error("Enter the business purpose");
      return;
    }
    if (lines.some((line) => !line.expenseDate || !line.category || !line.description.trim() || Number(line.amount) <= 0)) {
      toast.error("Complete the date, category, description and amount for every line");
      return;
    }

    setSaving(true);
    try {
      await expenseClaimsApi.create({
        employeeKey,
        purpose: purpose.trim(),
        items: lines.map((line) => ({
          expenseDate: line.expenseDate,
          category: line.category,
          description: line.description.trim(),
          amount: Number(line.amount),
          receiptUrl: line.receiptUrl,
        })),
      });
      toast.success("Expense claim submitted");
      setSubmitOpen(false);
      resetSubmit();
      await loadClaims(status);
    } catch (e: any) {
      toast.error(e.message ?? "Could not submit claim");
    } finally {
      setSaving(false);
    }
  };

  const openDecision = (claim: ExpenseClaim, kind: "approve" | "reject" | "reimburse") => {
    setDecision({ claim, kind });
    setReason("");
    setReimbursementDate(new Date().toISOString().slice(0, 10));
    setReimbursementReference("");
  };

  const applyDecision = async () => {
    if (!decision) return;
    if (decision.kind === "reject" && !reason.trim()) {
      toast.error("Rejection reason is required");
      return;
    }
    if (decision.kind === "reimburse" && (!reimbursementDate || !reimbursementReference.trim())) {
      toast.error("Reimbursement date and reference are required");
      return;
    }

    setSaving(true);
    try {
      if (decision.kind === "approve") {
        await expenseClaimsApi.approve(decision.claim.claimId, reason.trim());
      } else if (decision.kind === "reject") {
        await expenseClaimsApi.reject(decision.claim.claimId, reason.trim());
      } else {
        await expenseClaimsApi.reimburse(
          decision.claim.claimId,
          reimbursementDate,
          reimbursementReference.trim(),
        );
      }
      toast.success(
        decision.kind === "approve"
          ? "Claim approved"
          : decision.kind === "reject"
            ? "Claim rejected"
            : "Claim marked reimbursed",
      );
      setDecision(null);
      await loadClaims(status);
    } catch (e: any) {
      toast.error(e.message ?? "Could not update claim");
    } finally {
      setSaving(false);
    }
  };

  const statusBadge = (claimStatus: ExpenseClaimStatus) => {
    if (claimStatus === "approved") return <Badge className="bg-emerald-600 hover:bg-emerald-600">Approved</Badge>;
    if (claimStatus === "rejected") return <Badge variant="destructive">Rejected</Badge>;
    if (claimStatus === "reimbursed") return <Badge className="bg-blue-600 hover:bg-blue-600">Reimbursed</Badge>;
    return <Badge variant="secondary">Pending</Badge>;
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Employee Expense Claims</h2>
          <p className="text-sm text-muted-foreground">Submit, review and reimburse employee-paid business expenses.</p>
        </div>
        <Button onClick={() => setSubmitOpen(true)}><Plus className="h-4 w-4" />Submit Claim</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Pending" value={String(summary.pending)} subtitle="awaiting review" icon={Receipt} />
        <StatCard title="Approved" value={String(summary.approved)} subtitle="awaiting payment" icon={CheckCircle2} />
        <StatCard title="Reimbursed" value={String(summary.reimbursed)} subtitle="completed" icon={Banknote} />
        <StatCard title="Claim Value" value={inr(summary.amount)} subtitle="current filter" icon={Wallet} />
      </div>

      <div className="flex items-center gap-3">
        <Label className="whitespace-nowrap">Status</Label>
        <Select
          value={status}
          onValueChange={(value) => {
            const next = value as ExpenseClaimStatus | "all";
            setStatus(next);
            loadClaims(next);
          }}
        >
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All claims</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="reimbursed">Reimbursed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg overflow-hidden bg-card">
        <ScrollableX>
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Claim</th>
                <th className="text-left px-4 py-3 font-medium">Employee</th>
                <th className="text-left px-4 py-3 font-medium">Submitted</th>
                <th className="text-left px-4 py-3 font-medium">Purpose</th>
                <th className="text-center px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3 font-medium">Amount</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">Loading...</td></tr>}
              {!loading && claims.length === 0 && (
                <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">No claims found.</td></tr>
              )}
              {!loading && claims.map((claim) => (
                <tr key={claim.claimId} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">
                    <div className="flex items-center gap-2">
                      {claim.claimNumber}
                      {claim.hasPolicyWarnings && <AlertTriangle className="h-4 w-4 text-amber-600" />}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{claim.employeeName}</div>
                    <div className="text-xs text-muted-foreground">{claim.employeeKey}</div>
                  </td>
                  <td className="px-4 py-3">{claim.submittedAt.slice(0, 10)}</td>
                  <td className="px-4 py-3 max-w-xs truncate">{claim.purpose}</td>
                  <td className="px-4 py-3 text-center">{statusBadge(claim.status)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{inr(claim.totalAmount)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <Button size="icon" variant="ghost" title="View claim" onClick={() => setSelected(claim)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {claim.status === "pending" && (
                        <>
                          <Button size="icon" variant="ghost" title="Approve" onClick={() => openDecision(claim, "approve")}>
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          </Button>
                          <Button size="icon" variant="ghost" title="Reject" onClick={() => openDecision(claim, "reject")}>
                            <XCircle className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                      {claim.status === "approved" && (
                        <Button size="icon" variant="ghost" title="Mark reimbursed" onClick={() => openDecision(claim, "reimburse")}>
                          <Banknote className="h-4 w-4 text-blue-600" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollableX>
      </div>

      <Dialog open={submitOpen} onOpenChange={(open) => { setSubmitOpen(open); if (!open) resetSubmit(); }}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto" onInteractOutside={e => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Submit Employee Expense Claim</DialogTitle>
            <DialogDescription>Claims are submitted as pending. Category limits create warnings and do not block submission.</DialogDescription>
          </DialogHeader>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Employee</Label>
              <Select value={employeeKey} onValueChange={setEmployeeKey}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>{employee.name} ({employee.id})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Business purpose</Label>
              <Input value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="e.g. Client visit and local travel" />
            </div>
          </div>

          <div className="space-y-3">
            {lines.map((line, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Expense line {index + 1}</h3>
                  {lines.length > 1 && (
                    <Button size="icon" variant="ghost" title="Remove line" onClick={() => setLines((current) => current.filter((_, i) => i !== index))}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
                <div className="grid md:grid-cols-4 gap-3">
                  <div>
                    <Label>Date</Label>
                    <Input type="date" value={line.expenseDate} onChange={(event) => updateLine(index, { expenseDate: event.target.value })} />
                  </div>
                  <div>
                    <Label>Category</Label>
                    <CreatableCombobox optionsKey="general_expense_category" value={line.category ?? ""} onChange={value => updateLine(index, { category: value })} placeholder="Select category…" />
                  </div>
                  <div>
                    <Label>Amount (₹)</Label>
                    <Input type="number" min="1" value={line.amount} onChange={(event) => updateLine(index, { amount: event.target.value })} />
                  </div>
                  <div>
                    <Label>Receipt</Label>
                    <Input type="file" accept="image/*,application/pdf" onChange={(event) => attachReceipt(index, event.target.files?.[0])} />
                  </div>
                </div>
                <div>
                  <Label>Description</Label>
                  <Input value={line.description} onChange={(event) => updateLine(index, { description: event.target.value })} placeholder="What was purchased and why?" />
                </div>
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-muted-foreground">{line.receiptName ? `Attached: ${line.receiptName}` : "No receipt attached"}</span>
                  {hasWarning(line) && (
                    <span className="text-amber-700 flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Category total {inr(categoryTotals[line.category])} exceeds {inr(policyLimit(line.category))}
                    </span>
                  )}
                </div>
              </div>
            ))}
            <Button variant="outline" onClick={() => setLines((current) => [...current, emptyClaimLine()])}>
              <Plus className="h-4 w-4" />Add Line
            </Button>
          </div>

          <DialogFooter className="items-center sm:justify-between">
            <div className="text-base font-semibold">Claim total: {inr(total)}</div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSubmitOpen(false)}>Cancel</Button>
              <Button disabled={saving} onClick={submitClaim}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}Submit Claim
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected?.claimNumber}</DialogTitle>
            <DialogDescription>{selected?.employeeName} · {selected?.purpose}</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                {statusBadge(selected.status)}
                <span className="text-lg font-semibold">{inr(selected.totalAmount)}</span>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <ScrollableX>
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-3 py-2">Date</th>
                        <th className="text-left px-3 py-2">Category</th>
                        <th className="text-left px-3 py-2">Description</th>
                        <th className="text-right px-3 py-2">Amount</th>
                        <th className="text-center px-3 py-2">Receipt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.items.map((line) => (
                        <tr key={line.itemId} className="border-t">
                          <td className="px-3 py-2">{line.expenseDate}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1">
                              {line.category}
                              {line.policyWarning && <AlertTriangle className="h-4 w-4 text-amber-600" />}
                            </div>
                            {line.policyWarning && <div className="text-xs text-amber-700">Limit {inr(line.policyLimit)}</div>}
                          </td>
                          <td className="px-3 py-2">{line.description}</td>
                          <td className="px-3 py-2 text-right font-medium">{inr(line.amount)}</td>
                          <td className="px-3 py-2 text-center">
                            {line.receiptUrl ? (
                              <Button size="sm" variant="outline" onClick={() => window.open(line.receiptUrl, "_blank", "noopener,noreferrer")}>View</Button>
                            ) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollableX>
              </div>
              {selected.approvalNote && <p className="text-sm"><strong>Approval note:</strong> {selected.approvalNote}</p>}
              {selected.rejectionReason && <p className="text-sm text-destructive"><strong>Rejection reason:</strong> {selected.rejectionReason}</p>}
              {selected.reimbursementReference && (
                <p className="text-sm"><strong>Reimbursement:</strong> {selected.reimbursementDate} · {selected.reimbursementReference}</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!decision} onOpenChange={(open) => !open && setDecision(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {decision?.kind === "approve" ? "Approve Claim" : decision?.kind === "reject" ? "Reject Claim" : "Mark Reimbursed"}
            </DialogTitle>
            <DialogDescription>{decision?.claim.claimNumber} · {decision && inr(decision.claim.totalAmount)}</DialogDescription>
          </DialogHeader>
          {decision?.kind === "reimburse" ? (
            <div className="space-y-3">
              <div>
                <Label>Reimbursement date</Label>
                <Input type="date" value={reimbursementDate} onChange={(event) => setReimbursementDate(event.target.value)} />
              </div>
              <div>
                <Label>Payment reference</Label>
                <Input value={reimbursementReference} onChange={(event) => setReimbursementReference(event.target.value)} placeholder="UTR, cheque number or cash voucher" />
              </div>
            </div>
          ) : (
            <div>
              <Label>{decision?.kind === "reject" ? "Rejection reason" : "Approval note (optional)"}</Label>
              <Textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecision(null)}>Cancel</Button>
            <Button
              variant={decision?.kind === "reject" ? "destructive" : "default"}
              disabled={saving}
              onClick={applyDecision}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {decision?.kind === "approve" ? "Approve" : decision?.kind === "reject" ? "Reject" : "Confirm Reimbursement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
