import React from "react";

interface TitleWithSubtextCellProps {
  title: string;
  subtitle?: string;
}

export function TitleWithSubtextCell({ title, subtitle }: TitleWithSubtextCellProps) {
  return (
    <td className="py-3 px-4">
      <p className="font-medium text-card-foreground line-clamp-1">{title}</p>
      {subtitle && (
        <p className="text-xs text-muted-foreground line-clamp-1">{subtitle}</p>
      )}
    </td>
  );
}

export default TitleWithSubtextCell;
