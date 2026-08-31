import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CalendarClock, CheckCircle2, Pencil, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { salesFollowupsApi } from "@/lib/api/sales";
import { useSalesAccess } from "@/hooks/useSalesAccess";
import { SalesLayout } from "@/components/sales/SalesLayout";
import { FollowupEditDialog } from "@/components/sales/FollowupEditDialog";
import { TemperatureBadge, formatDate, formatTime, humanise } from "@/components/sales/SalesBits";
import type { FollowupBucket, SalesFollowup } from "@/types/sales";
import { cn } from "@/lib/utils";

const BUCKETS: { key: FollowupBucket; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "overdue", label: "Overdue" },
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Completed" },
];

/**
 * Which bucket a follow-up now belongs to after an edit. Only a hint for
 * keeping the list steady — the server stays the authority on bucketing, so
 * anything that no longer fits triggers a reload.
 */
function belongsToBucket(f: SalesFollowup, bucket: FollowupBucket): boolean {
  if (f.status !== "pending") return bucket === "completed";
  const today = new Date().toISOString().slice(0, 10);
  if (bucket === "today") return f.due_date === today;
  if (bucket === "overdue") return f.due_date < today;
  if (bucket === "upcoming") return f.due_date > today;
  return false;
}

export default function SalesFollowUps() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { can } = useSalesAccess();

  const initial = (searchParams.get("bucket") as FollowupBucket) ?? "today";
  const [bucket, setBucket] = useState<FollowupBucket>(
    BUCKETS.some((b) => b.key === initial) ? initial : "today",
  );
  const [items, setItems] = useState<SalesFollowup[]>([]);
  const [counts, setCounts] = useState<Record<FollowupBucket, number>>({
    today: 0, overdue: 0, upcoming: 0, completed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [completing, setCompleting] = useState<SalesFollowup | null>(null);
  const [editing, setEditing] = useState<SalesFollowup | null>(null);
  const [completeForm, setCompleteForm] = useState({ outcome_notes: "", next_followup_date: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await salesFollowupsApi.list(bucket);
      setItems(res.items ?? []);
      setCounts(res.counts);
      setError(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not load follow-ups";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [bucket]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setSearchParams(bucket === "today" ? {} : { bucket }, { replace: true });
  }, [bucket, setSearchParams]);

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completing) return;
    setSaving(true);
    try {
      await salesFollowupsApi.complete(completing.id, {
        outcome_notes: completeForm.outcome_notes || undefined,
        next_followup_date: completeForm.next_followup_date || undefined,
      });
      toast.success("Follow-up completed");
      setCompleting(null);
      setCompleteForm({ outcome_notes: "", next_followup_date: "" });
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not complete the follow-up");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SalesLayout>
      <h1 className="text-2xl font-bold text-foreground">Follow-Ups</h1>

      {/* Bucket tabs — horizontally scrollable on narrow screens. */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {BUCKETS.map((b) => (
          <button
            key={b.key}
            type="button"
            onClick={() => setBucket(b.key)}
            className={cn(
              "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              bucket === b.key
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-muted",
            )}
          >
            {b.label}
            {counts[b.key] > 0 && (
              <span
                className={cn(
                  "ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                  bucket === b.key ? "bg-primary-foreground/20" : "bg-muted",
                  b.key === "overdue" && bucket !== b.key && "bg-destructive/10 text-destructive",
                )}
              >
                {counts[b.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
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
          <CalendarClock className="mx-auto h-7 w-7 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            {bucket === "overdue" ? "Nothing overdue — well done." : `No ${bucket} follow-ups.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0 xl:grid-cols-3">
          {items.map((f) => (
            <div key={f.id} className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <Link to={`/sales/leads/${f.lead_id}`} className="min-w-0 hover:underline">
                  <p className="truncate font-semibold text-card-foreground">
                    {f.lead_company || f.lead_name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {f.lead_contact_person || f.lead_name}
                    {f.lead_phone ? ` · ${f.lead_phone}` : ""}
                  </p>
                </Link>
                {f.lead_temperature && <TemperatureBadge value={f.lead_temperature} />}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span
                  className={cn(
                    "inline-flex items-center gap-1",
                    bucket === "overdue" && "font-medium text-destructive",
                  )}
                >
                  <CalendarClock className="h-3.5 w-3.5" />
                  {formatDate(f.due_date)}
                  {f.due_time ? ` · ${formatTime(f.due_time)}` : ""}
                </span>
                {f.lead_last_outcome && <span>Last: {humanise(f.lead_last_outcome)}</span>}
                {f.assigned_to_name && <span>{f.assigned_to_name}</span>}
              </div>

              {f.purpose && <p className="mt-2 text-sm text-muted-foreground">{f.purpose}</p>}

              {f.status === "completed" ? (
                <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Completed {formatDate(f.completed_at)}
                  {f.outcome_notes ? ` — ${f.outcome_notes}` : ""}
                </div>
              ) : (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {can("sales.calls.create") && (
                    <Button size="sm" variant="secondary" className="h-9" asChild>
                      <Link to={`/sales/leads/${f.lead_id}?action=call`}>
                        <Phone className="mr-1.5 h-3.5 w-3.5" />
                        Log Call
                      </Link>
                    </Button>
                  )}
                  {can("sales.followups.complete") && (
                    <Button size="sm" variant="outline" className="h-9" onClick={() => setCompleting(f)}>
                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                      Complete
                    </Button>
                  )}
                  {can("sales.followups.create") && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="col-span-2 h-9 text-muted-foreground"
                      onClick={() => setEditing(f)}
                    >
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      Edit date, time or purpose
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <FollowupEditDialog
        followup={editing}
        onClose={() => setEditing(null)}
        onSaved={(updated) => {
          // Patch in place when the row still belongs in this bucket; otherwise
          // reload, because a reschedule can move it to Today, Overdue or Upcoming.
          if (updated && belongsToBucket(updated, bucket)) {
            setItems((prev) => prev.map((f) => (f.id === updated.id ? { ...f, ...updated } : f)));
          } else {
            void load();
          }
        }}
      />

      <Dialog open={completing !== null} onOpenChange={(o) => !o && setCompleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Complete Follow-Up</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleComplete} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="fu-notes">Outcome notes</Label>
              <Textarea
                id="fu-notes"
                rows={3}
                value={completeForm.outcome_notes}
                onChange={(e) => setCompleteForm((f) => ({ ...f, outcome_notes: e.target.value }))}
                placeholder="What happened?"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fu-next">Schedule the next follow-up (optional)</Label>
              <Input
                id="fu-next"
                type="date"
                min={new Date().toISOString().slice(0, 10)}
                value={completeForm.next_followup_date}
                onChange={(e) => setCompleteForm((f) => ({ ...f, next_followup_date: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCompleting(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Complete"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </SalesLayout>
  );
}
