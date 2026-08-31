import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { salesChallengesApi } from "@/lib/api/sales";
import { useSalesAccess } from "@/hooks/useSalesAccess";
import { SalesLayout } from "@/components/sales/SalesLayout";
import { ChallengeStatusBadge, formatDateTime } from "@/components/sales/SalesBits";
import { ChallengeTimer } from "@/components/sales/ChallengeTimer";
import type { ChallengeCounts, ChallengeStatus, SalesChallenge } from "@/types/sales";
import { cn } from "@/lib/utils";

const FILTERS: { key: ChallengeStatus | ""; label: string }[] = [
  { key: "available", label: "Available" },
  { key: "accepted", label: "Accepted" },
  { key: "in_progress", label: "In Progress" },
  { key: "completed", label: "Completed" },
  { key: "expired", label: "Expired" },
];

const EMPTY_COUNTS: ChallengeCounts = {
  available: 0, accepted: 0, in_progress: 0, completed: 0, expired: 0,
};

export default function SalesChallenges() {
  const { can } = useSalesAccess();
  const [filter, setFilter] = useState<ChallengeStatus | "">("available");
  const [items, setItems] = useState<SalesChallenge[]>([]);
  const [counts, setCounts] = useState<ChallengeCounts>(EMPTY_COUNTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", deadline: "", priority: "normal" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await salesChallengesApi.list(filter);
      setItems(res.items ?? []);
      setCounts(res.counts ?? EMPTY_COUNTS);
      setError(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not load challenges";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.title.trim().length < 3) {
      toast.error("A challenge title is required");
      return;
    }
    if (!form.deadline) {
      toast.error("A deadline is required");
      return;
    }
    setSaving(true);
    try {
      await salesChallengesApi.create({
        title: form.title.trim(),
        description: form.description || undefined,
        // datetime-local gives "YYYY-MM-DDTHH:MM"; the API accepts that form.
        deadline: form.deadline,
        priority: form.priority,
      });
      toast.success("Challenge created");
      setFormOpen(false);
      setForm({ title: "", description: "", deadline: "", priority: "normal" });
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the challenge");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SalesLayout>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground">Challenges</h1>
        {can("sales.challenges.create") && (
          <Button size="sm" className="h-9" onClick={() => setFormOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            New
          </Button>
        )}
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              filter === f.key
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-muted",
            )}
          >
            {f.label}
            {f.key && counts[f.key as keyof ChallengeCounts] > 0 && (
              <span
                className={cn(
                  "ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                  filter === f.key ? "bg-primary-foreground/20" : "bg-muted",
                )}
              >
                {counts[f.key as keyof ChallengeCounts]}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
          {error}
          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Try again
            </Button>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card/50 p-10 text-center">
          <Trophy className="mx-auto h-7 w-7 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No challenges in this list.</p>
        </div>
      ) : (
        <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0 xl:grid-cols-3">
          {items.map((c) => (
            <Link
              key={c.id}
              to={`/sales/challenges/${c.id}`}
              className="block rounded-2xl border bg-card p-4 shadow-sm transition-colors hover:bg-muted/40"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 font-semibold text-card-foreground">{c.title}</p>
                <ChallengeStatusBadge value={c.status} />
              </div>

              {c.description && (
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>
              )}

              <div className="mt-3 flex items-end justify-between gap-3">
                <div className="text-xs text-muted-foreground">
                  <p className="uppercase tracking-wide">Deadline</p>
                  <p className="text-foreground">{formatDateTime(c.deadline)}</p>
                </div>
                {c.is_actionable ? (
                  <ChallengeTimer secondsRemaining={c.seconds_remaining} seedKey={c.server_time} />
                ) : (
                  <span className="font-mono text-sm text-muted-foreground">
                    {c.status === "expired" ? "00:00:00" : "—"}
                  </span>
                )}
              </div>

              {c.accepted_by_name && (
                <p className="mt-2 text-[11px] text-muted-foreground">Accepted by {c.accepted_by_name}</p>
              )}
            </Link>
          ))}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Challenge</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ch-title">Title *</Label>
              <Input
                id="ch-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Get requirement confirmation from ABC Technologies"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ch-desc">Description</Label>
              <Textarea
                id="ch-desc"
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ch-deadline">Deadline *</Label>
                <Input
                  id="ch-deadline"
                  type="datetime-local"
                  value={form.deadline}
                  onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              The deadline is validated and enforced against server time.
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </SalesLayout>
  );
}
