import { cn } from "@/lib/utils";

interface TwoLineCellWithMonoProps {
  primary: string;
  secondary?: string;
  className?: string;
  compact?: boolean;
  truncate?: boolean;
}

export function TwoLineCellWithMono({
  primary,
  secondary = "—",
  className,
  compact = false,
  truncate = false,
}: TwoLineCellWithMonoProps) {
  return (
    <td className={cn(compact ? "px-4 py-2" : "px-6 py-4", className)}>
      <p
        className={cn(
          "text-sm font-medium text-card-foreground",
          truncate && "truncate"
        )}
      >
        {primary}
      </p>
      <p
        className={cn(
          "text-xs text-muted-foreground font-mono",
          truncate && "truncate"
        )}
      >
        {secondary}
      </p>
    </td>
  );
}
