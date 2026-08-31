import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export interface LinkedEntityCellProps {
  /** The numeric or string ID of the linked entity. Falsy = no link. */
  entityId?: string | number | null;
  /** Raw entity type slug, e.g. "lead", "site_visit". Displayed as a capitalized badge. */
  entityType?: string | null;
  /** Human-readable name of the linked entity. */
  entityName?: string | null;
  /** Short reference code shown in monospace after the name. Omitted when equal to name. */
  entityCode?: string | null;
  /**
   * When false the entire cell renders a muted dash regardless of other props.
   * Lets parent pages conditionally hide the column without extra conditionals per row.
   */
  showLinkedTo: boolean;
  /**
   * Map from entity-type slug to Tailwind badge class string.
   * Falls back to `bg-muted text-muted-foreground` when a slug is missing.
   */
  entityTypeStyles: Record<string, string>;
}

const Dash = () => (
  <span className="text-xs text-muted-foreground select-none">—</span>
);

export function LinkedEntityCell({
  entityId,
  entityType,
  entityName,
  entityCode,
  showLinkedTo,
  entityTypeStyles,
}: LinkedEntityCellProps) {
  if (!showLinkedTo || !entityId || !entityType) {
    return (
      <td className="py-3 px-4">
        <Dash />
      </td>
    );
  }

  const badgeClass = cn(
    "border capitalize",
    entityTypeStyles[entityType] ?? "bg-muted text-muted-foreground"
  );

  const showDetail = Boolean(entityName || entityCode);
  const showCode =
    entityCode && entityCode !== entityName;

  return (
    <td className="py-3 px-4">
      <div className="min-w-0 max-w-[200px]">
        <Badge className={badgeClass}>
          {entityType.replace(/_/g, " ")}
        </Badge>

        {showDetail && (
          <p className="text-xs text-muted-foreground truncate mt-1">
            {entityName ?? ""}
            {showCode && (
              <span className="font-mono"> {entityCode}</span>
            )}
          </p>
        )}
      </div>
    </td>
  );
}

export default LinkedEntityCell;
