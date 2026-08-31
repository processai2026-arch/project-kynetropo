import { inr } from "@/lib/currency";

interface CurrencyPreviewTextProps {
  /** Numeric value (or numeric string) coming from a controlled input. */
  value?: number | string | null;
}

/**
 * CurrencyPreviewText
 *
 * Renders a one-line muted hint below a numeric input showing the entered
 * amount formatted as Indian rupees.  Returns null (renders nothing) when the
 * value is zero, empty, null, or not a finite number.
 *
 * Uses the shared `inr()` utility so large real-estate figures are shown as
 * compact human-readable strings (e.g. ₹1.50Cr, ₹25L) rather than the raw
 * comma-separated integer.
 */
export function CurrencyPreviewText({ value }: CurrencyPreviewTextProps) {
  const num = Number(value);
  if (value == null || value === '' || !isFinite(num) || num === 0) {
    return null;
  }

  return (
    <p className="mt-1 text-xs text-muted-foreground">
      {inr(num)}
    </p>
  );
}

export default CurrencyPreviewText;
