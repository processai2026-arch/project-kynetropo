import { cn } from "@/lib/utils";

export interface GstTaxBreakdownRowsProps {
  igstAmount?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  gstAmountFormatted?: string;
}

function inr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount);
}

function TaxRow({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn("flex justify-between text-sm", className)}>
      <span className="text-muted-foreground">{label}</span>
      <span className="text-card-foreground">{value}</span>
    </div>
  );
}

export function GstTaxBreakdownRows({
  igstAmount = 0,
  cgstAmount = 0,
  sgstAmount = 0,
  gstAmountFormatted = "₹0.00",
}: GstTaxBreakdownRowsProps) {
  if (igstAmount > 0) {
    return <TaxRow label="IGST" value={inr(igstAmount)} />;
  }

  if (cgstAmount > 0 || sgstAmount > 0) {
    return (
      <>
        <TaxRow label="CGST" value={inr(cgstAmount)} />
        <TaxRow label="SGST" value={inr(sgstAmount)} />
      </>
    );
  }

  return <TaxRow label="GST" value={gstAmountFormatted} />;
}
