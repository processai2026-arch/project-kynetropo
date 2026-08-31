import { cn } from "@/lib/utils";

const STATUS_DOT: Record<string, string> = {
  approved:   "bg-emerald-500",
  active:     "bg-emerald-500",
  paid:       "bg-emerald-500",
  delivered:  "bg-emerald-500",
  present:    "bg-emerald-500",
  review:     "bg-blue-500",
  sent:       "bg-blue-500",
  shipped:    "bg-blue-500",
  confirmed:  "bg-indigo-500",
  processing: "bg-amber-400",
  pending:    "bg-amber-400",
  half_day:   "bg-amber-400",
  error:      "bg-red-500",
  unpaid:     "bg-red-500",
  overdue:    "bg-red-500",
  cancelled:  "bg-red-500",
  absent:     "bg-red-500",
  returned:   "bg-purple-500",
  leave:      "bg-purple-500",
  rejected:   "bg-gray-400",
  inactive:   "bg-gray-400",
  draft:      "bg-gray-400",
};

interface StatusDotProps {
  status: string;
  className?: string;
}

export function StatusDot({ status, className }: StatusDotProps) {
  return (
    <span
      className={cn(
        "w-2 h-2 rounded-full shrink-0",
        STATUS_DOT[status] ?? "bg-gray-400",
        className
      )}
    />
  );
}
