import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { salesTasksApi } from "@/lib/api/sales";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import type { SalesTask, SalesTaskDetail, TaskPriority } from "@/types/sales";

/**
 * Give someone a task, or change one you gave.
 *
 * "Who is this for?" is the only field with no sensible default — a task
 * nobody owns is a note, and the whole point of this screen is that somebody
 * specific has to come back and say it is done.
 */

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

export function TaskDialog({
  open,
  task,
  leadId,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** null creates; a task edits it. */
  task: SalesTask | null;
  /** Pre-links the task to a lead when opened from a lead screen. */
  leadId?: number | null;
  onClose: () => void;
  onSaved: (saved: SalesTaskDetail) => void;
}) {
  const people = useTeamMembers(open);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    assigned_to: "",
    due_date: "",
    due_time: "",
    priority: "normal" as TaskPriority,
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      title: task?.title ?? "",
      description: task?.description ?? "",
      assigned_to: task ? String(task.assigned_to) : "",
      due_date: task?.due_date ?? "",
      due_time: task?.due_time ? task.due_time.slice(0, 5) : "",
      priority: task?.priority ?? "normal",
    });
  }, [open, task]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.title.trim().length < 3) {
      toast.error("Give the task a title");
      return;
    }
    if (!form.assigned_to) {
      toast.error("Choose who this task is for");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        assigned_to: Number(form.assigned_to),
        due_date: form.due_date,
        due_time: form.due_time,
        priority: form.priority,
        lead_id: leadId ?? task?.lead_id ?? null,
      };
      const saved = task
        ? await salesTasksApi.update(task.id, payload)
        : await salesTasksApi.create(payload);
      toast.success(task ? "Task updated" : `Task given to ${saved.assigned_to_name}`);
      onSaved(saved);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the task");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{task ? "Edit task" : "Give a task"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="task-title">What needs doing?</Label>
            <Input
              id="task-title"
              required
              maxLength={200}
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Send the revised quotation to Sacs Foods"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-assignee">Who is it for?</Label>
            <Select
              value={form.assigned_to}
              onValueChange={(v) => setForm((f) => ({ ...f, assigned_to: v }))}
            >
              <SelectTrigger id="task-assignee">
                <SelectValue placeholder="Choose a person" />
              </SelectTrigger>
              <SelectContent>
                {people.map((p) => (
                  <SelectItem key={p.user_id} value={String(p.user_id)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Only they can mark it done, and you are the one told when they do.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="task-date">Due date (optional)</Label>
              <Input
                id="task-date"
                type="date"
                value={form.due_date}
                onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-time">Time (optional)</Label>
              <Input
                id="task-time"
                type="time"
                value={form.due_time}
                onChange={(e) => setForm((f) => ({ ...f, due_time: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-priority">Priority</Label>
            <Select
              value={form.priority}
              onValueChange={(v) => setForm((f) => ({ ...f, priority: v as TaskPriority }))}
            >
              <SelectTrigger id="task-priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-notes">Details (optional)</Label>
            <Textarea
              id="task-notes"
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Anything they need to know to finish it"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : task ? "Save changes" : "Give task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
