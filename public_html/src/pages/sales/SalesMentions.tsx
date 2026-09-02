import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AtSign, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { salesMentionsApi } from "@/lib/api/sales";
import { SalesLayout } from "@/components/sales/SalesLayout";
import { formatDateTime } from "@/components/sales/SalesBits";
import type { SalesMention } from "@/types/sales";
import { cn } from "@/lib/utils";

/**
 * Every time a colleague named you in a comment.
 *
 * Mentions were recorded from the start but had nowhere to go: unless you
 * happened to reopen the exact record, a question addressed to you by name went
 * unanswered. Tapping one opens the screen it was written on.
 *
 * Marked read when the page has been seen, not when each one is opened —
 * arriving here is the moment you found out, and a badge that only clears when
 * every item has been tapped is a badge that never clears.
 */
export default function SalesMentions() {
  const navigate = useNavigate();
  const [items, setItems] = useState<SalesMention[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Unread when the page loaded — so a mention stays highlighted while read. */
  const unreadOnArrival = useRef<Set<number>>(new Set());
  const marked = useRef(false);

  const load = useCallback(() => {
    setLoading(true);
    salesMentionsApi
      .list({ limit: 100 })
      .then((res) => {
        setItems(res.items ?? []);
        setError(null);
        if (!marked.current) {
          unreadOnArrival.current = new Set(
            (res.items ?? []).filter((m) => m.read_at === null).map((m) => m.comment_id),
          );
          if (unreadOnArrival.current.size > 0) {
            marked.current = true;
            // Fire and forget: failing to clear the badge must not stop the
            // page rendering the mentions it already has.
            void salesMentionsApi.markRead().catch(() => undefined);
          }
        }
      })
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : "Could not load your mentions";
        setError(message);
        toast.error(message);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  return (
    <SalesLayout>
      <div>
        <h1 className="text-2xl font-bold text-foreground">Mentioned</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          When someone writes your name in a comment, it lands here.
        </p>
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
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card/50 p-10 text-center">
          <AtSign className="mx-auto h-7 w-7 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Nobody has mentioned you yet. Type @ in any comment to call someone in.
          </p>
        </div>
      ) : (
        <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0 xl:grid-cols-3">
          {items.map((m) => {
            const fresh = unreadOnArrival.current.has(m.comment_id);
            return (
              <button
                key={m.comment_id}
                type="button"
                onClick={() => navigate(m.url)}
                className={cn(
                  "w-full rounded-2xl border bg-card p-4 text-left shadow-sm transition-colors hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  fresh && "border-primary/40 bg-primary/[0.04]",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-card-foreground">
                      {m.author_name}
                      {fresh && (
                        <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary-foreground">
                          New
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{m.where}</p>
                  </div>
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                </div>

                <p className="mt-2 whitespace-pre-wrap break-words text-sm text-card-foreground line-clamp-4">
                  {m.body}
                </p>

                <p className="mt-2 text-[11px] text-muted-foreground">
                  {formatDateTime(m.created_at)}
                  {m.edited_at ? " · edited" : ""}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </SalesLayout>
  );
}
