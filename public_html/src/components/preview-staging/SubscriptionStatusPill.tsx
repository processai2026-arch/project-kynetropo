import { cn } from "@/lib/utils";

interface SubscriptionStatusPillProps {
  status: string;
  statusColor: Record<string, string>;
}

export function SubscriptionStatusPill({
  status,
  statusColor,
}: SubscriptionStatusPillProps) {
  return (
    <span
      className={cn(
        "rounded-full px-3 py-1 text-xs font-medium",
        statusColor[status] ?? "bg-muted text-muted-foreground"
      )}
    >
      {status}
    </span>
  );
}
