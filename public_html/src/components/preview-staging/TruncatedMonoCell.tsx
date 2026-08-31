import { cn } from "@/lib/utils";

interface TruncatedMonoCellProps {
  value: string | Record<string, unknown> | null | undefined;
  maxLen?: number;
  className?: string;
}

export function TruncatedMonoCell({
  value,
  maxLen = 60,
  className,
}: TruncatedMonoCellProps) {
  const str =
    value === null || value === undefined
      ? ""
      : typeof value === "string"
      ? value
      : JSON.stringify(value);

  const display = str.length > maxLen ? str.slice(0, maxLen) + "…" : str;

  return (
    <td
      className={cn(
        "py-3 px-4 text-muted-foreground font-mono text-xs max-w-xs truncate",
        className
      )}
      title={str}
    >
      {display}
    </td>
  );
}
