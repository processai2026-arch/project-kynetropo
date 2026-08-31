import React from "react";

interface TruncatedTextCellProps {
  /** The text to display. Falls back to a dash when falsy. */
  text?: string | null;
}

export function TruncatedTextCell({ text }: TruncatedTextCellProps) {
  return (
    <td
      className="px-4 py-3 text-muted-foreground max-w-sm truncate"
      title={text ?? undefined}
    >
      {text || "-"}
    </td>
  );
}

export default TruncatedTextCell;
