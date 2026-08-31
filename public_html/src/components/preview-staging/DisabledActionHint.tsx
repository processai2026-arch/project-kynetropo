import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface DisabledActionHintProps {
  /** Controls whether the hint is rendered at all. */
  visible: boolean;
  /** Explanation text shown to the user. */
  message: string;
  /** Optional extra Tailwind classes applied to the root element. */
  className?: string;
}

/**
 * DisabledActionHint
 *
 * Renders a small muted caption beside a disabled button that explains
 * contextually why the action is unavailable. Returns null when not visible
 * so the caller never needs to wrap it in a conditional.
 */
export function DisabledActionHint({
  visible,
  message,
  className,
}: DisabledActionHintProps) {
  if (!visible) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs text-muted-foreground max-w-[260px] text-right leading-snug",
        className
      )}
    >
      <Info className="h-3 w-3 shrink-0 opacity-70" aria-hidden="true" />
      {message}
    </span>
  );
}

export default DisabledActionHint;
