import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CalendarClock } from "lucide-react";

interface InventoryProductCardProps {
  product: string;
  sku: string;
  confidence_score: number;
  avg_monthly_consumption: number;
  suggested_reserve_qty: number;
  predicted_next_order_date?: string;
}

function ConfidenceBadge({ score }: { score: number }) {
  const clamped = Math.min(100, Math.max(0, score));

  return (
    <Badge
      className={cn(
        "border text-xs font-medium",
        clamped >= 80
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : clamped >= 50
          ? "bg-amber-50 text-amber-600 border-amber-200"
          : "bg-red-50 text-red-600 border-red-200"
      )}
    >
      {clamped}% confidence
    </Badge>
  );
}

export function InventoryProductCard({
  product,
  sku,
  confidence_score,
  avg_monthly_consumption,
  suggested_reserve_qty,
  predicted_next_order_date,
}: InventoryProductCardProps) {
  return (
    <div className="border rounded-lg p-3 space-y-1.5 bg-card">
      <div className="flex justify-between items-center">
        <span className="font-medium text-card-foreground">{product}</span>
        <ConfidenceBadge score={confidence_score} />
      </div>

      <p className="text-xs text-muted-foreground">SKU: {sku}</p>

      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Avg Monthly Consumption</span>
        <span className="text-card-foreground">{avg_monthly_consumption}</span>
      </div>

      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Suggested Reserve Qty</span>
        <span className="text-card-foreground">{suggested_reserve_qty}</span>
      </div>

      {predicted_next_order_date && (
        <div className="flex justify-between items-center text-xs">
          <span className="text-muted-foreground flex items-center gap-1">
            <CalendarClock className="h-3 w-3" />
            Predicted Order Date
          </span>
          <span className="text-card-foreground">{predicted_next_order_date}</span>
        </div>
      )}
    </div>
  );
}
