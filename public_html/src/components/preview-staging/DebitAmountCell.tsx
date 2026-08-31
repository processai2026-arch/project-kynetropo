import { inr } from "@/lib/currency";

interface DebitAmountCellProps {
  /** The debit amount in rupees. Zero, null, and undefined all render as ₹0. */
  amount: number | null | undefined;
}

export function DebitAmountCell({ amount }: DebitAmountCellProps) {
  const n = amount ?? 0;
  return (
    <td className="px-4 py-3 text-right text-destructive">
      {n > 0 ? `−${inr(n)}` : inr(0)}
    </td>
  );
}

export default DebitAmountCell;
