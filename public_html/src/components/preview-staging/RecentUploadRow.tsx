import { cn } from "@/lib/utils";

const STATUS_DOT: Record<string, string> = {
  approved:   "bg-emerald-500",
  review:     "bg-blue-500",
  processing: "bg-amber-400",
  pending:    "bg-amber-400",
  error:      "bg-red-500",
  rejected:   "bg-gray-400",
};

export interface RecentUploadRowProps {
  categoryLabel: string;
  identifier: string;
  date: string;
  status: string;
  onClick?: () => void;
}

export function RecentUploadRow({
  categoryLabel,
  identifier,
  date,
  status,
  onClick,
}: RecentUploadRowProps) {
  const statusColor = STATUS_DOT[status] ?? "bg-gray-400";

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 cursor-pointer hover:bg-muted/20"
      onClick={onClick}
    >
      <span className="text-xs font-medium capitalize px-2 py-0.5 bg-muted rounded text-muted-foreground shrink-0">
        {categoryLabel}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-mono text-card-foreground truncate">{identifier}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{date}</p>
      </div>
      <span className={cn("w-2 h-2 rounded-full shrink-0", statusColor)} />
    </div>
  );
}
