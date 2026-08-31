import { ChevronDown, ChevronRight, Folder } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ── Default maps — matches the real-estate entity types used in Documents.tsx ─

const DEFAULT_ENTITY_TYPE_STYLES: Record<string, string> = {
  property:   "bg-sky-50 text-sky-700 border-sky-200",
  land_owner: "bg-violet-50 text-violet-700 border-violet-200",
  buyer:      "bg-teal-50 text-teal-700 border-teal-200",
  lead:       "bg-orange-50 text-orange-700 border-orange-200",
  payment:    "bg-cyan-50 text-cyan-700 border-cyan-200",
  general:    "bg-gray-100 text-gray-600 border-gray-200",
};

const DEFAULT_ENTITY_TYPE_LABELS: Record<string, string> = {
  property:   "Property",
  land_owner: "Land Owner",
  buyer:      "Buyer",
  lead:       "Lead",
  payment:    "Receipt",
  general:    "General",
};

// ── Props ─────────────────────────────────────────────────────────────────────

export interface CollapsibleFolderRowProps {
  /** Whether the folder is currently expanded */
  isOpen: boolean;
  /** Entity type key (property | land_owner | buyer | lead | payment | general) */
  entityType: string;
  /** Display name of the linked entity */
  entityName: string;
  /** Short code / reference number shown in monospace (omitted when equal to entityName) */
  entityCode?: string;
  /** Owner name shown as "· Owner: X" (omitted when empty) */
  ownerName?: string;
  /** Number of documents inside this folder */
  docCount: number;
  /** colSpan applied to the single <td> — must match the table column count */
  colSpan: number;
  /** Called when the row is clicked to toggle open/closed */
  onToggle: () => void;
  /** Override the Tailwind badge-class map (default: built-in real-estate types) */
  entityTypeStyles?: Record<string, string>;
  /** Override the display-label map (default: built-in real-estate labels) */
  entityTypeLabels?: Record<string, string>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CollapsibleFolderRow({
  isOpen,
  entityType,
  entityName,
  entityCode,
  ownerName,
  docCount,
  colSpan,
  onToggle,
  entityTypeStyles = DEFAULT_ENTITY_TYPE_STYLES,
  entityTypeLabels  = DEFAULT_ENTITY_TYPE_LABELS,
}: CollapsibleFolderRowProps) {
  const badgeClass = entityTypeStyles[entityType] ?? "bg-muted text-muted-foreground";
  const label      = entityTypeLabels[entityType]  ?? entityType.replace(/_/g, " ");

  return (
    <tr
      className="border-b bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer"
      onClick={onToggle}
    >
      <td colSpan={colSpan} className="py-3 px-4">
        <div className="flex items-center gap-2.5">
          {isOpen
            ? <ChevronDown  className="h-4 w-4 text-muted-foreground shrink-0" />
            : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}

          <Folder className="h-4 w-4 text-primary shrink-0" />

          <Badge className={cn("border capitalize shrink-0", badgeClass)}>
            {label}
          </Badge>

          <span className="font-medium text-card-foreground truncate">
            {entityName}
          </span>

          {entityCode && entityCode !== entityName && (
            <span className="text-xs font-mono text-muted-foreground shrink-0">
              {entityCode}
            </span>
          )}

          {ownerName && (
            <span className="text-xs text-muted-foreground shrink-0">
              · Owner: {ownerName}
            </span>
          )}

          <span className="ml-auto text-xs text-muted-foreground shrink-0 pr-1">
            {docCount} document{docCount !== 1 ? "s" : ""}
          </span>
        </div>
      </td>
    </tr>
  );
}

export default CollapsibleFolderRow;
