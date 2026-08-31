import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PaidUnpaidBadgeProps {
  /** Whether the leave type is paid. Controls label text and color variant. */
  isPaid: boolean;
  /**
   * Override the label shown when isPaid is false.
   * Defaults to "Unpaid". Pass "Unpaid / LOP" for the leave register context.
   */
  unpaidLabel?: string;
  /** Extra Tailwind classes merged onto the badge element. */
  className?: string;
}

export function PaidUnpaidBadge({
  isPaid,
  unpaidLabel = "Unpaid",
  className,
}: PaidUnpaidBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "ml-2 border text-[10px]",
        isPaid
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-red-200 bg-red-50 text-red-600",
        className,
      )}
    >
      {isPaid ? "Paid" : unpaidLabel}
    </Badge>
  );
}

export default PaidUnpaidBadge;
