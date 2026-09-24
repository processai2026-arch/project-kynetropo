import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquare, Pencil, RotateCcw, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { salesCommentsApi } from "@/lib/api/sales";
import { useSalesAccess } from "@/hooks/useSalesAccess";
import { useTeamMembers, type TeamMember } from "@/hooks/useTeamMembers";
import { CommentBody, MentionInput, mentionsIn } from "@/components/sales/MentionInput";
import type { CommentEntityType, SalesComment } from "@/types/sales";
import { cn } from "@/lib/utils";

/**
 * The discussion thread on a sales record — a lead, call, follow-up, meeting or
 * challenge. The point is that a question about a deal lives on the record it
 * is about, where the next person to open it will actually find it.
 *
 * A deleted comment keeps its place as a tombstone that can be undone, matching
 * the rest of the module: a mis-click should never quietly remove history.
 */

const MAX_LENGTH = 2000;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** "just now" / "12 min ago" / "3 Sep, 4:30 pm" — recent times read better as ages. */
function timeAgo(iso: string): string {
  const then = new Date(iso.replace(" ", "T")).getTime();
  if (Number.isNaN(then)) return iso;
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)} h ago`;
  return new Date(then).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function CommentRow({
  comment,
  canEdit,
  canDelete,
  people,
  onChanged,
}: {
  comment: SalesComment;
  canEdit: boolean;
  canDelete: boolean;
  people: TeamMember[];
  onChanged: (updated: SalesComment | null, removedId?: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body ?? "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const text = draft.trim();
    if (!text) {
      toast.error("A comment cannot be empty");
      return;
    }
    setBusy(true);
    try {
      // Re-derived from the final text, so a name edited out of the comment
      // stops being a mention.
      onChanged(await salesCommentsApi.update(comment.id, text, mentionsIn(text, people)));
      setEditing(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update the comment");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await salesCommentsApi.remove(comment.id);
      onChanged({ ...comment, body: null, deleted: true, deleted_at: new Date().toISOString() });
      toast.success("Comment deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete the comment");
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    setBusy(true);
    try {
      onChanged(await salesCommentsApi.restore(comment.id));
      toast.success("Comment restored");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not restore the comment");
    } finally {
      setBusy(false);
    }
  };

  if (comment.deleted) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed bg-muted/30 px-3 py-2">
        <p className="text-xs italic text-muted-foreground">
          Comment deleted{comment.author_name ? ` — ${comment.author_name}` : ""}
        </p>
        {canDelete && (
          <Button size="sm" variant="ghost" className="h-7 shrink-0 px-2 text-xs" disabled={busy} onClick={() => void restore()}>
            <RotateCcw className="mr-1 h-3 w-3" />
            Undo
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold text-primary">
        {initials(comment.author_name || "?")}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-medium text-card-foreground">{comment.author_name || "Unknown"}</span>
          <span className="text-xs text-muted-foreground">{timeAgo(comment.created_at)}</span>
          {comment.edited_at && <span className="text-xs text-muted-foreground">(edited)</span>}
        </div>

        {editing ? (
          <div className="mt-1.5 space-y-2">
            <MentionInput
              rows={3}
              maxLength={MAX_LENGTH}
              value={draft}
              people={people}
              onChange={setDraft}
              onSubmit={() => void save()}
            />
            <div className="flex gap-2">
              <Button size="sm" className="h-8" disabled={busy} onClick={() => void save()}>
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8"
                onClick={() => {
                  setDraft(comment.body ?? "");
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <CommentBody body={comment.body ?? ""} mentions={comment.mentions} />
        )}

        {!editing && (canEdit || canDelete) && (
          <div className="mt-1 flex gap-1">
            {canEdit && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-muted-foreground"
                onClick={() => setEditing(true)}
              >
                <Pencil className="mr-1 h-3 w-3" />
                Edit
              </Button>
            )}
            {canDelete && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-muted-foreground"
                disabled={busy}
                onClick={() => void remove()}
              >
                <Trash2 className="mr-1 h-3 w-3" />
                Delete
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function CommentThread({
  entityType,
  entityId,
  initialComments,
  className,
  compact,
  onCountChange,
}: {
  entityType: CommentEntityType;
  entityId: number;
  /** Comments already loaded with the parent record — saves a round trip. */
  initialComments?: SalesComment[];
  className?: string;
  compact?: boolean;
  onCountChange?: (count: number) => void;
}) {
  const { me, can, isSalesAdmin } = useSalesAccess();
  const people = useTeamMembers(can("sales.comments.create"));
  const [items, setItems] = useState<SalesComment[]>(initialComments ?? []);
  const [loading, setLoading] = useState(initialComments === undefined);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  // Parents pass an inline arrow here. Holding it in a ref keeps `report`
  // stable, so the load effect below does not re-run on every parent render —
  // which, when the parent reloads on the count, would loop forever.
  const countCb = useRef(onCountChange);
  countCb.current = onCountChange;
  const report = useCallback(
    (list: SalesComment[]) => countCb.current?.(list.filter((c) => !c.deleted).length),
    [],
  );

  useEffect(() => {
    if (initialComments !== undefined) {
      setItems(initialComments);
      report(initialComments);
      return;
    }
    let cancelled = false;
    setLoading(true);
    salesCommentsApi
      .list(entityType, entityId)
      .then((rows) => {
        if (cancelled) return;
        setItems(rows);
        report(rows);
      })
      .catch((e: unknown) => !cancelled && toast.error(e instanceof Error ? e.message : "Could not load comments"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId, initialComments, report]);

  const post = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setPosting(true);
    try {
      const created = await salesCommentsApi.create(entityType, entityId, text, mentionsIn(text, people));
      if (created) {
        setItems((prev) => {
          const next = [...prev, created];
          report(next);
          return next;
        });
      }
      setDraft("");
      endRef.current?.scrollIntoView({ block: "nearest" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not post the comment");
    } finally {
      setPosting(false);
    }
  };

  const applyChange = (updated: SalesComment | null, removedId?: number) => {
    setItems((prev) => {
      const next = updated
        ? prev.map((c) => (c.id === updated.id ? updated : c))
        : prev.filter((c) => c.id !== removedId);
      report(next);
      return next;
    });
  };

  const myId = me?.user_id ?? null;
  const canComment = can("sales.comments.create");
  const visible = items.filter((c) => !c.deleted || isSalesAdmin);

  return (
    <div className={cn("space-y-3", className)}>
      {loading ? (
        <Skeleton className="h-16 w-full rounded-xl" />
      ) : visible.length === 0 ? (
        !compact && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MessageSquare className="h-3.5 w-3.5" />
            No comments yet.
          </div>
        )
      ) : (
        <div className="space-y-4">
          {visible.map((c) => (
            <CommentRow
              key={c.id}
              comment={c}
              canEdit={!c.deleted && myId !== null && c.author_id === myId && canComment}
              canDelete={!c.deleted ? myId !== null && (c.author_id === myId || isSalesAdmin) : isSalesAdmin}
              people={people}
              onChanged={applyChange}
            />
          ))}
          <div ref={endRef} />
        </div>
      )}

      {canComment && (
        /*
         * The box gets the full width and the buttons sit under it.
         * Side by side, a three-row textarea left the send button stranded
         * against the right edge of the screen — where, on a phone, the sales
         * quick-add button is also drawn.
         */
        <form onSubmit={post} className="space-y-2">
          <MentionInput
            rows={compact ? 2 : 3}
            maxLength={MAX_LENGTH}
            value={draft}
            people={people}
            onChange={setDraft}
            onSubmit={() => void post()}
            placeholder="Add a comment…"
            className="min-h-[2.75rem] resize-y"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] text-muted-foreground">Type @ to bring someone in</p>
            <Button type="submit" size="sm" className="h-9 shrink-0 px-4" disabled={posting || !draft.trim()}>
              <Send className="mr-1.5 h-3.5 w-3.5" />
              {posting ? "Posting…" : "Post"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

/** The thread in a dialog — used from a row that has no space to inline it. */
export function CommentThreadDialog({
  open,
  onOpenChange,
  title,
  entityType,
  entityId,
  onCountChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  entityType: CommentEntityType;
  entityId: number;
  onCountChange?: (count: number) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            {title}
          </DialogTitle>
        </DialogHeader>
        {open && (
          <div className="max-h-[60vh] overflow-y-auto pr-1">
            <CommentThread entityType={entityType} entityId={entityId} onCountChange={onCountChange} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** The little "3" bubble that opens a thread from a list row. */
export function CommentButton({
  count,
  onClick,
  className,
}: {
  count: number;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted",
        count > 0 && "border-primary/30 text-primary",
        className,
      )}
      aria-label={count > 0 ? `${count} comments` : "Add a comment"}
    >
      <MessageSquare className="h-3 w-3" />
      {count > 0 ? count : "Comment"}
    </button>
  );
}
