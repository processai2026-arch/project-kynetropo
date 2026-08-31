import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { GST_RATES, type InvoiceLine } from "@/lib/api/invoices";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EditableLineItemRowProps {
  line: InvoiceLine;
  removable: boolean;
  onUpdate: (id: string, patch: Partial<InvoiceLine>) => void;
  onRemove: (id: string) => void;
}

export interface LineItemsEditorSectionProps {
  lines: InvoiceLine[];
  isLoading: boolean;
  onAddLine: () => void;
  onUpdateLine: (id: string, patch: Partial<InvoiceLine>) => void;
  onRemoveLine: (id: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const inr = (n: number) =>
  `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const stripLeadingZero = (v: string) => v.replace(/^0+(?=\d)/, "");

// ─── EditableLineItemRow ──────────────────────────────────────────────────────

function EditableLineItemRow({
  line,
  removable,
  onUpdate,
  onRemove,
}: EditableLineItemRowProps) {
  return (
    <tr className="border-t">
      <td className="px-2 py-1">
        <Input
          value={line.description}
          placeholder="Description"
          onChange={(e) => onUpdate(line.id, { description: e.target.value })}
        />
      </td>
      <td className="px-2 py-1">
        <Input
          value={line.hsn}
          placeholder="HSN"
          onChange={(e) => onUpdate(line.id, { hsn: e.target.value })}
        />
      </td>
      <td className="px-2 py-1">
        <Input
          type="number"
          min="1"
          value={line.qty.toString()}
          onChange={(e) =>
            onUpdate(line.id, { qty: Number(stripLeadingZero(e.target.value)) })
          }
          className="text-right appearance-none"
        />
      </td>
      <td className="px-2 py-1">
        <Input
          type="number"
          min="0"
          step="0.01"
          value={line.unitPrice.toString()}
          onChange={(e) =>
            onUpdate(line.id, {
              unitPrice: Number(stripLeadingZero(e.target.value)),
            })
          }
          className="text-right appearance-none"
        />
      </td>
      <td className="px-2 py-1">
        <Select
          value={String(line.gstRate)}
          onValueChange={(v) => onUpdate(line.id, { gstRate: Number(v) })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GST_RATES.map((r) => (
              <SelectItem key={r} value={String(r)}>
                {r}%
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="px-2 py-1 text-right font-medium">
        {inr(line.qty * line.unitPrice)}
      </td>
      <td className="px-2 py-1 text-right">
        <Button
          size="icon"
          variant="ghost"
          disabled={!removable}
          onClick={() => onRemove(line.id)}
        >
          <Trash2
            className={cn(
              "h-4 w-4",
              removable ? "text-destructive" : "text-muted-foreground"
            )}
          />
        </Button>
      </td>
    </tr>
  );
}

// ─── LineItemsEditorSection ───────────────────────────────────────────────────

export function LineItemsEditorSection({
  lines,
  isLoading,
  onAddLine,
  onUpdateLine,
  onRemoveLine,
}: LineItemsEditorSectionProps) {
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <Label>Line Items</Label>
        <div className="flex items-center gap-2">
          {isLoading && (
            <span className="text-xs text-muted-foreground">Loading items…</span>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={isLoading}
            onClick={onAddLine}
          >
            <Plus className="h-4 w-4" />
            Add line
          </Button>
        </div>
      </div>
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="text-left px-2 py-2">Description</th>
              <th className="text-left px-2 py-2 w-24">HSN</th>
              <th className="text-right px-2 py-2 w-16">Qty</th>
              <th className="text-right px-2 py-2 w-24">Unit ₹</th>
              <th className="text-right px-2 py-2 w-20">GST %</th>
              <th className="text-right px-2 py-2 w-24">Total</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <EditableLineItemRow
                key={l.id}
                line={l}
                removable={lines.length > 1}
                onUpdate={onUpdateLine}
                onRemove={onRemoveLine}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
