import type { DragEvent } from "react";
import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Minimal task shape the card needs.
 * The full Task type from @/types/task satisfies this interface via structural typing,
 * so you can pass a Task object directly without casting.
 */
export interface KanbanTask {
  id: number;
  task_code: string;
  title: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  assigned_to_name?: string | null;
  related_property_title?: string | null;
}

export interface KanbanTaskCardProps {
  /** Task data to render. */
  task: KanbanTask;
  /** When true the card renders at 40% opacity to indicate it is being dragged. */
  isDragging: boolean;
  /** When true the due-date label turns destructive red and bold. */
  isOverdue: boolean;
  /** Pre-formatted due-date string (e.g. "31 Jul 2026"). Parent is responsible for formatting. */
  dueDate: string;
  /** Fired on native dragstart. Receives the event and the task id so the parent can track which card is in flight. */
  onDragStart: (e: DragEvent<HTMLDivElement>, taskId: number) => void;
  /** Fired on native dragend, whether the card was dropped or the drag was cancelled. */
  onDragEnd: () => void;
  /** Fired when the user clicks the card. Receives the task id. */
  onClick: (taskId: number) => void;
}

const priorityStyles: Record<string, string> = {
  low:    'bg-gray-100    text-gray-600    border-gray-200',
  normal: 'bg-blue-50     text-blue-700    border-blue-200',
  high:   'bg-amber-50    text-amber-700   border-amber-200',
  urgent: 'bg-red-50      text-red-700     border-red-200',
};

export function KanbanTaskCard({
  task,
  isDragging,
  isOverdue,
  dueDate,
  onDragStart,
  onDragEnd,
  onClick,
}: KanbanTaskCardProps) {
  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, task.id)}
      onDragEnd={onDragEnd}
      onClick={() => onClick(task.id)}
      className={cn(
        'bg-card border rounded-xl p-3 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow',
        isDragging && 'opacity-40',
      )}
    >
      {/* Header: mono record code + priority badge */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="font-mono text-[11px] text-muted-foreground leading-none pt-0.5">
          {task.task_code}
        </span>
        <Badge
          className={cn(
            'border text-[10px] px-1.5 py-0 capitalize shrink-0',
            priorityStyles[task.priority] ?? 'bg-muted text-muted-foreground border-border',
          )}
        >
          {task.priority}
        </Badge>
      </div>

      {/* Title — 2-line clamp */}
      <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug">
        {task.title}
      </p>

      {/* Optional property pin — only when task is linked to a property */}
      {task.related_property_title && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground mt-1.5">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{task.related_property_title}</span>
        </p>
      )}

      {/* Footer: assignee (left) + overdue-aware due date (right) */}
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground mt-2 pt-2 border-t">
        <span className="truncate">{task.assigned_to_name ?? '—'}</span>
        <span className={cn('shrink-0', isOverdue && 'text-destructive font-medium')}>
          {dueDate}
        </span>
      </div>
    </div>
  );
}

export default KanbanTaskCard;
