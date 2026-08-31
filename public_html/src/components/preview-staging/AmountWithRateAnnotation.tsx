import { inrFull } from "@/lib/currency";

export interface AmountWithRateAnnotationProps {
  /** The monetary amount to format; null/undefined renders "—" */
  amount: number | null | undefined;
  /** The rate percentage to display in parentheses; annotation is omitted when null/undefined */
  rate: number | null | undefined;
}

export function AmountWithRateAnnotation({ amount, rate }: AmountWithRateAnnotationProps) {
  return (
    <span className="whitespace-nowrap">
      <span className="text-card-foreground">{inrFull(amount)}</span>
      {rate != null && (
        <span className="text-xs text-muted-foreground ml-1">({rate}%)</span>
      )}
    </span>
  );
}

export default AmountWithRateAnnotation;
