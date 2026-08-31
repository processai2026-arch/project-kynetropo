import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import type { InvoiceLine } from "@/lib/api/invoices";

const DEFAULT_GST_RATES = [0, 5, 12, 18, 28];

export interface EditableLineItemRowProps {
  line: InvoiceLine;
  gstRates?: number[];
  inr: (n: number) => string;
  onUpdate: (id: string, patch: Partial<InvoiceLine>) => void;
  onRemove: (id: string) => void;
}

export function EditableLineItemRow({
  line,
  gstRates = DEFAULT_GST_RATES,
  inr,
  onUpdate,
  onRemove,
}: EditableLineItemRowProps) {
  const lineTotal = line.qty * line.unitPrice;

  return (
    <tr className="border-t hover:bg-muted/30 transition-colors">
      <td className="px-2 py-1">
        <Input
          className="h-8 min-w-[120px] text-sm"
          value={line.description}
          placeholder="Item description"
          onChange={e => onUpdate(line.id, { description: e.target.value })}
        />
      </td>
      <td className="px-2 py-1">
        <Input
          className="h-8 w-24 text-sm"
          value={line.hsn}
          placeholder="HSN"
          onChange={e => onUpdate(line.id, { hsn: e.target.value })}
        />
      </td>
      <td className="px-2 py-1">
        <Input
          type="number"
          className="h-8 w-20 text-sm"
          value={line.qty}
          min={1}
          onChange={e => onUpdate(line.id, { qty: Number(e.target.value) })}
        />
      </td>
      <td className="px-2 py-1">
        <Input
          type="number"
          className="h-8 w-28 text-sm"
          value={line.unitPrice}
          min={0}
          step={0.01}
          onChange={e => onUpdate(line.id, { unitPrice: Number(e.target.value) })}
        />
      </td>
      <td className="px-2 py-1">
        <Select
          value={String(line.gstRate)}
          onValueChange={v => onUpdate(line.id, { gstRate: Number(v) })}
        >
          <SelectTrigger className="h-8 w-24 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {gstRates.map(rate => (
              <SelectItem key={rate} value={String(rate)}>
                {rate}%
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="px-4 py-1 text-right text-sm font-medium text-card-foreground whitespace-nowrap">
        {inr(lineTotal)}
      </td>
      <td className="px-2 py-1">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={() => onRemove(line.id)}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </td>
    </tr>
  );
}
