import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CheckCircle2, ClipboardList, Clock, Pencil, Play, Plus, RotateCcw, Undo2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { salesTasksApi } from "@/lib/api/sales";
import { useSalesAccess } from "@/hooks/useSalesAccess";
import { useConfirm } from "@/components/ConfirmDialog";
import { SalesLayout } from "@/components/sales/SalesLayout";
import { TaskDialog } from "@/components/sales/TaskDialog";
import { CommentButton, CommentThread } from "@/components/sales/CommentThread";
import { formatDate, formatDateTime, formatTime, humanise } from "@/components/sales/SalesBits";
import type { SalesTask, SalesTaskDetail, TaskBucket, TaskCounts } from "@/types/sales";
import { cn } from "@/lib/utils";

/**
 * Tasks — work one person handed another.
 *
 * The page answers two questions and nothing else: what do I owe, and what am
 * I waiting on. "Mine" and "Given" are those two; Overdue and Completed are
 * the same rows filtered.
 *
 * Only the assignee can complete a task, and only the assigner can hand it
 * back — the server decides both and ships the answer as can_* flags, so the
 * buttons here can never offer something the API will refuse.
 */

const TABS: { key: TaskBucket; label: string }[] = [
  { key: "mine", label: "My tasks" },
  { key: "given", label: "I assigned" },
  { key: "overdue", label: "Overdue" },
  { key: "completed", label: "Done" },
];

const PRIORITY_STYLES: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-secondary text-secondary-foreground",
  high: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400",
  critical: "bg-destructive/10 text-destructive",
};

const STATUS_STYLES: Record<string, string> = {
  open: "bg-secondary text-secondary-foreground",
  in_progress: "bg-primary/10 text-primary",
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400",
  cancelled: "bg-muted text-muted-foreground line-through",
};

function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", className)}>
      {children}
    </span>
  );
}

/** When it is due, and whether that is a problem. */
function DueLine({ task }: { task: SalesTask }) {
  if (!task.due_date) return <span className="text-muted-foreground">No date</span>;
  return (
    <span className={cn("inline-flex items-center gap-1", task.is_overdue && "font-medium text-destructive")}>
      <Clock className="h-3.5 w-3.5" />
      {formatDate(task.due_date)}
      {task.due_time ? ` · ${formatTime(task.due_time)}` : ""}
      {task.is_overdue ? " · overdue" : ""}
    </span>
  );
}

