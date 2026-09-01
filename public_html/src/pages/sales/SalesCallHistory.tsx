import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { salesCallsApi } from "@/lib/api/sales";
import { useSalesAccess } from "@/hooks/useSalesAccess";
import { SalesLayout } from "@/components/sales/SalesLayout";
import { CommentButton, CommentThread } from "@/components/sales/CommentThread";
import { TemperatureBadge, formatDate, formatTime, humanise } from "@/components/sales/SalesBits";
import type { SalesCall } from "@/types/sales";

/**
 * One call, opened from the history.
 *
 * A card can only ever show the first couple of lines of what was said, and
 * the notes are the whole reason the call was logged — cutting them off
 * mid-sentence with no way to read the rest is worse than not showing them.
 */
function CallDetail({
  call,
  onClose,
}: {
  call: SalesCall | null;
  onClose: () => void;
}) {
  const { can } = useSalesAccess();

  return (
    <Dialog open={call !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {call && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-left">
                <Phone className="h-4 w-4 shrink-0" />
                <span className="min-w-0 truncate">{call.lead_company || call.lead_name || "Call"}</span>
              </DialogTitle>
            </DialogHeader>

            <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">When</dt>
                  <dd className="text-card-foreground">
                    {formatDate(call.call_date)}
                    {call.call_time ? `, ${formatTime(call.call_time)}` : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Lasted</dt>
                  <dd className="text-card-foreground">
                    {call.duration_minutes > 0 ? `${call.duration_minutes} min` : "Not recorded"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Outcome</dt>
                  <dd className="font-medium text-card-foreground">{humanise(call.outcome)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Logged by</dt>
                  <dd className="text-card-foreground">{call.called_by_name || "—"}</dd>
                </div>
              </dl>

              {call.temperature_after && (
                <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  The lead was moved to
                  <TemperatureBadge value={call.temperature_after} />
                  after this call.
                </p>
              )}

              <div>
                <h3 className="text-sm font-semibold text-card-foreground">What was said</h3>
                {call.notes ? (
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">{call.notes}</p>
                ) : (
                  <p className="mt-1 text-sm italic text-muted-foreground">
                    Nothing was written down for this call.
                  </p>
                )}
              </div>

              <Link
                to={`/sales/leads/${call.lead_id}`}
                className="inline-block text-sm text-primary underline"
                onClick={onClose}
              >
                Open the lead
              </Link>

              {can("sales.comments.view") && (
                <div className="border-t pt-4">
                  <h3 className="mb-2 text-sm font-semibold text-card-foreground">Discussion</h3>
                  <CommentThread entityType="call" entityId={call.id} />
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Call history. Logging a call happens on the lead, where the context is. */
export default function SalesCallHistory() {
  const { can } = useSalesAccess();
  const [items, setItems] = useState<SalesCall[]>([]);
  const [openCall, setOpenCall] = useState<SalesCall | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    salesCallsApi
      .list({ page: 1 })
      .then((res) => {
        setItems(res.data ?? []);
        setError(null);
      })
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : "Could not load call history";
        setError(message);
        toast.error(message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  return (
    <SalesLayout>
      <h1 className="text-2xl font-bold text-foreground">Call History</h1>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
          {error}
          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={load}>
              Try again
            </Button>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card/50 p-10 text-center">
          <Phone className="mx-auto h-7 w-7 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No calls logged yet.</p>
        </div>
      ) : (
        <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0 xl:grid-cols-3">
          {items.map((c) => (
            /*
             * The whole card opens the call. The lead link and the comment
             * count inside it stop the click going further — they are
             * shortcuts past the dialog, not part of it.
             */
            <div
              key={c.id}
              role="button"
              tabIndex={0}
              aria-label={`Call with ${c.lead_company || c.lead_name} on ${formatDate(c.call_date)}`}
              onClick={() => setOpenCall(c)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setOpenCall(c);
                }
              }}
              className="cursor-pointer rounded-2xl border bg-card p-4 text-left shadow-sm transition-colors hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-start justify-between gap-3">
                <Link
                  to={`/sales/leads/${c.lead_id}`}
                  className="min-w-0 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="truncate font-semibold text-card-foreground">{c.lead_company || c.lead_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(c.call_date)}
                    {c.call_time ? ` · ${formatTime(c.call_time)}` : ""}
                    {c.duration_minutes > 0 ? ` · ${c.duration_minutes} min` : ""}
                  </p>
                </Link>
                <div className="flex shrink-0 items-center gap-2">
                  {c.lead_temperature && <TemperatureBadge value={c.lead_temperature} />}
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              <p className="mt-2 text-sm font-medium text-foreground">{humanise(c.outcome)}</p>
              {c.notes ? (
                // Two lines on the card; the rest is one tap away.
                <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">{c.notes}</p>
              ) : (
                <p className="mt-1 text-sm italic text-muted-foreground">No notes on this call.</p>
              )}
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-[11px] text-muted-foreground">
                  {c.called_by_name ? `Logged by ${c.called_by_name}` : ""}
                </p>
                {can("sales.comments.view") && (
                  <CommentButton count={c.comment_count ?? 0} onClick={() => setOpenCall(c)} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <CallDetail
        call={openCall}
        onClose={() => {
          setOpenCall(null);
          // A comment may have been added; the count on the card is now stale.
          load();
        }}
      />
    </SalesLayout>
  );
}
