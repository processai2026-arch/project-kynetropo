import { cn } from "@/lib/utils";

interface StatusPillProps {
  status: string;
  colorMap: Record<string, string>;
  cancelled?: boolean;
}

export function StatusPill({
  status,
  colorMap,
  cancelled = false,
}: StatusPillProps) {
  return (
    <span
      className={cn(
        "text-xs px-2 py-1 rounded-full inline-block whitespace-nowrap",
        colorMap[status] ?? "bg-muted text-muted-foreground",
        cancelled && "line-through opacity-60"
      )}
    >
      {status}
    </span>
  );
}
