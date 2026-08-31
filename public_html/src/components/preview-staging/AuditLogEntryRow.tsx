import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface AuditEntry {
  id: number;
  created_at: string;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id?: number;
  new_values?: string | Record<string, unknown> | null;
  ip_address?: string;
}

export interface AuditLogEntryRowProps {
  entry: AuditEntry;
  detailsMaxLen?: number;
}

const ACTION_BADGE: Record<string, string> = {
  invoice_approved:        "bg-emerald-50 text-emerald-700 border-emerald-200",
  invoice_rejected:        "bg-red-50 text-red-600 border-red-200",
  invoice_uploaded:        "bg-blue-50 text-blue-600 border-blue-200",
  product_updated:         "bg-amber-50 text-amber-600 border-amber-200",
  damaged_stock_write_off: "bg-red-50 text-red-600 border-red-200",
};

function resolveDetails(value: string | Record<string, unknown> | null | undefined): string {
  if (value == null) return "—";
  return typeof value === "string" ? value : JSON.stringify(value);
}

export function AuditLogEntryRow({ entry, detailsMaxLen = 60 }: AuditLogEntryRowProps) {
  const fullText = resolveDetails(entry.new_values);
  const truncated =
    fullText.length > detailsMaxLen ? fullText.slice(0, detailsMaxLen) + "…" : fullText;

  return (
    <tr className="border-b hover:bg-muted/30 transition-colors">
      <td className="py-3 px-4 text-card-foreground whitespace-nowrap text-xs">
        {entry.created_at}
      </td>
      <td className="py-3 px-4 text-card-foreground font-medium">
        {entry.user_name}
      </td>
      <td className="py-3 px-4">
        <Badge
          className={cn(
            "border text-xs",
            ACTION_BADGE[entry.action] ?? "bg-gray-100 text-gray-500 border-gray-200"
          )}
        >
          {entry.action.replace(/_/g, " ")}
        </Badge>
      </td>
      <td className="py-3 px-4 text-card-foreground">
        {entry.entity_type}
        {entry.entity_id != null ? ` #${entry.entity_id}` : ""}
      </td>
      <td
        className="py-3 px-4 text-muted-foreground font-mono text-xs max-w-xs"
        title={fullText}
      >
        {truncated}
      </td>
      <td className="py-3 px-4 text-muted-foreground text-xs font-mono">
        {entry.ip_address ?? "—"}
      </td>
    </tr>
  );
}
