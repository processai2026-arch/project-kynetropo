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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { salesChallengesApi } from "@/lib/api/sales";
import { useSalesAccess } from "@/hooks/useSalesAccess";
import { useTeamMembers, namesakeHint } from "@/hooks/useTeamMembers";
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
  const [assignees, setAssignees] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  // Who the challenge can be offered to. Shared with the task form and the @
  // menu, so all three tell namesakes apart the same way.
  const people = useTeamMembers(formOpen);

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
        assignees,
      });
      toast.success("Challenge created");
      setFormOpen(false);
      setForm({ title: "", description: "", deadline: "", priority: "normal" });
      setAssignees([]);
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

              {c.accepted_by_name ? (
                <p className="mt-2 text-[11px] text-muted-foreground">Accepted by {c.accepted_by_name}</p>
              ) : c.status === "available" ? (
                // Everyone sees every challenge; only some can take one. Saying
                // so on the card saves opening a challenge to find out it was
                // never yours.
                <p className="mt-2 text-[11px] font-medium">
                  {c.can_accept ? (
                    <span className="text-primary">Yours to take</span>
                  ) : c.i_created_it ? (
                    <span className="text-muted-foreground">You set this one</span>
                  ) : (
                    <span className="text-muted-foreground">Offered to someone else</span>
                  )}
                </p>
              ) : null}
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
            <div className="space-y-2">
              <Label>Challenging who?</Label>
              {people.length === 0 ? (
                <p className="text-xs text-muted-foreground">Loading people…</p>
              ) : (
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border p-2">
                  {people.map((p) => (
                    <label
                      key={p.user_id}
                      className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted"
                    >
                      <Checkbox
                        checked={assignees.includes(p.user_id)}
                        onCheckedChange={() =>
                          setAssignees((a) =>
                            a.includes(p.user_id) ? a.filter((x) => x !== p.user_id) : [...a, p.user_id],
                          )
                        }
                      />
                      <span className="min-w-0">
                        <span className="block text-sm">{p.name}</span>
                        {/* Offering a challenge to the wrong namesake means the
                            person it was meant for never sees it at all. */}
                        {namesakeHint(p) && (
                          <span className="block text-[11px] text-muted-foreground">{namesakeHint(p)}</span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                {assignees.length === 0
                  ? "Nobody selected — offered to the whole sales team; the first to accept takes it."
                  : `Offered to ${assignees.length} ${assignees.length === 1 ? "person" : "people"}; the first to accept takes it.`}
              </p>
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
