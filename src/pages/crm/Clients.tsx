import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, FolderKanban, Pencil, Phone, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { RecordListPage } from "@/components/RecordListPage";
import { ListShell, type Column } from "@/components/ListShell";
import { NameCell, IconCell } from "@/components/ListCells";
import { NativeSelect } from "@/components/Field";
import { ActionDialog } from "@/components/ActionDialog";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useClientList } from "@/hooks/useClientList";
import { opsClientsApi, opsProjectsApi } from "@/lib/api/ops";
import type { OpsClient, OpsProject } from "@/types/ops";
import { CLIENT_STAGES, CodeText, HEALTH_OPTIONS, HealthBadge } from "./components/crm";

export default function Clients() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<OpsProject[]>([]);
  const [removing, setRemoving] = useState<OpsClient | null>(null);

  // Oldest first, as the API returns them — the order the Client IDs were given out in.
  const list = useClientList<OpsClient>(async () => (await opsClientsApi.list()).data ?? [], {
    searchText: (c) => [c.client_code, c.name, c.phone, c.email, c.owner],
    sorts: {
      code: (c) => c.client_code,
      name: (c) => c.name.toLowerCase(),
      stage: (c) => CLIENT_STAGES.indexOf(c.stage as (typeof CLIENT_STAGES)[number]),
      owner: (c) => c.owner?.toLowerCase(),
      followup: (c) => c.next_followup,
      contact: (c) => c.days_since_contact,
    },
    filters: {
      stage: (c, v) => c.stage === v,
      health: (c, v) => c.health === v,
      owner: (c, v) => c.owner === v,
    },
  });

  // The projects each client is mapped to; the project itself lives on Projects.
  const loadProjects = () => opsProjectsApi.list().then((r) => setProjects(r.data ?? [])).catch(() => undefined);
  useEffect(() => { void loadProjects(); }, []);
  const projectsByClient = useMemo(() => projects.reduce<Record<number, OpsProject[]>>((acc, p) => {
    (acc[p.client_id] ??= []).push(p);
    return acc;
  }, {}), [projects]);

  const owners = useMemo(
    () => [...new Set(list.source.map((c) => c.owner).filter(Boolean))].sort().map((o) => ({ value: o, label: o })),
    [list.source],
  );

  const columns: Column<OpsClient>[] = [
    { key: "code", label: "Client ID", sortKey: "code", render: (c) => <CodeText code={c.client_code} /> },
    { key: "name", label: "Client", sortKey: "name", render: (c) => <NameCell id={c.id} name={c.name} sub={c.email || c.source || undefined} /> },
    { key: "contact", label: "Contact", render: (c) => <IconCell icon={Phone} primary={c.phone || "—"} /> },
    { key: "stage", label: "Stage", sortKey: "stage", render: (c) => <span className="text-xs">{c.stage}</span> },
    { key: "health", label: "Health", render: (c) => <HealthBadge value={c.health} /> },
    {
      key: "projects", label: "Projects",
      render: (c) => {
        const mapped = projectsByClient[c.id] ?? [];
        if (mapped.length === 0) return <span className="text-xs text-muted-foreground">No project</span>;
        return (
          <div className="flex flex-col gap-0.5 text-xs">
            {mapped.slice(0, 2).map((p) => (
              <Link key={p.id} to={`/projects/${p.id}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                <FolderKanban className="h-3 w-3 shrink-0" />
                <span className="font-mono">{p.project_code}</span> {p.name}
              </Link>
            ))}
            {mapped.length > 2 && <span className="text-muted-foreground">+{mapped.length - 2} more</span>}
          </div>
        );
      },
    },
    { key: "owner", label: "Owner", sortKey: "owner", render: (c) => c.owner || "—" },
    { key: "followup", label: "Next follow-up", sortKey: "followup", render: (c) => c.next_followup ?? "—" },
    { key: "last", label: "Last contact", sortKey: "contact", render: (c) => (c.days_since_contact != null ? `${c.days_since_contact}d ago` : "—") },
  ];

  const total = list.pagination?.total;
  const removingProjects = removing ? projectsByClient[removing.id] ?? [] : [];

  return (
    <RecordListPage>
      <PageHeader
        title="Clients"
        subtitle={total !== undefined ? `${total} client${total === 1 ? "" : "s"}${list.isFiltered ? " matching" : ""}` : undefined}
        action={<Button onClick={() => navigate("/clients/new")}><Plus className="h-4 w-4" /> New client</Button>}
      />
      <ListShell
        list={list}
        columns={columns}
        searchPlaceholder="Client ID, name, phone, email…"
        itemLabel="clients"
        rowHref={(c) => `/clients/${c.id}`}
        rowLabel={(c) => c.name}
        empty="No clients match"
        filters={<>
          <NativeSelect className="w-44" value={list.filters.stage ?? ""} placeholder="All stages" options={CLIENT_STAGES.map((s) => ({ value: s, label: s }))} onChange={(v) => list.setFilter("stage", v)} />
          <NativeSelect className="w-36" value={list.filters.health ?? ""} placeholder="All health" options={HEALTH_OPTIONS} onChange={(v) => list.setFilter("health", v)} />
          {owners.length > 0 && <NativeSelect className="w-40" value={list.filters.owner ?? ""} placeholder="All owners" options={owners} onChange={(v) => list.setFilter("owner", v)} />}
        </>}
        rowActions={(c) => (
          <>
            <DropdownMenuItem onSelect={() => navigate(`/clients/${c.id}`)}><Eye className="h-4 w-4" /> View client</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate(`/clients/${c.id}/edit`)}><Pencil className="h-4 w-4" /> Edit client</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setRemoving(c)}><Trash2 className="h-4 w-4" /> Delete client</DropdownMenuItem>
          </>
        )}
      />

      <ActionDialog
        open={removing !== null}
        onOpenChange={(v) => { if (!v) setRemoving(null); }}
        title={`Delete ${removing?.name ?? "client"}?`}
        destructive
        confirmLabel="Delete client"
        description={
          <div className="space-y-2">
            <p>
              This permanently deletes the client
              {removingProjects.length > 0 && <> and its {removingProjects.length === 1 ? "project" : `${removingProjects.length} projects`} ({removingProjects.map((p) => p.name).join(", ")})</>}
              , with their payments, meetings, bugs and checklist. Payments leave Finance with them.
            </p>
            <p>A sales lead this client was converted from goes back to being a lead. This cannot be undone.</p>
          </div>
        }
        onConfirm={async () => {
          if (!removing) return;
          await opsClientsApi.remove(removing.id);
          list.reload();
          void loadProjects();
        }}
        successMessage="Client deleted"
      />
    </RecordListPage>
  );
}
