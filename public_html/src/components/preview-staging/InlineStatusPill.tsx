import { cn } from "@/lib/utils";

export interface InlineStatusPillProps {
  /** The raw status string used to look up a color class in colorMap. */
  status: string;
  /** A record mapping status values to Tailwind utility class strings. */
  colorMap: Record<string, string>;
  /** Tailwind classes applied when status is not found in colorMap. */
  fallback?: string;
}

export function InlineStatusPill({
  status,
  colorMap,
  fallback = "bg-muted text-muted-foreground",
}: InlineStatusPillProps) {
  return (
    <span
      className={cn(
        "text-xs px-2 py-1 rounded-full font-medium",
        colorMap[status] ?? fallback
      )}
    >
      {status}
    </span>
  );
}
