import { cn } from "@/lib/utils";

interface AuditLogRowProps {
  createdAt: string;
  action: string;
  tableName?: string | null;
  userName?: string | null;
  userId?: number | null;
}

export function AuditLogRow({
  createdAt,
  action,
  tableName,
  userName,
  userId,
}: AuditLogRowProps) {
  return (
    <tr className="border-b hover:bg-muted/30 transition-colors">
      <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
        {createdAt}
      </td>
      <td className="py-3 px-4 text-card-foreground capitalize">
        {action?.replace(/_/g, " ")}
      </td>
      <td className={cn("py-3 px-4 text-muted-foreground")}>
        {tableName ?? "—"}
      </td>
      <td className="py-3 px-4 text-muted-foreground">
        {userName ?? userId ?? "—"}
      </td>
    </tr>
  );
}
