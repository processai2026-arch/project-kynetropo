import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Search, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw } from "lucide-react";

interface AuditEntry {
  id: number;
  created_at: string;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id?: number;
  new_values?: string | Record<string, unknown> | null;
  ip_address?: string;
}

interface AuditResponse {
  data: AuditEntry[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
}

const ACTION_BADGE: Record<string, string> = {
  invoice_approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  invoice_rejected: "bg-red-50 text-red-600 border-red-200",
  invoice_uploaded: "bg-blue-50 text-blue-600 border-blue-200",
  product_updated: "bg-amber-50 text-amber-600 border-amber-200",
  damaged_stock_write_off: "bg-red-50 text-red-600 border-red-200",
};

function truncateDetails(details: string | Record<string, unknown> | null | undefined, maxLen = 60): string {
  if (!details) return "—";
  const str = typeof details === "string" ? details : JSON.stringify(details);
  return str.length > maxLen ? str.slice(0, maxLen) + "…" : str;
}

function buildQs(p: number, from: string, to: string, action: string) {
  const params: Record<string, string> = { page: String(p) };
  if (from) params.from_date = from;
  if (to) params.to_date = to;
  if (action) params.action = action;
  return "?" + new URLSearchParams(params).toString();
}

export default function InvoiceAuditLog() {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 8) + "01";

  const [items, setItems] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [perPage, setPerPage] = useState(20);
  const [fromDate, setFromDate] = useState(firstOfMonth);
  const [toDate, setToDate] = useState(today);
  const [actionSearch, setActionSearch] = useState("");

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

  const load = async (p = page, from = fromDate, to = toDate, action = actionSearch) => {
    setLoading(true);
    try {
      const res = await apiFetch<{ data: AuditEntry[]; pagination: { total: number; page: number; limit: number } }>(
        "/admin/invoice-audit-log" + buildQs(p, from, to, action)
      );
      setItems(res.data ?? []);
      setTotal(res.pagination?.total ?? 0);
      setPerPage(res.pagination?.limit ?? 20);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load audit log");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleFilter = () => { setPage(1); load(1); };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    load(newPage);
  };

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const showing = items.length;

  const sortedItems = [...items].sort((a, b) => {
    const av = (a as any)[sortKey] ?? "";
    const bv = (b as any)[sortKey] ?? "";
    const numKeys = ["id", "entity_id"];
    const cmp = numKeys.includes(sortKey) ? Number(av) - Number(bv) : String(av).localeCompare(String(bv));
    return sortDir === "asc" ? cmp : -cmp;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Audit Log</h1>
      </div>

      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-4 border-b flex items-end gap-4 flex-wrap">
          <div className="space-y-1.5">
            <Label>From Date</Label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-36" />
          </div>
          <div className="space-y-1.5">
            <Label>To Date</Label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-36" />
          </div>
          <div className="space-y-1.5 flex-1 min-w-40">
            <Label>Action</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={actionSearch}
                onChange={(e) => setActionSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleFilter()}
                placeholder="Search action…"
                className="pl-8"
              />
            </div>
          </div>
          <Button onClick={handleFilter} size="sm">Filter</Button>
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
                  <th onClick={() => handleSort("created_at")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">Timestamp<SortIcon col="created_at" /></th>
                  <th onClick={() => handleSort("user_name")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">User<SortIcon col="user_name" /></th>
                  <th onClick={() => handleSort("action")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">Action<SortIcon col="action" /></th>
                  <th onClick={() => handleSort("entity_type")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">Entity<SortIcon col="entity_type" /></th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">Details</th>
                  <th onClick={() => handleSort("ip_address")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">IP Address<SortIcon col="ip_address" /></th>
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    {Array.from({ length: 6 }).map((__, j) => (
                      <td key={j} className="py-3 px-4"><Skeleton className="h-4 w-24" /></td>
                    ))}
                  </tr>
                ))}
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground text-sm">No audit log entries found</td>
                  </tr>
                )}
                {!loading && sortedItems.map((entry) => (
                  <tr key={entry.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 text-card-foreground whitespace-nowrap text-xs">{entry.created_at}</td>
                    <td className="py-3 px-4 text-card-foreground font-medium">{entry.user_name}</td>
                    <td className="py-3 px-4">
                      <Badge className={cn("border text-xs", ACTION_BADGE[entry.action] ?? "bg-gray-100 text-gray-500 border-gray-200")}>
                        {entry.action.replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-card-foreground">
                      {entry.entity_type}{entry.entity_id ? ` #${entry.entity_id}` : ""}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground font-mono text-xs max-w-xs" title={typeof entry.new_values === "string" ? entry.new_values : JSON.stringify(entry.new_values)}>
                      {truncateDetails(entry.new_values ?? "—")}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground text-xs font-mono">{entry.ip_address ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-4 border-t flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Showing {showing} of {total} entries
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1 || loading}
              onClick={() => handlePageChange(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages || loading}
              onClick={() => handlePageChange(page + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
