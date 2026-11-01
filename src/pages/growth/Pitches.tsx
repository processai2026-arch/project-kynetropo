import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RecordListPage } from "@/components/RecordListPage";
import { PageHeader } from "@/components/PageHeader";
import { Panel } from "@/components/Panel";
import { StatCard } from "@/components/StatCard";
import { opsPitchesApi } from "@/lib/api/ops";
import { rowOpenProps, ROW_OPEN_CLASS } from "@/lib/rowNav";
import type { OpsPitch } from "@/types/ops";
import { CalendarDays, IndianRupee, Plus, Pencil, Trash2, TrendingUp, Users } from "lucide-react";
import { toast } from "sonner";
import { ScrollableX } from "@/components/ui/scrollable-x";
import { usePagedRows } from "@/hooks/usePagedRows";
import { PITCH_TYPES, PitchDeleteDialog, PitchFormDialog, RoiText, inr } from "./components/PitchDialogs";

export default function Pitches() {
  const navigate = useNavigate();
  const [items, setItems]   = useState<OpsPitch[]>([]);
  const paged = usePagedRows(items, "pitch events");
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing]   = useState<OpsPitch | null>(null);
  const [removing, setRemoving] = useState<OpsPitch | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await opsPitchesApi.list();
      setItems(res.data ?? []);
    } catch { toast.error("Failed to load pitches"); }
    finally  { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit   = (p: OpsPitch) => { setEditing(p); setFormOpen(true); };

  const totalSpend   = items.reduce((s, p) => s + p.spend, 0);
  const totalRevenue = items.reduce((s, p) => s + p.revenue, 0);
  const totalLeads   = items.reduce((s, p) => s + p.leads_count, 0);
  const totalWon     = items.reduce((s, p) => s + p.converted, 0);
  const totalRoi     = totalSpend > 0 ? Math.round((totalRevenue - totalSpend) / totalSpend * 1000) / 10 : null;

  return (
    <RecordListPage>
      <PageHeader
        title="Pitches &amp; Marketing"
        action={<Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Pitch</Button>}
      />

      {!loading && items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard title="Total Events" value={String(items.length)} icon={CalendarDays} accent="sky" subtitleColor="muted" />
          <StatCard title="Total Leads" value={String(totalLeads)} subtitle={`${totalWon} won`} icon={Users} accent="violet" subtitleColor="muted" />
          <StatCard title="Total Spend" value={inr(totalSpend)} icon={IndianRupee} accent="amber" subtitleColor="muted" />
          <StatCard title="Total Revenue" value={inr(totalRevenue)}
            subtitle={totalRoi != null ? `ROI ${totalRoi >= 0 ? "+" : ""}${totalRoi}%` : undefined} icon={TrendingUp} accent="emerald" subtitleColor="muted" />
        </div>
      )}

      <Panel title={`All Pitch Events (${items.length})`} flush>
        <ScrollableX>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {["Event","Date","City","Spend","Leads","Quoted","Won","Revenue","ROI",""].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b">{Array.from({ length: 10 }).map((_, j) => <td key={j} className="py-3 px-4"><Skeleton className="h-4 w-14" /></td>)}</tr>
              ))}
              {!loading && items.length === 0 && (
                <tr><td colSpan={10} className="px-6 py-8 text-center text-muted-foreground text-sm">No pitch events yet</td></tr>
              )}
              {!loading && paged.rows.map(p => (
                <tr key={p.id} className={`border-b hover:bg-muted/30 transition-colors ${ROW_OPEN_CLASS}`} {...rowOpenProps(() => navigate(`/pitches/${p.id}`))}>
                  <td className="py-3 px-4">
                    <div className="font-medium text-card-foreground">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{PITCH_TYPES[p.type] ?? p.type}</div>
                  </td>
                  <td className="py-3 px-4 text-card-foreground whitespace-nowrap">{p.date}</td>
                  <td className="py-3 px-4 text-card-foreground">{p.city ?? "—"}</td>
                  <td className="py-3 px-4 text-card-foreground">{inr(p.spend)}</td>
                  <td className="py-3 px-4 text-card-foreground">{p.leads_count}</td>
                  <td className="py-3 px-4 text-card-foreground whitespace-nowrap">
                    {p.quoted_count ? <>{inr(p.quoted_value)} <span className="text-xs text-muted-foreground">({p.quoted_count})</span></> : "—"}
                  </td>
                  <td className="py-3 px-4 text-card-foreground whitespace-nowrap">
                    {p.converted} <span className="text-xs text-muted-foreground">({p.conversion_pct}%)</span>
                  </td>
                  <td className="py-3 px-4 text-emerald-700 font-medium">{inr(p.revenue)}</td>
                  <td className="py-3 px-4"><RoiText roi={p.roi} /></td>
                  <td className="py-3 px-4">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)} title="Edit" aria-label={`Edit ${p.name}`}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setRemoving(p)} title="Delete" aria-label={`Delete ${p.name}`}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollableX>
        {paged.bar}
      </Panel>

      <PitchFormDialog open={formOpen} onOpenChange={setFormOpen} editing={editing} onSaved={() => void load()} />
      <PitchDeleteDialog pitch={removing} onOpenChange={(v) => { if (!v) setRemoving(null); }} onDeleted={() => { setRemoving(null); void load(); }} />
    </RecordListPage>
  );
}
