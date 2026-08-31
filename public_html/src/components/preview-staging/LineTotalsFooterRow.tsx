import { Check, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface LineTotalsFooterRowProps {
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  onAddLine: () => void;
}

function money(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function LineTotalsFooterRow({
  totalDebit,
  totalCredit,
  isBalanced,
  onAddLine,
}: LineTotalsFooterRowProps) {
  return (
    <tr className="border-t bg-muted/30 font-semibold">
      <td className="px-3 py-3">
        <Button size="sm" variant="outline" onClick={onAddLine}>
          <Plus className="h-4 w-4" />
          Line
        </Button>
      </td>
      <td className="px-3 py-3 text-right text-muted-foreground">Totals</td>
      <td className={cn("px-3 py-3 text-right tabular-nums", !isBalanced && "text-destructive")}>
        {money(totalDebit)}
      </td>
      <td className={cn("px-3 py-3 text-right tabular-nums", !isBalanced && "text-destructive")}>
        {money(totalCredit)}
      </td>
      <td className="px-3 py-3">
        {isBalanced ? (
          <Check className="h-4 w-4 text-emerald-600" />
        ) : (
          <X className="h-4 w-4 text-destructive" />
        )}
      </td>
    </tr>
  );
}
