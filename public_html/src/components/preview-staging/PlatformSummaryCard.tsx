import { cn } from "@/lib/utils";

interface PlatformSummaryCardProps {
  marketplace: string;
  revenue: number;
  orders: number;
  commission: number;
  className?: string;
}

export function PlatformSummaryCard({
  marketplace,
  revenue,
  orders,
  commission,
  className,
}: PlatformSummaryCardProps) {
  return (
    <div className={cn("bg-card rounded-xl border shadow-sm p-4", className)}>
      <p className="text-sm font-semibold text-card-foreground capitalize">
        {marketplace}
      </p>
      <p className="text-xl font-bold text-foreground mt-1">
        ₹{revenue.toLocaleString("en-IN")}
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        {orders} orders · ₹{commission.toLocaleString("en-IN")} commission
      </p>
    </div>
  );
}
