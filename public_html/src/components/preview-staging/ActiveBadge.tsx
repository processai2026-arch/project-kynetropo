import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ActiveBadgeProps {
  /** When true renders the emerald Active variant; when false renders the gray Inactive variant. */
  isActive: boolean;
}

export function ActiveBadge({ isActive }: ActiveBadgeProps) {
  return (
    <Badge
      className={cn(
        "border capitalize",
        isActive
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : "bg-gray-100 text-gray-500 border-gray-200"
      )}
    >
      {isActive ? "Active" : "Inactive"}
    </Badge>
  );
}

export default ActiveBadge;
