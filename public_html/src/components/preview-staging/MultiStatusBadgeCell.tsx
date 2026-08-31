import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface MultiStatusBadgeCellProps {
  status: string;
  statusColorMap: Record<string, string>;
  showSecondary?: boolean;
  secondaryLabel?: string;
}

export function MultiStatusBadgeCell({
  status,
  statusColorMap,
  showSecondary = false,
  secondaryLabel = "Converted",
}: MultiStatusBadgeCellProps) {
  return (
    <td className="px-4 py-3">
      <Badge
        variant="outline"
        className={cn(
          "capitalize border",
          statusColorMap[status] ?? "bg-muted text-muted-foreground"
        )}
      >
        {status.replace(/_/g, " ")}
      </Badge>
      {showSecondary && secondaryLabel && (
        <Badge className="ml-1 border-transparent bg-emerald-500 text-white hover:bg-emerald-500/80">
          {secondaryLabel}
        </Badge>
      )}
    </td>
  );
}
