import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ComboInput } from "@/components/ui/combo-input";
import { inrFull } from "@/lib/currency";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InvoiceLine {
  product_name: string;
  hsn_code: string;
  quantity: number;
  unit: string;
  unit_price: number;
  gst_rate: number;
}

export interface InvoiceLineItemRowProps {
  line: InvoiceLine;
  idx: number;
  /** Total number of lines in the table — delete is disabled when this is 1. */
  totalLines: number;
  setLine: (idx: number, patch: Partial<InvoiceLine>) => void;
  removeLine: (idx: number) => void;
  /** GST percentage options, e.g. [0, 5, 12, 18, 28]. */
  GST_RATES: number[];
  /** Optional product name suggestions fed to the combobox. */
  products?: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const UNIT_OPTIONS = [
  'Nos', 'Kg', 'g', 'L', 'mL',
  'm', 'm²', 'm³',
  'Box', 'Pack', 'Set', 'Pair', 'Dozen',
  'Hr', 'Day',
];

function toNum(v: string): number {
  const n = parseFloat(v);
  return isFinite(n) ? n : 0;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function InvoiceLineItemRow({
  line,
  idx,
  totalLines,
  setLine,
  removeLine,
  GST_RATES,
  products = [],
}: InvoiceLineItemRowProps) {
  const lineTotal = line.quantity * line.unit_price;
  const set = (patch: Partial<InvoiceLine>) => setLine(idx, patch);

  return (
    <tr className="border-t hover:bg-muted/20 transition-colors">
      {/* Product / service name */}
      <td className="px-2 py-1 min-w-[240px]">
        <ComboInput
          value={line.product_name}
          onChange={v => set({ product_name: v })}
          options={products}
          placeholder="Product / service…"
          className="w-full"
        />
      </td>

      {/* HSN / SAC code */}
      <td className="px-2 py-1 w-28">
        <Input
          value={line.hsn_code}
          onChange={e => set({ hsn_code: e.target.value })}
          placeholder="44013"
          className="w-full"
        />
      </td>

      {/* Quantity */}
      <td className="px-2 py-1 w-24">
        <Input
          type="number"
          min="0.01"
          step="0.01"
          value={String(line.quantity)}
          onChange={e => set({ quantity: toNum(e.target.value) })}
          className="text-right w-full"
        />
      </td>

      {/* Unit of measure */}
      <td className="px-2 py-1 w-24">
        <Select value={line.unit} onValueChange={v => set({ unit: v })}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Unit" />
          </SelectTrigger>
          <SelectContent>
            {UNIT_OPTIONS.map(u => (
              <SelectItem key={u} value={u}>{u}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>

      {/* Unit price */}
      <td className="px-2 py-1 w-32">
        <Input
          type="number"
          min="0"
          step="0.01"
          value={String(line.unit_price)}
          onChange={e => set({ unit_price: toNum(e.target.value) })}
          className="text-right w-full"
        />
      </td>

      {/* GST rate */}
      <td className="px-2 py-1 w-28">
        <Select
          value={String(line.gst_rate)}
          onValueChange={v => set({ gst_rate: toNum(v) })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GST_RATES.map(r => (
              <SelectItem key={r} value={String(r)}>{r}%</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>

      {/* Line total — read-only, full precision */}
      <td className="px-2 py-2 text-right font-medium text-card-foreground whitespace-nowrap">
        {inrFull(lineTotal)}
      </td>

      {/* Delete row */}
      <td className="px-2 py-1 text-center">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          disabled={totalLines === 1}
          onClick={() => removeLine(idx)}
          aria-label="Remove line"
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </td>
    </tr>
  );
}

export default InvoiceLineItemRow;
