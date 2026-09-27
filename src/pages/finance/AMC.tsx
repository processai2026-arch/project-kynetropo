import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { RecordListPage } from "@/components/RecordListPage";
import { PageHeader } from "@/components/PageHeader";
import { Panel } from "@/components/Panel";
import { opsAmcApi, opsClientsApi, opsProjectsApi } from "@/lib/api/ops";
import { formatDate } from "@/lib/format";
import type { OpsAmcRecord, OpsClient, OpsProject } from "@/types/ops";
import { Plus, Pencil, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { ScrollableX } from "@/components/ui/scrollable-x";
import { AmcCollectDialog, AmcFormDialog, AmcStatusBadge, AmcYearBadge, dueText } from "./components/AmcDialogs";

const COLUMNS = ["Client", "Project", "Per year", "This year", "Renewal", "Next due", "Status", ""];

export default function AMC() {
  const [items, setItems]       = useState<OpsAmcRecord[]>([]);
  const [clients, setClients]   = useState<OpsClient[]>([]);
  const [projects, setProjects] = useState<OpsProject[]>([]);
  const [loading, setLoading]   = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing]   = useState<OpsAmcRecord | null>(null);
  const [collecting, setCollecting] = useState<OpsAmcRecord | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== "all") params.status = statusFilter;
      const res = await opsAmcApi.list(params);
      setItems(res.data ?? []);
    } catch { toast.error("Failed to load AMC records"); }
    finally  { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    opsClientsApi.list().then(r => setClients(r.data ?? [])).catch(() => {});
    opsProjectsApi.list().then(r => setProjects(r.data ?? [])).catch(() => {});
  }, []);

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit   = (a: OpsAmcRecord) => { setEditing(a); setFormOpen(true); };

  const counts = {
    due:     items.filter(a => a.status === "due").length,
    overdue: items.filter(a => a.status === "overdue").length,
  };

  return (
    <RecordListPage>
      <PageHeader
        title="AMC"
        subtitle="Yearly maintenance, kept separate from project amounts"
        action={<Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add AMC</Button>}
      />

      {(counts.overdue > 0 || counts.due > 0) && (
        <div className="flex gap-2">
          {counts.overdue > 0 && <Badge className="bg-red-50 text-red-600 border border-red-200">{counts.overdue} overdue</Badge>}
          {counts.due > 0     && <Badge className="bg-amber-50 text-amber-600 border border-amber-200">{counts.due} due soon</Badge>}
        </div>
      )}

      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="due">Due Soon</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Panel title={`AMC Records (${items.length})`} flush>
        <ScrollableX>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {COLUMNS.map(h => (
                  <th key={h} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b">{COLUMNS.map((_, j) => <td key={j} className="py-3 px-4"><Skeleton className="h-4 w-16" /></td>)}</tr>
              ))}
              {!loading && items.length === 0 && (
                <tr><td colSpan={COLUMNS.length} className="px-6 py-8 text-center text-muted-foreground text-sm">No AMC records found</td></tr>
              )}
              {!loading && items.map(a => {
                const rowColor = a.status === "overdue" ? "bg-red-50/40" : a.status === "due" ? "bg-amber-50/40" : "";
                return (
                  <tr key={a.id} className={cn("border-b hover:bg-muted/30 transition-colors", rowColor)}>
                    <td className="py-3 px-4">
                      <Link to={`/clients/${a.client_id}`} className="font-medium text-card-foreground hover:text-primary">{a.client_name}</Link>
                      {a.client_company && <div className="text-xs text-muted-foreground">{a.client_company}</div>}
                    </td>
                    <td className="py-3 px-4">
                      <Link to={`/projects/${a.project_id}`} className="text-card-foreground hover:text-primary">{a.project_name}</Link>
                    </td>
                    <td className="py-3 px-4 font-medium text-card-foreground whitespace-nowrap">₹{Number(a.amount).toLocaleString("en-IN")}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <AmcYearBadge amc={a} />
                      <div className="text-xs text-muted-foreground mt-0.5">from {formatDate(a.start_date)}</div>
                    </td>
                    <td className="py-3 px-4 text-card-foreground whitespace-nowrap">{formatDate(a.renewal_date)}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="text-card-foreground">{formatDate(a.due_date)}</div>
                      <div className="text-xs">{dueText(a.days_until_due)}</div>
                    </td>
                    <td className="py-3 px-4"><AmcStatusBadge status={a.status} /></td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(a)} title="Edit" aria-label={`Edit AMC for ${a.project_name}`}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setCollecting(a)}
                          title={a.term_paid ? "Collect renewal" : "Collect this year's AMC"} aria-label={`Collect AMC for ${a.project_name}`}>
                          <CheckCircle className="h-4 w-4 text-emerald-600" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollableX>
      </Panel>

      <AmcFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        amc={editing}
        clients={clients}
        projects={projects}
        onSaved={load}
      />
      <AmcCollectDialog
        open={collecting !== null}
        onOpenChange={(v) => { if (!v) setCollecting(null); }}
        amc={collecting}
        onSaved={load}
      />
    </RecordListPage>
  );
}
