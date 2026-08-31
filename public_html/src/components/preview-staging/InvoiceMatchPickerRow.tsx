import { ExternalLink, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface MatchInvoice {
  invoice_id: number;
  invoice_number: string;
  vendor_name: string;
  total_amount: number;
  invoice_date: string;
}

export interface InvoiceMatchPickerRowProps {
  inv: MatchInvoice;
  idx: number;
  targetAmount: number;
  selectedRef: string;
  previewLoading: boolean;
  onSelect: (invoiceNumber: string) => void;
  onPreview: (invoiceId: number) => void;
}

function deriveConfidence(amount: number, target: number): number {
  if (target === 0) return amount === 0 ? 100 : 0;
  return Math.round(Math.max(0, 1 - Math.abs(amount - target) / target) * 100);
}

function chipClass(confidence: number): string {
  if (confidence === 100) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (confidence >= 85) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-muted text-muted-foreground border-border";
}

export function InvoiceMatchPickerRow({
  inv,
  targetAmount,
  selectedRef,
  previewLoading,
  onSelect,
  onPreview,
}: InvoiceMatchPickerRowProps) {
  const isSelected = selectedRef === inv.invoice_number;
  const isExact = inv.total_amount === targetAmount;
  const confidence = deriveConfidence(inv.total_amount, targetAmount);

  return (
    <div className="relative group">
      <button
        type="button"
        onClick={() => onSelect(inv.invoice_number)}
        className={cn(
          "w-full text-left px-3 py-2.5 pr-16 hover:bg-muted/50 text-sm transition-colors",
          isSelected && "bg-primary/10 border-l-2 border-primary"
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-card-foreground">{inv.invoice_number}</span>
          <span
            className={cn(
              "text-xs font-mono",
              isExact ? "text-emerald-600 font-semibold" : "text-muted-foreground"
            )}
          >
            ₹{inv.total_amount.toLocaleString("en-IN")}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground">
            {inv.vendor_name} · {inv.invoice_date}
          </span>
          <Badge
            className={cn(
              "text-[10px] px-1.5 py-0.5 font-semibold leading-none",
              chipClass(confidence)
            )}
          >
            {confidence}%
          </Badge>
        </div>
      </button>

      <button
        type="button"
        onClick={() => onPreview(inv.invoice_id)}
        disabled={previewLoading}
        className={cn(
          "absolute right-3 top-1/2 -translate-y-1/2",
          "flex items-center gap-1 text-xs text-primary hover:underline",
          "disabled:opacity-40 disabled:cursor-not-allowed"
        )}
      >
        {previewLoading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <ExternalLink className="h-3 w-3" />
        )}
        View
      </button>
    </div>
  );
}
