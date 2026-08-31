import React from "react";

interface EmployeeNameCellProps {
  /** Employee's display name rendered as a clickable button. */
  name: string;
  /** Employee ID shown below the name in muted caption text. */
  empId: string;
  /** Callback fired when the name button is clicked. */
  onClick: () => void;
  /** Optional tooltip text shown via the native title attribute. */
  actionLabel?: string;
}

export function EmployeeNameCell({
  name,
  empId,
  onClick,
  actionLabel,
}: EmployeeNameCellProps) {
  return (
    <td className="px-4 py-3">
      <button
        type="button"
        className="font-medium text-primary hover:underline text-left leading-snug truncate max-w-[180px] block"
        onClick={onClick}
        title={actionLabel}
      >
        {name}
      </button>
      <div className="text-xs text-muted-foreground mt-0.5">{empId}</div>
    </td>
  );
}

export default EmployeeNameCell;
