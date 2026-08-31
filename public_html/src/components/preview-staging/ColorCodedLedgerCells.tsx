import { cn } from "@/lib/utils";

export interface ColorCodedLedgerCellsProps {
  opening: string;
  accrued: string;
  used: string;
  closing: string;
  showAccruedPrefix?: boolean;
}

export function ColorCodedLedgerCells({
  opening,
  accrued,
  used,
  closing,
  showAccruedPrefix = true,
}: ColorCodedLedgerCellsProps) {
  return (
    <>
      <td className="px-4 py-3 text-right text-sm text-card-foreground">
        {opening}
      </td>
      <td className={cn("px-4 py-3 text-right text-sm text-blue-600")}>
        {showAccruedPrefix ? `+${accrued}` : accrued}
      </td>
      <td className="px-4 py-3 text-right text-sm text-red-600">
        {used}
      </td>
      <td className="px-4 py-3 text-right text-sm font-semibold text-emerald-700">
        {closing}
      </td>
    </>
  );
}
