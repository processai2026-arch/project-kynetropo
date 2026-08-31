import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const statusStyles: Record<string, string> = {
  posted:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  draft:   "bg-gray-100 text-gray-500 border-gray-200",
  pending: "bg-status-pending/10 text-status-pending border-status-pending/20",
  voided:  "bg-red-50 text-red-600 border-red-200",
};

export interface JournalMetaRowProps {
  entry_date: string;
  status: string;
  description?: string;
}

export function JournalMetaRow({
  entry_date,
  status,
  description = "",
}: JournalMetaRowProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-sm">
      <span className="text-card-foreground whitespace-nowrap">{entry_date}</span>
      <Badge
        className={cn(
          "border capitalize",
          statusStyles[status] ?? "bg-muted text-muted-foreground",
        )}
      >
        {status.replace(/_/g, " ")}
      </Badge>
      {description && (
        <span className="text-muted-foreground truncate">{description}</span>
      )}
    </div>
  );
}
