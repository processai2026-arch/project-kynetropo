import { useCallback, useEffect, useState } from "react";
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
import type { LeadCallSummary, SalesCall } from "@/types/sales";

/**
 * One call, opened from a lead's history.
 *
 * A row can only ever show the first couple of lines of what was said, and the
 * notes are the whole reason the call was logged — cutting them off
 * mid-sentence with no way to read the rest is worse than not showing them.
 */
function CallDetail({ call, onClose }: { call: SalesCall | null; onClose: () => void }) {
  const { can } = useSalesAccess();

  return (
    <Dialog open={call !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {call && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-left">
                <Phone className="h-4 w-4 shrink-0" />
                <span className="min-w-0 truncate">
                  {formatDate(call.call_date)}
                  {call.call_time ? `, ${formatTime(call.call_time)}` : ""}
                </span>
              </DialogTitle>
            </DialogHeader>

            <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">With</dt>
                  <dd className="text-card-foreground">{call.lead_company || call.lead_name || "—"}</dd>
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

/**
 * Every call with one lead, newest first.
 *
 * Loaded when the lead is opened rather than up front: the page shows who we
 * have been speaking to, and most of those conversations are not the one you
 * came looking for.
 */
function LeadCalls({
  lead,
  onClose,
  onOpenCall,
}: {
  lead: LeadCallSummary | null;
  onClose: () => void;
  onOpenCall: (call: SalesCall) => void;
}) {
  const { can } = useSalesAccess();
  const [calls, setCalls] = useState<SalesCall[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!lead) return;
    let live = true;
    setLoading(true);
    setError(null);
    salesCallsApi
      .list({ lead_id: lead.lead_id, limit: 200 })
      .then((res) => live && setCalls(res.data ?? []))
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : "Could not load these calls"))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [lead]);

  return (
    <Dialog open={lead !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {lead && (
          <>
            <DialogHeader>
              <DialogTitle className="text-left">
                <span className="block truncate">{lead.lead_company || lead.lead_name}</span>
                <span className="block text-sm font-normal text-muted-foreground">
                  {lead.call_count} {lead.call_count === 1 ? "call" : "calls"}
                  {lead.total_minutes > 0 ? ` · ${lead.total_minutes} min in total` : ""}
                </span>
              </DialogTitle>
            </DialogHeader>

            <div className="max-h-[65vh] space-y-2 overflow-y-auto pr-1">
              <Link
                to={`/sales/leads/${lead.lead_id}`}
                className="inline-block text-sm text-primary underline"
                onClick={onClose}
              >
                Open the lead
              </Link>

              {loading ? (
                <div className="space-y-2 pt-2">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-20 w-full rounded-xl" />
                  ))}
                </div>
              ) : error ? (
                <p className="pt-2 text-sm text-destructive">{error}</p>
              ) : calls.length === 0 ? (
                <p className="pt-2 text-sm text-muted-foreground">No calls to show.</p>
              ) : (
                calls.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onOpenCall(c)}
                    className="w-full rounded-xl border bg-card p-3 text-left transition-colors hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-card-foreground">
                          {formatDate(c.call_date)}
                          {c.call_time ? ` · ${formatTime(c.call_time)}` : ""}
                          {c.duration_minutes > 0 ? ` · ${c.duration_minutes} min` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">{humanise(c.outcome)}</p>
                      </div>
                      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    </div>
                    {c.notes ? (
                      <p className="mt-1.5 line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">
                        {c.notes}
                      </p>
                    ) : (
                      <p className="mt-1.5 text-sm italic text-muted-foreground">No notes on this call.</p>
                    )}
                    <div className="mt-1.5 flex items-center justify-between gap-3">
                      <span className="text-[11px] text-muted-foreground">
                        {c.called_by_name ? `Logged by ${c.called_by_name}` : ""}
                      </span>
                      {can("sales.comments.view") && (c.comment_count ?? 0) > 0 && (
                        <span className="text-[11px] text-muted-foreground">
                          {c.comment_count} {c.comment_count === 1 ? "comment" : "comments"}
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Call history, grouped by who the calls were with.
 *
 * It used to put a card on screen per call, so a lead spoken to eight times
 * filled the page eight times over and pushed everyone else off the bottom.
 * One card per lead answers the question the page is actually for — who have we
 * been talking to, and when did we last speak — and the conversations
 * themselves are one tap away.
 *
 * Logging a call happens on the lead or from a follow-up, where the context is.
 */
export default function SalesCallHistory() {
  const [leads, setLeads] = useState<LeadCallSummary[]>([]);
  const [openLead, setOpenLead] = useState<LeadCallSummary | null>(null);
  const [openCall, setOpenCall] = useState<SalesCall | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    salesCallsApi
      .byLead()
      .then((rows) => {
        setLeads(rows);
        setError(null);
      })
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : "Could not load call history";
        setError(message);
        toast.error(message);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const totalCalls = leads.reduce((sum, l) => sum + l.call_count, 0);

  return (
    <SalesLayout>
      <div>
        <h1 className="text-2xl font-bold text-foreground">Call History</h1>
        {!loading && !error && leads.length > 0 && (
          <p className="mt-1 text-sm text-muted-foreground">
            {totalCalls} {totalCalls === 1 ? "call" : "calls"} across {leads.length}{" "}
            {leads.length === 1 ? "lead" : "leads"}
          </p>
        )}
      </div>

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
      ) : leads.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card/50 p-10 text-center">
          <Phone className="mx-auto h-7 w-7 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No calls logged yet.</p>
        </div>
      ) : (
        <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0 xl:grid-cols-3">
          {leads.map((l) => (
            /*
             * The whole card opens the lead's calls. The lead link inside it
             * stops the click going further — it is a shortcut past the dialog,
             * not part of it.
             */
            <div
              key={l.lead_id}
              role="button"
              tabIndex={0}
              aria-label={`${l.call_count} calls with ${l.lead_company || l.lead_name}`}
              onClick={() => setOpenLead(l)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setOpenLead(l);
                }
              }}
              className="cursor-pointer rounded-2xl border bg-card p-4 text-left shadow-sm transition-colors hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-start justify-between gap-3">
                <Link
                  to={`/sales/leads/${l.lead_id}`}
                  className="min-w-0 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="truncate font-semibold text-card-foreground">{l.lead_company || l.lead_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {l.call_count} {l.call_count === 1 ? "call" : "calls"}
                    {l.total_minutes > 0 ? ` · ${l.total_minutes} min` : ""}
                    {l.owner_name ? ` · ${l.owner_name}` : ""}
                  </p>
                </Link>
                <div className="flex shrink-0 items-center gap-2">
                  {l.lead_temperature && <TemperatureBadge value={l.lead_temperature} />}
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>

              <p className="mt-2 text-xs text-muted-foreground">
                Last spoke {formatDate(l.last_call_date)}
                {l.last_call_time ? ` · ${formatTime(l.last_call_time)}` : ""}
                {l.last_outcome ? ` — ${humanise(l.last_outcome)}` : ""}
              </p>

              {l.last_notes ? (
                <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">{l.last_notes}</p>
              ) : (
                <p className="mt-1 text-sm italic text-muted-foreground">No notes on the last call.</p>
              )}
            </div>
          ))}
        </div>
      )}

      <LeadCalls
        lead={openLead}
        onClose={() => setOpenLead(null)}
        onOpenCall={(c) => setOpenCall(c)}
      />

      <CallDetail
        call={openCall}
        onClose={() => {
          setOpenCall(null);
          // A comment may have been added; the counts are now stale.
          load();
        }}
      />
    </SalesLayout>
  );
}
