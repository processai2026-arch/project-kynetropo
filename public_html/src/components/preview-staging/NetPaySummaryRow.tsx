import { inr } from "@/lib/currency";

interface NetPaySummaryRowProps {
  /** The final net pay amount in rupees. Null/undefined renders an em-dash. */
  netPay: number | null | undefined;
  /** Override the left-side label. Defaults to "Net Pay". */
  label?: string;
}

export function NetPaySummaryRow({ netPay, label = "Net Pay" }: NetPaySummaryRowProps) {
  return (
    <div className="flex items-center justify-between border-t border-border pt-3 text-base font-bold">
      <span className="text-foreground">{label}</span>
      <span className="text-primary">{inr(netPay)}</span>
    </div>
  );
}

export default NetPaySummaryRow;
