import { cn } from "@/lib/utils";

interface TruncatedCellWithNativeTooltipProps {
  value: string | null | undefined;
  maxWidth?: string;
  fallback?: string;
}

export function TruncatedCellWithNativeTooltip({
  value,
  maxWidth = "max-w-[180px]",
  fallback = "—",
}: TruncatedCellWithNativeTooltipProps) {
  const display = value ?? fallback;
  const titleAttr = value ?? "";

  return (
    <td
      className={cn("py-3 px-4 text-muted-foreground truncate", maxWidth)}
      title={titleAttr}
    >
      {display}
    </td>
  );
}
