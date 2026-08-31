import type { FC } from "react";
import { cn } from "@/lib/utils";
import { inr } from "@/lib/currency";

export interface SuggestedValueHintProps {
  /** Label for the primary suggested value (e.g. "Circle Rate") */
  label: string;
  /** Primary monetary value in rupees */
  value: number;
  /** ISO date string — rendered as "as of DD MMM YYYY" */
  asOfDate?: string;
  /** Label for the secondary comparison value (e.g. "Listed Price") */
  secondaryLabel?: string;
  /** Secondary monetary value in rupees — only rendered when secondaryLabel is provided */
  secondaryValue?: number;
  /** Additional Tailwind classes forwarded to the root element */
  className?: string;
}

/**
 * SuggestedValueHint
 *
 * Emerald pill paragraph rendered below a select or price field to surface
 * a system-computed suggested monetary value alongside a comparison figure.
 *
 * Both values are formatted via the shared `inr()` utility (compact Indian
 * notation: ₹45.00L, ₹1.20Cr, etc.).
 */
export const SuggestedValueHint: FC<SuggestedValueHintProps> = ({
  label,
  value,
  asOfDate,
  secondaryLabel,
  secondaryValue,
  className,
}) => {
  const dateStr = asOfDate
    ? new Date(asOfDate).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    <p
      className={cn(
        'text-xs bg-emerald-50 text-emerald-700 border border-emerald-200',
        'rounded-md px-2.5 py-1.5 leading-relaxed',
        className,
      )}
    >
      <span className="font-medium">{label}:</span>{' '}
      {inr(value)}
      {dateStr && (
        <span className="text-emerald-600"> (as of {dateStr})</span>
      )}
      {secondaryLabel != null && secondaryValue != null && (
        <>
          {' — '}
          <span className="font-medium">{secondaryLabel}:</span>{' '}
          {inr(secondaryValue)}
        </>
      )}
    </p>
  );
};

export default SuggestedValueHint;
