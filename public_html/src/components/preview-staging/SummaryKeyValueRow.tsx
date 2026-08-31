import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SummaryKeyValueRowProps {
  /** Muted label displayed on the left side of the row */
  label: string;
  /** Value displayed on the right — accepts a string, number, or any ReactNode (e.g. a Badge) */
  value: ReactNode;
  /** When true, renders the value in monospace font — useful for amounts, IDs, phone numbers */
  mono?: boolean;
}

export function SummaryKeyValueRow({ label, value, mono = false }: SummaryKeyValueRowProps) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span
        className={cn(
          "text-sm text-card-foreground text-right",
          mono && "font-mono"
        )}
      >
        {value}
      </span>
    </div>
  );
}

export default SummaryKeyValueRow;
