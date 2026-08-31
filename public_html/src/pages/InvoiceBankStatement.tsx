import { useState, useEffect, useRef } from "react";
import { apiFetch } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { CreatableCombobox } from "@/components/ui/creatable-combobox";
import { toast } from "sonner";
import { Upload, Loader2, CloudUpload, RefreshCw, Link, FileText, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

interface BankEntry {
  id: number;
  transaction_date: string;
  description: string;
  amount: number;
  type: "credit" | "debit";
  reconcile_status: "matched" | "partial" | "unmatched";
  reference?: string;
}

interface UploadedStatement {
  id: number;
  filename: string;
  stmt_type: string;
  status: string;
  created_at: string;
}

const STATUS_FILTERS = ["all", "matched", "partial", "unmatched"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const filterBadge: Record<string, string> = {
  matched:   "bg-emerald-50 text-emerald-700 border-emerald-200",
  partial:   "bg-amber-50 text-amber-600 border-amber-200",
  unmatched: "bg-red-50 text-red-600 border-red-200",
};

export default function InvoiceBankStatement() {
  const [tab, setTab] = useState<"upload" | "reconcile">("upload");
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
  const [statementType, setStatementType] = useState("all");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [statements, setStatements] = useState<UploadedStatement[]>([]);
  const [statementsLoading, setStatementsLoading] = useState(false);
  const [entries, setEntries] = useState<BankEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [reconciling, setReconciling] = useState(false);
  const [matchingId, setMatchingId] = useState<number | null>(null);

  const loadStatements = async () => {
    setStatementsLoading(true);
    try {
      const res = await apiFetch<{ data: UploadedStatement[] }>("/admin/bank-statements");
      setStatements(res.data ?? []);
    } catch { /* silent */ }
    finally { setStatementsLoading(false); }
  };

  const loadEntries = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ data: BankEntry[] }>("/admin/bank-statements/entries");
      setEntries(res.data ?? []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "reconcile") { loadStatements(); loadEntries(); }
  }, [tab]);

  const handleUpload = async () => {
    if (!uploadFile) { toast.error("Select a file first"); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      fd.append("statement_type", statementType);
      await apiFetch("/admin/bank-statements/upload", { method: "POST", body: fd });
      toast.success("Statement uploaded successfully");
      setUploadFile(null);
      setTab("reconcile");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleRunReconcile = async () => {
    setReconciling(true);
    try {
      await apiFetch("/admin/bank-statements/reconcile/run", { method: "POST" });
      toast.success("Reconciliation complete");
      loadEntries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reconciliation failed");
    } finally {
      setReconciling(false);
    }
  };

  const handleMatch = async (id: number) => {
    setMatchingId(id);
    try {
      await apiFetch(`/admin/bank-statements/entries/${id}/match`, { method: "POST" });
      toast.success("Entry matched");
      loadEntries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Match failed");
    } finally {
      setMatchingId(null);
    }
  };

  const filtered = (statusFilter === "all" ? entries : entries.filter((e) => e.reconcile_status === statusFilter));
  const sortedFiltered = [...filtered].sort((a, b) => {
    const av = (a as any)[sortKey] ?? "";
    const bv = (b as any)[sortKey] ?? "";
    const numKeys = ["total_amount","tax_amount","amount","lifetime_revenue","current_stock","damaged_stock","net_revenue","salary","balance_amount"];
    const cmp = numKeys.includes(sortKey) ? Number(av) - Number(bv) : String(av).localeCompare(String(bv));
    return sortDir === "asc" ? cmp : -cmp;
  });
  const fmt = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Bank Statements</h1>
      </div>

      <div className="bg-card rounded-xl border shadow-sm">
        <div className="flex gap-1 p-4 border-b">
          {(["upload", "reconcile"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={cn("px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize",
                tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50")}>
              {t === "upload" ? "Upload" : "Statements & Reconcile"}
            </button>
          ))}
        </div>

        {tab === "upload" && (
          <div className="p-6 space-y-4 max-w-lg">
            <div className="space-y-1.5">
              <Label>Statement Type</Label>
              <CreatableCombobox optionsKey="statement_type" value={statementType} onChange={v => setStatementType(v)} />
            </div>
            <div
              className={cn("border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors",
                dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50")}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) setUploadFile(f); }}
              onClick={() => fileInputRef.current?.click()}
            >
              <CloudUpload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              {uploadFile ? (
                <p className="text-sm text-foreground font-medium">{uploadFile.name}</p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">Drag & drop or click to select</p>
                  <p className="text-xs text-muted-foreground mt-1">PDF, CSV, XLS, XLSX supported</p>
                </>
              )}
              <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.csv,.xls,.xlsx"
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} />
            </div>
            <Button onClick={handleUpload} disabled={uploading || !uploadFile}>
              {uploading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Uploading…</> : <><Upload className="h-4 w-4 mr-2" />Upload Statement</>}
            </Button>
          </div>
        )}

        {tab === "reconcile" && (
          <div className="p-4 space-y-6">
            {/* Uploaded statements list */}
            <div>
              <h2 className="text-sm font-semibold text-card-foreground mb-3">Uploaded Statements</h2>
              <div className="overflow-x-auto eco-float-scroll">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      {["Filename", "Type", "Status", "Uploaded On"].map(h => (
                        <th key={h} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {statementsLoading && Array.from({ length: 3 }).map((_, i) => (
                      <tr key={i} className="border-b">{Array.from({ length: 4 }).map((__, j) => <td key={j} className="py-3 px-4"><Skeleton className="h-4 w-32" /></td>)}</tr>
                    ))}
                    {!statementsLoading && statements.length === 0 && (
                      <tr><td colSpan={4} className="px-6 py-6 text-center text-muted-foreground text-sm">No statements uploaded yet</td></tr>
                    )}
                    {!statementsLoading && statements.map(s => (
                      <tr key={s.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 flex items-center gap-2 text-card-foreground">
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />{s.filename}
                        </td>
                        <td className="py-3 px-4 capitalize text-card-foreground">{s.stmt_type}</td>
                        <td className="py-3 px-4">
                          <Badge className="border bg-blue-50 text-blue-600 border-blue-200 capitalize">{s.status}</Badge>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground text-xs">{new Date(s.created_at).toLocaleDateString("en-IN")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Reconciliation entries */}
            <div>
              <div className="flex items-center gap-3 flex-wrap mb-3">
                <h2 className="text-sm font-semibold text-card-foreground">Transaction Entries</h2>
                <div className="flex gap-1 ml-auto">
                  {STATUS_FILTERS.map((f) => (
                    <button key={f} onClick={() => setStatusFilter(f)}
                      className={cn("px-3 py-1 rounded-full text-xs font-medium border transition-colors capitalize",
                        statusFilter === f ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground")}>
                      {f}
                    </button>
                  ))}
                </div>
                <Button size="sm" variant="outline" onClick={handleRunReconcile} disabled={reconciling}>
                  {reconciling ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Running…</> : <><RefreshCw className="h-4 w-4 mr-2" />Run Reconciliation</>}
                </Button>
                {(sortKey !== "created_at" || sortDir !== "desc") && (
                  <Button variant="outline" size="sm" onClick={resetSort} className="text-xs">
                    <RefreshCw className="h-3 w-3 mr-1" />Reset Sort
                  </Button>
                )}
              </div>

              <div className="overflow-x-auto eco-float-scroll">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th onClick={() => handleSort("transaction_date")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">Date<SortIcon col="transaction_date" /></th>
                      <th onClick={() => handleSort("description")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">Description<SortIcon col="description" /></th>
                      <th onClick={() => handleSort("amount")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">Amount<SortIcon col="amount" /></th>
                      <th onClick={() => handleSort("type")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">Type<SortIcon col="type" /></th>
                      <th onClick={() => handleSort("reconcile_status")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">Status<SortIcon col="reconcile_status" /></th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b">{Array.from({ length: 6 }).map((__, j) => <td key={j} className="py-3 px-4"><Skeleton className="h-4 w-24" /></td>)}</tr>
                    ))}
                    {!loading && filtered.length === 0 && (
                      <tr><td colSpan={6} className="px-6 py-8 text-center text-muted-foreground text-sm">
                        No transaction entries yet. Upload a CSV bank statement to populate entries.
                      </td></tr>
                    )}
                    {!loading && sortedFiltered.map((entry) => (
                      <tr key={entry.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 text-card-foreground whitespace-nowrap">{entry.transaction_date}</td>
                        <td className="py-3 px-4 text-card-foreground max-w-xs truncate">{entry.description}</td>
                        <td className={cn("py-3 px-4 font-medium text-right whitespace-nowrap", entry.type === "credit" ? "text-emerald-600" : "text-red-600")}>
                          {entry.type === "credit" ? "+" : "-"}{fmt(Number(entry.amount))}
                        </td>
                        <td className="py-3 px-4">
                          <Badge className={cn("border capitalize", entry.type === "credit" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-600 border-red-200")}>
                            {entry.type}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <Badge className={cn("border capitalize", filterBadge[entry.reconcile_status] ?? "bg-muted text-muted-foreground")}>
                            {entry.reconcile_status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          {entry.reconcile_status !== "matched" && (
                            <Button size="sm" variant="ghost" disabled={matchingId === entry.id} onClick={() => handleMatch(entry.id)}>
                              {matchingId === entry.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Link className="h-3 w-3 mr-1" />Match</>}
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
