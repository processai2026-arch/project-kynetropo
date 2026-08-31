import { cn } from "@/lib/utils";

interface GstTaxBreakdownSummaryProps {
  subtotal: number;
  igst: number;
  cgst: number;
  sgst: number;
  tax: number;
  total: number;
  fmt: (n: number) => string;
  className?: string;
}

export function GstTaxBreakdownSummary({
  subtotal,
  igst,
  cgst,
  sgst,
  tax,
  total,
  fmt,
  className,
}: GstTaxBreakdownSummaryProps) {
  return (
    <div className={cn("bg-muted/20 border rounded-xl p-4 space-y-2", className)}>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Subtotal (Taxable)</span>
        <span className="font-medium">{fmt(subtotal)}</span>
      </div>

      {igst > 0 && (
        <div className="flex justify-between text-sm text-blue-600">
          <span>IGST</span>
          <span>{fmt(igst)}</span>
        </div>
      )}

      {cgst > 0 && (
        <div className="flex justify-between text-sm text-orange-600">
          <span>CGST</span>
          <span>{fmt(cgst)}</span>
        </div>
      )}

      {sgst > 0 && (
        <div className="flex justify-between text-sm text-orange-600">
          <span>SGST</span>
          <span>{fmt(sgst)}</span>
        </div>
      )}

      <div className="flex justify-between text-sm font-semibold border-t pt-2 mt-2">
        <span>Total Input Tax (ITC)</span>
        <span className="text-emerald-600">{fmt(tax)}</span>
      </div>

      <div className="flex justify-between text-base font-bold">
        <span>Invoice Total</span>
        <span>{fmt(total)}</span>
      </div>
    </div>
  );
}