export default function SalesTasks() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { can, me } = useSalesAccess();
  const confirm = useConfirm();

  const requested = (searchParams.get("bucket") as TaskBucket) ?? "mine";
  const [bucket, setBucket] = useState<TaskBucket>(
    TABS.some((t) => t.key === requested) ? requested : "mine",
  );
  const [items, setItems] = useState<SalesTask[]>([]);
  const [counts, setCounts] = useState<TaskCounts>({
    mine: 0, given: 0, live: 0, overdue: 0, completed: 0, cancelled: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SalesTask | null>(null);
  const [open, setOpen] = useState<SalesTaskDetail | null>(null);
  const [completing, setCompleting] = useState<SalesTask | null>(null);
  const [completionNotes, setCompletionNotes] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await salesTasksApi.list({ bucket });
      setItems(res.items ?? []);
      setCounts(res.counts);
      setError(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not load tasks";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [bucket]);

  useEffect(() => {
    void load();
  }, [load]);

  // A notification links straight to one task (/sales/tasks?task=12). Open it,
  // then drop the parameter so a refresh does not reopen it forever.
  const deepLink = searchParams.get("task");
  useEffect(() => {
    if (!deepLink) return;
    const id = Number(deepLink);
    if (!Number.isFinite(id) || id < 1) return;
    void salesTasksApi
      .get(id)
      .then(setOpen)
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not open that task"));
    const next = new URLSearchParams(searchParams);
    next.delete("task");
    setSearchParams(next, { replace: true });
  }, [deepLink, searchParams, setSearchParams]);

  /** Applies a server response to both the list and the open detail. */
  const applySaved = (saved: SalesTaskDetail) => {
    setItems((prev) => {
      const known = prev.some((t) => t.id === saved.id);
      // A task that no longer belongs in this tab (completed while on "Mine")
      // is dropped rather than left showing a stale state.
      const fits =
        bucket === "completed"
          ? saved.status === "completed"
          : bucket === "overdue"
            ? saved.is_overdue
            : saved.is_live;
      if (!known) return fits ? [saved, ...prev] : prev;
      return fits ? prev.map((t) => (t.id === saved.id ? saved : t)) : prev.filter((t) => t.id !== saved.id);
    });
    setOpen((cur) => (cur && cur.id === saved.id ? { ...cur, ...saved } : cur));
    // Counts move on almost every action; one cheap refresh keeps the badges honest.
    void salesTasksApi.list({ bucket }).then((res) => setCounts(res.counts)).catch(() => {});
  };

  const run = async (id: number, action: () => Promise<SalesTaskDetail>, message: string) => {
    setBusyId(id);
    try {
      applySaved(await action());
      toast.success(message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That did not work");
    } finally {
      setBusyId(null);
    }
  };

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completing) return;
    const id = completing.id;
    const notes = completionNotes.trim();
    setCompleting(null);
    setCompletionNotes("");
    await run(id, () => salesTasksApi.complete(id, notes || undefined), "Marked done — they have been told");
  };

  const handleReopen = async (task: SalesTask) => {
    const ok = await confirm({
      title: "Hand this task back?",
      description: `${task.assigned_to_name} will see it as open again.`,
      confirmLabel: "Hand back",
    });
    if (!ok) return;
    await run(task.id, () => salesTasksApi.reopen(task.id), "Task handed back");
  };

  const handleCancel = async (task: SalesTask) => {
    const ok = await confirm({
      title: "Cancel this task?",
      description: "It stays in the history and can be restored — nothing is deleted.",
      confirmLabel: "Cancel task",
      destructive: true,
    });
    if (!ok) return;
    await run(task.id, () => salesTasksApi.cancel(task.id), "Task cancelled");
  };

  const actions = (task: SalesTask) => {
    const busy = busyId === task.id;
    return (
      <>
        {task.can_start && (
          <Button size="sm" variant="secondary" className="h-9" disabled={busy}
                  onClick={() => void run(task.id, () => salesTasksApi.start(task.id), "Task started")}>
            <Play className="mr-1.5 h-3.5 w-3.5" />
            Start
          </Button>
        )}
        {task.can_complete && (
          <Button size="sm" className="h-9" disabled={busy} onClick={() => setCompleting(task)}>
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
            Mark done
          </Button>
        )}
        {task.can_acknowledge && (
          <Button size="sm" className="h-9" disabled={busy}
                  onClick={() => void run(task.id, () => salesTasksApi.acknowledge(task.id), "Work accepted")}>
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
            Accept work
          </Button>
        )}
        {task.can_reopen && (
          <Button size="sm" variant="outline" className="h-9" disabled={busy} onClick={() => void handleReopen(task)}>
            <Undo2 className="mr-1.5 h-3.5 w-3.5" />
            Hand back
          </Button>
        )}
        {task.can_edit && (
          <Button size="sm" variant="ghost" className="h-9 text-muted-foreground" disabled={busy}
                  onClick={() => { setEditing(task); setDialogOpen(true); }}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Edit
          </Button>
        )}
        {task.can_cancel && (
          <Button size="sm" variant="ghost" className="h-9 text-muted-foreground" disabled={busy}
                  onClick={() => void handleCancel(task)}>
            <X className="mr-1.5 h-3.5 w-3.5" />
            Cancel
          </Button>
        )}
        {task.can_restore && (
          <Button size="sm" variant="outline" className="h-9" disabled={busy}
                  onClick={() => void run(task.id, () => salesTasksApi.restore(task.id), "Task restored")}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Undo cancel
          </Button>
        )}
      </>
    );
  };

  if (!can("sales.tasks.view")) {
    return (
      <SalesLayout>
        <h1 className="text-2xl font-bold text-foreground">Tasks</h1>
        <div className="rounded-2xl border border-dashed bg-card/50 p-10 text-center text-sm text-muted-foreground">
          You do not have access to tasks. Ask your administrator.
        </div>
      </SalesLayout>
    );
  }

  return (
    <SalesLayout onCreated={() => void load()}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tasks</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Work you owe, and work you are waiting on.
          </p>
        </div>
        {can("sales.tasks.create") && (
          <Button className="h-10 shrink-0" onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="mr-1.5 h-4 w-4" />
            Give a task
          </Button>
        )}
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setBucket(t.key);
              setSearchParams(t.key === "mine" ? {} : { bucket: t.key }, { replace: true });
            }}
            className={cn(
              "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              bucket === t.key
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-muted",
            )}
          >
            {t.label}
            {counts[t.key] > 0 && (
              <span
                className={cn(
                  "ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                  bucket === t.key ? "bg-primary-foreground/20" : "bg-muted",
                  t.key === "overdue" && bucket !== t.key && "bg-destructive/10 text-destructive",
                )}
              >
                {counts[t.key]}
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
          <ClipboardList className="mx-auto h-7 w-7 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            {bucket === "mine"
              ? "Nothing on your plate."
              : bucket === "given"
                ? "You have not given anyone a task yet."
                : bucket === "overdue"
                  ? "Nothing overdue — well done."
                  : "Nothing completed yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0 xl:grid-cols-3">
          {items.map((task) => (
            <div key={task.id} className="rounded-2xl border bg-card p-4 shadow-sm">
              <button
                type="button"
                className="w-full text-left"
                onClick={() =>
                  void salesTasksApi
                    .get(task.id)
                    .then(setOpen)
                    .catch((e: unknown) =>
                      toast.error(e instanceof Error ? e.message : "Could not open that task"),
                    )
                }
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 font-semibold text-card-foreground">{task.title}</p>
                  <Pill className={PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES.normal}>
                    {task.priority}
                  </Pill>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {task.is_assignee
                    ? `From ${task.assigned_by_name || "—"}`
                    : `For ${task.assigned_to_name}`}
                  {task.lead_company || task.lead_name ? ` · ${task.lead_company || task.lead_name}` : ""}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <DueLine task={task} />
                  <Pill className={STATUS_STYLES[task.status] ?? STATUS_STYLES.open}>
                    {humanise(task.status)}
                  </Pill>
                  {task.status === "completed" && !task.reviewed_at && task.is_assigner && (
                    <span className="text-primary">waiting on you</span>
                  )}
                </div>
              </button>

              {task.completion_notes && task.status === "completed" && (
                <p className="mt-2 rounded-lg bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground">
                  {task.completion_notes}
                </p>
              )}

              {can("sales.comments.view") && (
                <div className="mt-2">
                  <CommentButton
                    count={task.comment_count}
                    onClick={() =>
                      void salesTasksApi
                        .get(task.id)
                        .then(setOpen)
                        .catch(() => toast.error("Could not open that task"))
                    }
                  />
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-2">{actions(task)}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── The task itself: details, history and the discussion ───────────── */}
      <Dialog open={open !== null} onOpenChange={(o) => { if (!o) { setOpen(null); void load(); } }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle className="pr-6">{open.title}</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Pill className={STATUS_STYLES[open.status] ?? STATUS_STYLES.open}>{humanise(open.status)}</Pill>
                  <Pill className={PRIORITY_STYLES[open.priority] ?? PRIORITY_STYLES.normal}>{open.priority}</Pill>
                  <DueLine task={open} />
                  {open.task_code && <span>{open.task_code}</span>}
                </div>

                <div className="rounded-xl border bg-muted/30 p-3 text-sm">
                  <p>
                    <span className="text-muted-foreground">For</span>{" "}
                    <span className="font-medium">{open.assigned_to_name}</span>
                    <span className="text-muted-foreground"> · from </span>
                    <span className="font-medium">{open.assigned_by_name || "—"}</span>
                  </p>
                  {open.description && (
                    <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{open.description}</p>
                  )}
                </div>

                {open.status === "completed" && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
                    <p className="font-medium text-emerald-700 dark:text-emerald-400">
                      Completed {formatDateTime(open.completed_at)}
                    </p>
                    {open.completion_notes && (
                      <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{open.completion_notes}</p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {open.reviewed_at
                        ? `Accepted ${formatDateTime(open.reviewed_at)}`
                        : "Waiting for the person who assigned it to accept the work."}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">{actions(open)}</div>

                {open.activity.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold">History</h3>
                    <ul className="mt-2 space-y-2">
                      {open.activity.map((a) => (
                        <li key={a.id} className="flex gap-2 text-xs text-muted-foreground">
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/50" />
                          <span className="min-w-0">
                            <span className="font-medium text-card-foreground">{humanise(a.action)}</span>
                            {a.actor_name ? ` · ${a.actor_name}` : ""} · {formatDateTime(a.created_at)}
                            {a.notes ? <span className="block">{a.notes}</span> : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {can("sales.comments.view") && (
                  <div>
                    <h3 className="text-sm font-semibold">Discussion</h3>
                    <CommentThread
                      className="mt-2"
                      entityType="task"
                      entityId={open.id}
                      initialComments={open.comments}
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Marking it done ────────────────────────────────────────────────── */}
      <Dialog open={completing !== null} onOpenChange={(o) => !o && setCompleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark this task done</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleComplete} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {completing?.assigned_by_name
                ? `${completing.assigned_by_name} will be told it is finished.`
                : "The person who assigned it will be told."}
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="task-done-notes">What did you do? (optional)</Label>
              <Textarea
                id="task-done-notes"
                rows={3}
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                placeholder="Quotation sent and acknowledged over the phone"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCompleting(null)}>
                Cancel
              </Button>
              <Button type="submit">Mark done</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <TaskDialog
        open={dialogOpen}
        task={editing}
        onClose={() => { setDialogOpen(false); setEditing(null); }}
        onSaved={(saved) => {
          applySaved(saved);
          // A newly given task lands in "I assigned", not wherever you were.
          if (!editing && saved.assigned_to !== me?.user_id && bucket !== "given") setBucket("given");
          else void load();
        }}
      />
    </SalesLayout>
  );
}
