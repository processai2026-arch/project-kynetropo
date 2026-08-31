import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2 } from "lucide-react";

const GST_RATES = ["0", "5", "12", "18", "28"];
const CGST_SGST_RATES = ["0", "2.5", "6", "9", "14"];

export interface LineItem {
  product_name: string;
  sku: string;
  qty: string;
  unit_price: string;
  supply_type: "interstate" | "intrastate";
  igst_rate: string;
  igst_amount: string;
  cgst_rate: string;
  cgst_amount: string;
  sgst_rate: string;
  sgst_amount: string;
  taxable_value: string;
  total: string;
  product_id?: number;
  hsn_code?: string;
  is_charge?: boolean;
}

export interface OtherChargeLineItemProps {
  line: LineItem;
  idx: number;
  onChangeField: (idx: number, field: string, val: string) => void;
  onToggleSupply: (idx: number) => void;
  onRemove: (idx: number) => void;
}

export function OtherChargeLineItem({
  line,
  idx,
  onChangeField,
  onToggleSupply,
  onRemove,
}: OtherChargeLineItemProps) {
  return (
    <div className="flex items-end gap-3">
      <div className="flex-1 space-y-1">
        <Label className="text-xs text-amber-700 font-semibold">
          Other Charge Description
        </Label>
        <Input
          value={line.product_name}
          onChange={e => onChangeField(idx, "product_name", e.target.value)}
          placeholder="e.g. Freight, Insurance…"
          className="h-8 text-xs"
        />
      </div>

      <div className="space-y-1 w-28">
        <Label className="text-xs">HSN/SAC</Label>
        <Input
          value={line.hsn_code ?? ""}
          onChange={e => onChangeField(idx, "hsn_code", e.target.value)}
          placeholder="996713"
          className="h-8 text-xs"
        />
      </div>

      <div className="space-y-1 w-28">
        <Label className="text-xs">Amount (₹)</Label>
        <Input
          type="number"
          value={line.unit_price}
          onChange={e => onChangeField(idx, "unit_price", e.target.value)}
          placeholder="0.00"
          className="h-8 text-xs"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Supply</Label>
        <button
          type="button"
          onClick={() => onToggleSupply(idx)}
          className={cn(
            "flex items-center gap-1 px-2 py-1.5 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap",
            line.supply_type === "interstate"
              ? "bg-blue-50 text-blue-700 border-blue-300"
              : "bg-orange-50 text-orange-700 border-orange-300"
          )}
        >
          {line.supply_type === "interstate" ? "IGST" : "CGST+SGST"}
        </button>
      </div>

      {line.supply_type === "interstate" ? (
        <div className="space-y-1">
          <Label className="text-xs">IGST %</Label>
          <select
            value={line.igst_rate}
            onChange={e => onChangeField(idx, "igst_rate", e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs w-20"
          >
            {GST_RATES.map(r => (
              <option key={r} value={r}>{r}%</option>
            ))}
          </select>
        </div>
      ) : (
        <>
          <div className="space-y-1">
            <Label className="text-xs">CGST %</Label>
            <select
              value={line.cgst_rate}
              onChange={e => onChangeField(idx, "cgst_rate", e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs w-16"
            >
              {CGST_SGST_RATES.map(r => (
                <option key={r} value={r}>{r}%</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">SGST %</Label>
            <select
              value={line.sgst_rate}
              onChange={e => onChangeField(idx, "sgst_rate", e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs w-16"
            >
              {CGST_SGST_RATES.map(r => (
                <option key={r} value={r}>{r}%</option>
              ))}
            </select>
          </div>
        </>
      )}

      <div className="space-y-1">
        <Label className="text-xs">Total</Label>
        <div className="h-8 flex items-center px-2 text-xs font-semibold text-amber-800 bg-amber-100 rounded-md border border-amber-200 min-w-[70px]">
          ₹{line.total || "0.00"}
        </div>
      </div>

      <div className="pb-0.5">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={() => onRemove(idx)}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}
