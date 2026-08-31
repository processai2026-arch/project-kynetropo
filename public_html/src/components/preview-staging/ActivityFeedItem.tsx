import { cn } from "@/lib/utils";

interface ActivityFeedItemProps {
  status: string;
  actionLabel: string;
  identifier: string;
  date: string;
  contextLabel: string;
  onClick?: () => void;
}

const statusDotColors: Record<string, string> = {
  active:              "bg-emerald-500",
  success:             "bg-emerald-500",
  paid:                "bg-emerald-500",
  delivered:           "bg-emerald-500",
  confirmed:           "bg-emerald-500",
  present:             "bg-emerald-500",
  pending:             "bg-amber-400",
  half_day:            "bg-amber-400",
  processing:          "bg-blue-500",
  sent:                "bg-blue-500",
  shipped:             "bg-sky-500",
  "out-for-delivery":  "bg-sky-400",
  draft:               "bg-gray-400",
  inactive:            "bg-gray-400",
  cancelled:           "bg-red-500",
  overdue:             "bg-red-500",
  unpaid:              "bg-red-500",
  absent:              "bg-red-500",
  returned:            "bg-red-400",
  leave:               "bg-purple-400",
};

export function ActivityFeedItem({
  status,
  actionLabel,
  identifier,
  date,
  contextLabel,
  onClick,
}: ActivityFeedItemProps) {
  const statusColor = statusDotColors[status] ?? "bg-muted-foreground";

  return (
    <div
      className="flex items-start gap-3 px-4 py-3 border-b border-border last:border-0 cursor-pointer hover:bg-muted/20"
      onClick={onClick}
    >
      <span className={cn("mt-1.5 w-2 h-2 rounded-full shrink-0", statusColor)} />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-card-foreground capitalize">{actionLabel}</p>
        <p className="text-xs text-muted-foreground truncate font-mono mt-0.5">{identifier}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{date}</p>
      </div>
      <span className="text-xs text-muted-foreground capitalize shrink-0">{contextLabel}</span>
    </div>
  );
}
