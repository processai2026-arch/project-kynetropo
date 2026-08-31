import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollableX } from "@/components/ui/scrollable-x";
import { cn } from "@/lib/utils";

export interface DetailSubTableLineItem {
  itemId: string | number;
  expenseDate: string;
  category: string;
  description: string;
  amount: number;
  receiptUrl?: string;
  policyWarning?: boolean;
  policyLimit?: number;
}

export interface DetailSubTableInDialogProps {
  items: DetailSubTableLineItem[];
  formatAmount?: (amount: number) => string;
  emptyMessage?: string;
  className?: string;
}

const defaultFormat = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export function DetailSubTableInDialog({
  items,
  formatAmount = defaultFormat,
  emptyMessage = "No line items found.",
  className,
}: DetailSubTableInDialogProps) {
  return (
    <div className={cn("border rounded-lg overflow-hidden", className)}>
      <ScrollableX>
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Date
              </th>
              <th className="text-left px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Category
              </th>
              <th className="text-left px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Description
              </th>
              <th className="text-right px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Amount
              </th>
              <th className="text-center px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Receipt
              </th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                  {emptyMessage}
                </td>
              </tr>
            )}
            {items.map((line) => (
              <tr key={line.itemId} className="border-t hover:bg-muted/30 transition-colors">
                <td className="px-3 py-2 text-card-foreground">{line.expenseDate}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    <span className="text-card-foreground">{line.category}</span>
                    {line.policyWarning && (
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    )}
                  </div>
                  {line.policyWarning && line.policyLimit !== undefined && (
                    <div className="text-xs text-amber-700">
                      Limit {formatAmount(line.policyLimit)}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-card-foreground">{line.description}</td>
                <td className="px-3 py-2 text-right font-medium text-card-foreground">
                  {formatAmount(line.amount)}
                </td>
                <td className="px-3 py-2 text-center">
                  {line.receiptUrl ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        window.open(line.receiptUrl, "_blank", "noopener,noreferrer")
                      }
                    >
                      View
                    </Button>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollableX>
    </div>
  );
}
