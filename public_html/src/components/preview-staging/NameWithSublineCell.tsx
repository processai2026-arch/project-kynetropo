import React from "react";

export interface NameWithSublineCellProps {
  /** The primary bold text displayed on the first line. */
  name: string;
  /** Optional secondary text shown below the name in a smaller muted style. */
  subline?: string;
}

export function NameWithSublineCell({ name, subline }: NameWithSublineCellProps) {
  return (
    <td className="py-3 px-4">
      <div className="font-medium text-card-foreground">{name}</div>
      {subline && (
        <div className="text-xs text-muted-foreground">{subline}</div>
      )}
    </td>
  );
}

export default NameWithSublineCell;
