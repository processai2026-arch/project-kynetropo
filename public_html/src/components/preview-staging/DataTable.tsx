import { type ReactNode } from "react";
import { ScrollableX } from "@/components/ui/scrollable-x";

interface DataTableProps {
  headings: string[];
  children?: ReactNode;
  empty?: boolean;
}

export function DataTable({ headings, children, empty = false }: DataTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <ScrollableX>
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              {headings.map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left font-medium whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {empty ? (
              <tr>
                <td
                  colSpan={headings.length}
                  className="px-4 py-10 text-center text-muted-foreground"
                >
                  No records found.
                </td>
              </tr>
            ) : (
              children
            )}
          </tbody>
        </table>
      </ScrollableX>
    </div>
  );
}
