import { cn } from "@/lib/utils";

export interface InlinePillProps {
  /** The status value to display and use as the color map key. */
  status: string;
  /** Maps each status string to one or more Tailwind color utility classes. */
  statusColorMap: Record<string, string>;
  /** Optional extra classes merged via cn(). */
  className?: string;
}

/**
 * Borderless rounded-full pill for status display.
 * Use instead of <Badge> when no border is wanted.
 * Color is driven entirely by the caller-supplied statusColorMap.
 * Falls back to bg-muted / text-muted-foreground for unknown keys.
 */
export function InlinePill({ status, statusColorMap, className }: InlinePillProps) {
  const colorClass = statusColorMap[status] ?? "bg-muted text-muted-foreground";

  return (
    <span
      className={cn(
        "inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap",
        colorClass,
        className
      )}
    >
      {status}
    </span>
  );
}

export default InlinePill;
