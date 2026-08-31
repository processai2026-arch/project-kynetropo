import { cn } from "@/lib/utils";

interface TotalsTableRowProps {
  /** Opening balance total (days) */
  opening: number;
  /** Accrued total (days) */
  accrued: number;
  /** Taken total (days) */
  taken: number;
  /** Closing balance total (days) */
  closing: number;
  /** Optional extra className for the <tr> */
  className?: string;
}

function displayDays(value: number): string {
  return `${Number(value).toFixed(value % 1 ? 1 : 0)} d`;
}

export function TotalsTableRow({
  opening,
  accrued,
  taken,
  closing,
  className,
}: TotalsTableRowProps) {
  return (
    <tr className={cn("bg-muted/30 font-semibold", className)}>
      <td className="px-4 py-2 text-card-foreground">Totals</td>
      <td className="px-4 py-2 text-right text-card-foreground">
        {displayDays(opening)}
      </td>
      <td className="px-4 py-2 text-right text-card-foreground">
        {displayDays(accrued)}
      </td>
      <td className="px-4 py-2 text-right text-card-foreground">
        {displayDays(taken)}
      </td>
      <td className="px-4 py-2 text-right text-card-foreground">
        {displayDays(closing)}
      </td>
    </tr>
  );
}

export default TotalsTableRow;
