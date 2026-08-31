import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

interface SortIconProps {
  col: string;
  sortKey: string;
  sortDir: "asc" | "desc";
}

export function SortIcon({ col, sortKey, sortDir }: SortIconProps) {
  if (sortKey !== col) {
    return <ArrowUpDown className="h-3 w-3 text-muted-foreground/40 ml-1 inline" />;
  }
  return sortDir === "asc"
    ? <ArrowUp className="h-3 w-3 text-primary ml-1 inline" />
    : <ArrowDown className="h-3 w-3 text-primary ml-1 inline" />;
}
