import { cn } from "@/lib/utils";

interface DialogNetPaySummaryRowProps {
  label: string;
  value: string;
  className?: string;
}

export function DialogNetPaySummaryRow({
  label,
  value,
  className,
}: DialogNetPaySummaryRowProps) {
  return (
    <div
      className={cn(
        "flex justify-between font-bold border-t pt-3 text-base",
        className
      )}
    >
      <span>{label}</span>
      <span className="text-primary">{value}</span>
    </div>
  );
}
