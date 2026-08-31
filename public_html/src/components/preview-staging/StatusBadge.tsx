import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const STATUS_STYLES: Record<string, string> = {
  delivered: "bg-status-delivered/10 text-status-delivered border-status-delivered/20",
  processing: "bg-status-processing/10 text-status-processing border-status-processing/20",
  shipped: "bg-status-shipped/10 text-status-shipped border-status-shipped/20",
  pending: "bg-status-pending/10 text-status-pending border-status-pending/20",
  confirmed: "bg-status-confirmed/10 text-status-confirmed border-status-confirmed/20",
  "out-for-delivery": "bg-status-out-for-delivery/10 text-status-out-for-delivery",
  cancelled: "bg-status-cancelled/10 text-status-cancelled border-status-cancelled/20",
  returned: "bg-status-returned/10 text-status-returned border-status-returned/20",
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  inactive: "bg-gray-100 text-gray-500 border-gray-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  unpaid: "bg-red-50 text-red-600 border-red-200",
  draft: "bg-gray-100 text-gray-500 border-gray-200",
  sent: "bg-blue-50 text-blue-600 border-blue-200",
  overdue: "bg-red-50 text-red-600 border-red-200",
  present: "bg-emerald-50 text-emerald-700 border-emerald-200",
  absent: "bg-red-50 text-red-600 border-red-200",
  half_day: "bg-amber-50 text-amber-600 border-amber-200",
  leave: "bg-purple-50 text-purple-600 border-purple-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-red-50 text-red-600 border-red-200",
  review: "bg-blue-50 text-blue-600 border-blue-200",
  error: "bg-red-50 text-red-600 border-red-200",
};

interface StatusBadgeProps {
  status: string;
  styles?: Record<string, string>;
  className?: string;
}

export function StatusBadge({ status, styles, className }: StatusBadgeProps) {
  const map = styles ?? STATUS_STYLES;
  return (
    <Badge
      className={cn(
        "border capitalize",
        map[status.toLowerCase()] ?? "bg-muted text-muted-foreground",
        className
      )}
    >
      {status.replace(/_/g, " ")}
    </Badge>
  );
}
