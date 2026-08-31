import { cn } from "@/lib/utils";

interface LineItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
}

interface LineItemSubRowProps {
  lineItems: LineItem[];
  className?: string;
}

export function LineItemSubRow({ lineItems, className }: LineItemSubRowProps) {
  if (!lineItems.length) {
    return (
      <p className="text-xs italic text-muted-foreground">No line items</p>
    );
  }

  return (
    <div className={cn("border rounded-lg divide-y", className)}>
      {lineItems.map((li, i) => (
        <div key={i} className="px-3 py-2 text-xs">
          <div className="font-medium text-card-foreground">{li.product_name}</div>
          <div className="text-muted-foreground mt-0.5">
            Qty: {li.quantity} · ₹{Number(li.unit_price).toLocaleString("en-IN")} · Total: ₹{Number(li.total_amount).toLocaleString("en-IN")}
          </div>
        </div>
      ))}
    </div>
  );
}
