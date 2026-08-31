import type { FC } from "react";

interface LeaveBalanceColumnsProps {
  accrued: number;
  used: number;
  available: number;
}

function displayDays(value: number): string {
  return `${Number(value).toFixed(value % 1 ? 1 : 0)} d`;
}

export const LeaveBalanceColumns: FC<LeaveBalanceColumnsProps> = ({
  accrued,
  used,
  available,
}) => (
  <>
    <td className="px-4 py-3 text-right text-blue-600">
      +{displayDays(accrued)}
    </td>
    <td className="px-4 py-3 text-right text-red-600">
      {displayDays(used)}
    </td>
    <td className="px-4 py-3 text-right font-semibold text-emerald-700">
      {displayDays(available)}
    </td>
  </>
);

export default LeaveBalanceColumns;
