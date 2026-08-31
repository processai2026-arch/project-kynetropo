import { inr } from "@/lib/currency";

interface IncentiveCellProps {
  amount: number;
  deals?: number;
  visits?: number;
}

export function IncentiveCell({ amount, deals = 0, visits = 0 }: IncentiveCellProps) {
  return (
    <td className="px-4 py-3 text-right text-emerald-600 font-medium">
      {inr(amount)}
      {amount > 0 && (
        <div className="text-xs text-muted-foreground font-normal mt-0.5">
          {deals} deal{deals !== 1 ? "s" : ""} · {visits} visit{visits !== 1 ? "s" : ""}
        </div>
      )}
    </td>
  );
}

export default IncentiveCell;
