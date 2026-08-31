import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Product {
  id: number;
  product: string;
}

interface LineItem {
  product_id: number;
  quantity: number;
  unit_price: number;
}

interface LineItemRowProps {
  index: number;
  item: LineItem;
  products: Product[];
  isOnly: boolean;
  onProductSelect: (index: number, productId: number) => void;
  onUpdate: (index: number, patch: Partial<LineItem>) => void;
  onRemove: (index: number) => void;
}

export function LineItemRow({
  index,
  item,
  products,
  isOnly,
  onProductSelect,
  onUpdate,
  onRemove,
}: LineItemRowProps) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_100px_130px_36px] gap-2 items-end rounded-lg border p-3">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Product</Label>
        <Select
          value={item.product_id ? String(item.product_id) : ""}
          onValueChange={(v) => onProductSelect(index, Number(v))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select product" />
          </SelectTrigger>
          <SelectContent>
            {products.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.product}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Qty</Label>
        <Input
          type="number"
          min={1}
          value={item.quantity}
          onChange={(e) =>
            onUpdate(index, { quantity: Math.max(1, Number(e.target.value)) })
          }
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Unit Price</Label>
        <Input
          type="number"
          min={0}
          step={0.01}
          value={item.unit_price}
          onChange={(e) =>
            onUpdate(index, { unit_price: Number(e.target.value) })
          }
        />
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-10 w-9 p-0"
        disabled={isOnly}
        onClick={() => onRemove(index)}
      >
        <Trash2
          className={cn(
            "h-4 w-4",
            isOnly ? "text-muted-foreground" : "text-destructive"
          )}
        />
      </Button>
    </div>
  );
}
