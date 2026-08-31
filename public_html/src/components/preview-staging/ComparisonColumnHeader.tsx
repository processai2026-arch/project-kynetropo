import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export interface ComparisonColumnHeaderProps {
  /** Entity display name — truncated at max-w-40 to prevent overflow */
  title: string;
  /** Monospaced reference code shown below the title (e.g. "PROP-2024-001") */
  code: string;
  /** Status label text rendered inside the badge */
  status: string;
  /** Tailwind classes applied to the Badge — use the project statusStyles map */
  statusClass: string;
}

export function ComparisonColumnHeader({
  title,
  code,
  status,
  statusClass,
}: ComparisonColumnHeaderProps) {
  return (
    <th className="text-left py-3 px-4 align-top">
      <p className="font-semibold text-card-foreground truncate max-w-40 leading-snug">
        {title}
      </p>
      <p className="text-xs font-mono text-muted-foreground mt-0.5 truncate max-w-40">
        {code}
      </p>
      <Badge
        className={cn(
          "border capitalize text-xs mt-1 inline-flex",
          statusClass
        )}
      >
        {status.replace(/_/g, " ")}
      </Badge>
    </th>
  );
}

export default ComparisonColumnHeader;
