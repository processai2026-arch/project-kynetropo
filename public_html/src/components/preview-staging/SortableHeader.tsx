import { useState } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

export function useSortable(defaultKey: string, defaultDir: "asc" | "desc" = "desc") {
  const [sortKey, setSortKey] = useState(defaultKey);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(defaultDir);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const resetSort = () => { setSortKey(defaultKey); setSortDir(defaultDir); };
  const isDefault = sortKey === defaultKey && sortDir === defaultDir;

  return { sortKey, sortDir, handleSort, resetSort, isDefault };
}

interface SortIconProps {
  col: string;
  sortKey: string;
  sortDir: "asc" | "desc";
}

export function SortIcon({ col, sortKey, sortDir }: SortIconProps) {
  if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 text-muted-foreground/40 ml-1 inline" />;
  return sortDir === "asc"
    ? <ArrowUp className="h-3 w-3 text-primary ml-1 inline" />
    : <ArrowDown className="h-3 w-3 text-primary ml-1 inline" />;
}

interface SortableThProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  colKey: string;
  sortKey: string;
  sortDir: "asc" | "desc";
  onSort: (key: string) => void;
  children: React.ReactNode;
}

export function SortableTh({ colKey, sortKey, sortDir, onSort, children, className, ...props }: SortableThProps) {
  return (
    <th
      onClick={() => onSort(colKey)}
      className={`text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none${className ? ` ${className}` : ""}`}
      {...props}
    >
      {children}
      <SortIcon col={colKey} sortKey={sortKey} sortDir={sortDir} />
    </th>
  );
}
