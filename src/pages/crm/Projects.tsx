import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { RecordListPage } from "@/components/RecordListPage";
import { ListShell, type Column } from "@/components/ListShell";
import { NameCell } from "@/components/ListCells";
import { NativeSelect } from "@/components/Field";
import { ActionDialog } from "@/components/ActionDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useClientList } from "@/hooks/useClientList";
import { opsProjectsApi } from "@/lib/api/ops";
import type { OpsProject } from "@/types/ops";
import { CodeText, HEALTH_OPTIONS, HealthBadge, PRIORITY_OPTIONS, PROJECT_STAGES, PriorityBadge, rupees } from "./components/crm";

export default function Projects() {
  const navigate = useNavigate();
  const [removing, setRemoving] = useState<OpsProject | null>(null);

  // Oldest first, as the API returns them — the order the Project IDs were given out in.
  const list = useClientList<OpsProject>(async () => (await opsProjectsApi.list()).data ?? [], {
    searchText: (p) => [p.project_code, p.name, p.client_code, p.client_name, p.owner],
    sorts: {
      code: (p) => p.project_code,
      name: (p) => p.name.toLowerCase(),
      client: (p) => p.client_name?.toLowerCase(),
      stage: (p) => PROJECT_STAGES.indexOf(p.stage as (typeof PROJECT_STAGES)[number]),
      deadline: (p) => p.deadline,
      quoted: (p) => Number(p.quoted),
      balance: (p) => Number(p.balance),
    },
    filters: {
      stage: (p, v) => p.stage === v,
      health: (p, v) => p.health === v,
      priority: (p, v) => p.priority === v,
    },
  });

  const red = useMemo(() => list.allRows.filter((p) => p.health === "red").length, [list.allRows]);
  const yellow = useMemo(() => list.allRows.filter((p) => p.health === "yellow").length, [list.allRows]);

  const columns: Column<OpsProject>[] = [
    { key: "code", label: "Project ID", sortKey: "code", render: (p) => <CodeText code={p.project_code} /> },
    { key: "name", label: "Project", sortKey: "name", render: (p) => <NameCell id={p.id} name={p.name} sub={p.owner || undefined} /> },
    {
      key: "client", label: "Client", sortKey: "client",
      render: (p) => (
        <Link to={`/clients/${p.client_id}`} className="text-primary hover:underline">
          {p.client_code && <span className="mr-1 font-mono text-xs text-muted-foreground">{p.client_code}</span>}
          {p.client_name ?? "—"}
        </Link>
      ),
    },
    { key: "stage", label: "Stage", sortKey: "stage", render: (p) => <span className="text-xs">{p.stage}</span> },
    { key: "deadline", label: "Deadline", sortKey: "deadline", render: (p) => <span className="text-xs whitespace-nowrap">{p.deadline ?? "—"}</span> },
    { key: "health", label: "Health", render: (p) => <HealthBadge value={p.health} /> },
    { key: "priority", label: "Priority", render: (p) => <PriorityBadge value={p.priority} /> },
    { key: "quoted", label: "Amount", sortKey: "quoted", align: "right", render: (p) => rupees(p.quoted) },
    {
      key: "balance", label: "Balance", sortKey: "balance", align: "right",
      render: (p) => <span className={Number(p.balance) > 0 ? "font-medium text-red-600" : "text-emerald-700"}>{rupees(p.balance)}</span>,
    },
  ];

  const total = list.pagination?.total;

  return (
    <RecordListPage>
      <PageHeader
        title="Projects"
        subtitle={total !== undefined ? `${total} project${total === 1 ? "" : "s"}${list.isFiltered ? " matching" : ""}` : undefined}
        action={<Button onClick={() => navigate("/projects/new")}><Plus className="h-4 w-4" /> New project</Button>}
      />
      {(red > 0 || yellow > 0) && (
        <div className="flex gap-3">
          {red > 0 && <Badge className="border border-red-200 bg-red-50 text-red-600">{red} critical</Badge>}
          {yellow > 0 && <Badge className="border border-amber-200 bg-amber-50 text-amber-600">{yellow} at risk</Badge>}
        </div>
      )}
      <ListShell
        list={list}
        columns={columns}
        searchPlaceholder="Project ID, project or client…"
        itemLabel="projects"
        rowHref={(p) => `/projects/${p.id}`}
        rowLabel={(p) => p.name}
        empty="No projects match"
        filters={<>
          <NativeSelect className="w-44" value={list.filters.stage ?? ""} placeholder="All stages" options={PROJECT_STAGES.map((s) => ({ value: s, label: s }))} onChange={(v) => list.setFilter("stage", v)} />
          <NativeSelect className="w-36" value={list.filters.health ?? ""} placeholder="All health" options={HEALTH_OPTIONS} onChange={(v) => list.setFilter("health", v)} />
          <NativeSelect className="w-36" value={list.filters.priority ?? ""} placeholder="All priority" options={PRIORITY_OPTIONS} onChange={(v) => list.setFilter("priority", v)} />
        </>}
        rowActions={(p) => (
          <>
            <DropdownMenuItem onSelect={() => navigate(`/projects/${p.id}`)}><Eye className="h-4 w-4" /> View project</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate(`/projects/${p.id}/edit`)}><Pencil className="h-4 w-4" /> Edit project</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setRemoving(p)}><Trash2 className="h-4 w-4" /> Delete project</DropdownMenuItem>
          </>
        )}
      />

      <ActionDialog
        open={removing !== null}
        onOpenChange={(v) => { if (!v) setRemoving(null); }}
        title={`Delete ${removing?.name ?? "project"}?`}
        destructive
        confirmLabel="Delete project"
        description={
          <p>
            This permanently deletes the project with its payments, bugs, meetings, notes and credentials
            {removing && Number(removing.received) > 0 && <> — including {rupees(removing.received)} of payments, which leave Finance with it</>}
            . The client stays. This cannot be undone.
          </p>
        }
        onConfirm={async () => {
          if (!removing) return;
          await opsProjectsApi.remove(removing.id);
          list.reload();
        }}
        successMessage="Project deleted"
      />
    </RecordListPage>
  );
}
