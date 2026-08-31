import { cn } from "@/lib/utils";

export interface TimelineEntryProps {
  history_id: number;
  from_status: string | null;
  to_status: string;
  created_at: string;
  changed_by_name?: string | null;
  note?: string | null;
  className?: string;
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function TimelineEntry({
  from_status,
  to_status,
  created_at,
  changed_by_name = null,
  note = null,
  className,
}: TimelineEntryProps) {
  const timestamp = formatTimestamp(created_at);

  return (
    <li className={cn("flex items-start gap-2 text-xs", className)}>
      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
      <div>
        <p className="text-card-foreground font-medium">
          {from_status ? `${from_status} → ${to_status}` : to_status}
        </p>
        <p className="text-muted-foreground">
          {timestamp}
          {changed_by_name ? ` · ${changed_by_name}` : ""}
          {note ? ` · ${note}` : ""}
        </p>
      </div>
    </li>
  );
}
