import { cn } from "@/lib/utils";

interface GstTotalsPanelProps {
  subtotal: number;
  isInterState: boolean;
  cgst: number;
  sgst: number;
  igst: number;
  grandTotal: number;
  inr: (n: number) => string;
  className?: string;
}

export function GstTotalsPanel({
  subtotal,
  isInterState,
  cgst,
  sgst,
  igst,
  grandTotal,
  inr,
  className,
}: GstTotalsPanelProps) {
  return (
    <div
      className={cn(
        "bg-muted/40 rounded-lg p-4 space-y-1 text-sm",
        className
      )}
    >
      <div className="flex justify-between">
        <span className="text-muted-foreground">Subtotal</span>
        <span>{inr(subtotal)}</span>
      </div>

      {isInterState ? (
        <div className="flex justify-between">
          <span className="text-muted-foreground">IGST</span>
          <span>{inr(igst)}</span>
        </div>
      ) : (
        <>
          <div className="flex justify-between">
            <span className="text-muted-foreground">CGST</span>
            <span>{inr(cgst)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">SGST</span>
            <span>{inr(sgst)}</span>
          </div>
        </>
      )}

      <div className="flex justify-between font-semibold border-t pt-2 mt-2 text-base">
        <span>Grand Total</span>
        <span>{inr(grandTotal)}</span>
      </div>

      <p className="text-xs text-muted-foreground pt-1">
        {isInterState ? "Inter-state (IGST)" : "Intra-state (CGST+SGST)"}
      </p>
    </div>
  );
}
