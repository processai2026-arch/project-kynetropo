import { cn } from "@/lib/utils";

export interface ReportRow {
  account_id: number;
  code: string;
  name: string;
  amount: number;
}

interface ReportRowsProps {
  rows?: ReportRow[];
  currency?: string;
  highlightNegative?: boolean;
}

function money(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function ReportRows({
  rows = [],
  currency = "MYR",
  highlightNegative = false,
}: ReportRowsProps) {
  return (
    <>
      {rows.map((row) => (
        <tr key={row.account_id} className="border-t hover:bg-muted/30 transition-colors">
          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
            {row.code}
          </td>
          <td className="px-4 py-3 text-sm text-card-foreground">
            {row.name}
          </td>
          <td
            className={cn(
              "px-4 py-3 text-right tabular-nums text-sm",
              highlightNegative && row.amount < 0
                ? "text-destructive"
                : "text-card-foreground"
            )}
          >
            {money(row.amount, currency)}
          </td>
        </tr>
      ))}
    </>
  );
}
