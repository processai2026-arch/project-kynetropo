import { Sparkles } from "lucide-react";
import { inr } from "@/lib/currency";

export interface AutoEstimateHintProps {
  /** The system-computed estimate (rupees). Pass 0 or undefined to suppress. */
  autoAmount: number | null | undefined;
  /**
   * The user's manual override value bound to the input above this hint.
   * When truthy (non-zero, non-empty), the hint is hidden — the user has
   * already entered their own value.
   */
  overrideValue?: number | string | null;
}

/**
 * AutoEstimateHint
 *
 * Renders a single helper line directly below a numeric input whenever an
 * auto-computed estimate is available but no manual override has been typed.
 * Disappears the moment the user enters their own value.
 */
export function AutoEstimateHint({ autoAmount, overrideValue }: AutoEstimateHintProps) {
  const hasEstimate = autoAmount != null && autoAmount > 0;
  const hasOverride =
    overrideValue !== null &&
    overrideValue !== undefined &&
    overrideValue !== "" &&
    Number(overrideValue) !== 0;

  if (!hasEstimate || hasOverride) return null;

  return (
    <p className="flex items-center gap-1 text-xs text-primary font-medium mt-1">
      <Sparkles className="h-3 w-3 shrink-0" />
      Est: {inr(autoAmount)}
    </p>
  );
}

export default AutoEstimateHint;
