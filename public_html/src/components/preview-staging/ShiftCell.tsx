import React from "react";

interface ShiftCellProps {
  shiftName?: string | null;
  startTime?: string | null;
  endTime?: string | null;
}

export function ShiftCell({ shiftName, startTime, endTime }: ShiftCellProps) {
  const hasTimeRange = Boolean(startTime && endTime);

  return (
    <td className="px-4 py-3">
      <div className="text-sm text-card-foreground truncate">
        {shiftName ?? "—"}
      </div>
      {hasTimeRange && (
        <div className="text-xs text-muted-foreground mt-0.5">
          {startTime}–{endTime}
        </div>
      )}
    </td>
  );
}

export default ShiftCell;
