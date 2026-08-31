import { cn } from "@/lib/utils";

type FulfilmentStatus = "shortfall" | "low_after_fulfilment" | "unknown" | "ok";

interface FulfilmentStatusLineProps {
  product_id: number;
  product_name?: string | null;
  status: FulfilmentStatus;
  available_quantity?: number | null;
  needed_quantity: number;
}

const statusClasses: Record<FulfilmentStatus, string> = {
  shortfall:            "text-destructive font-medium",
  low_after_fulfilment: "text-amber-500 font-medium",
  unknown:              "text-muted-foreground",
  ok:                   "text-primary font-medium",
};

function buildLabel(
  status: FulfilmentStatus,
  available_quantity: number | null | undefined,
  needed_quantity: number
): string {
  if (status === "unknown") return "Unmapped";
  return `${available_quantity ?? 0} avail. / ${needed_quantity} needed`;
}

export function FulfilmentStatusLine({
  product_id,
  product_name = null,
  status,
  available_quantity = null,
  needed_quantity,
}: FulfilmentStatusLineProps) {
  return (
    <div className="flex justify-between items-center text-xs bg-muted/30 rounded-lg px-3 py-2">
      <span className="text-card-foreground font-medium">
        {product_name ?? `Product #${product_id}`}
      </span>
      <span className={cn(statusClasses[status])}>
        {buildLabel(status, available_quantity, needed_quantity)}
      </span>
    </div>
  );
}
