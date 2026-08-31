import React from "react";
import { cn } from "@/lib/utils";
import { ScrollableX } from "@/components/ui/scrollable-x";

interface NestedTableColumn {
  label: string;
  align?: "left" | "right";
}

interface NestedTableInCardProps {
  header: React.ReactNode;
  columns: NestedTableColumn[];
  children: React.ReactNode;
  minWidth?: string;
}

export function NestedTableInCard({
  header,
  columns,
  children,
  minWidth,
}: NestedTableInCardProps) {
  return (
    <div className="overflow-hidden rounded-md border bg-card shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b bg-muted/30 px-4 py-3">
        {header}
      </div>
      <ScrollableX>
        <table className={cn("w-full text-sm", minWidth ?? "min-w-[760px]")}>
          <thead className="bg-muted/20 text-left text-xs uppercase text-muted-foreground">
            <tr>
              {columns.map((col, i) => (
                <th
                  key={i}
                  className={cn(
                    "px-4 py-3 font-medium tracking-wider",
                    col.align === "right" ? "text-right" : "text-left"
                  )}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">{children}</tbody>
        </table>
      </ScrollableX>
    </div>
  );
}
