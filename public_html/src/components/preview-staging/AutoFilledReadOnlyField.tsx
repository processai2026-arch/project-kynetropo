import { cn } from "@/lib/utils";

interface AutoFilledReadOnlyFieldProps {
  /** The auto-populated value to display. Renders "Loading…" when undefined. */
  value?: string;
  /** Short label pinned to the right, e.g. "from Lead" or "from Buyer". */
  sourceLabel: string;
  /** Optional extra Tailwind classes forwarded to the outer div. */
  className?: string;
}

export function AutoFilledReadOnlyField({
  value,
  sourceLabel,
  className,
}: AutoFilledReadOnlyFieldProps) {
  return (
    <div
      className={cn(
        "flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 py-2 text-sm text-card-foreground",
        className
      )}
    >
      <span className="truncate">{value ?? "Loading…"}</span>
      <span className="ml-auto shrink-0 pl-2 text-xs text-muted-foreground">
        {sourceLabel}
      </span>
    </div>
  );
}

export default AutoFilledReadOnlyField;
