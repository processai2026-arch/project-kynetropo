import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ScrollableX } from "@/components/ui/scrollable-x";
import { SortableHeader } from "@/components/SortableHeader";
import { TableSkeleton } from "@/components/TableSkeleton";
import { EmptyTableRow } from "@/components/EmptyTableRow";
import { PaginationBar } from "@/components/PaginationBar";
import { RowActionsMenu } from "@/components/RowActionsMenu";
import { SearchInput } from "@/components/SearchInput";
import { Button } from "@/components/ui/button";
import { ROW_OPEN_CLASS, rowOpenProps } from "@/lib/rowNav";
import type { ListState as ServerList } from "@/hooks/useClientList";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  label: string;
  sortKey?: string;
  align?: "left" | "right" | "center";
  className?: string;
  render: (row: T) => ReactNode;
}

/**
 * The list-page register: mpTV-erp's Operators pattern — one card holding the
 * filter bar, a ScrollableX table with sortable headers, 5 skeleton rows, the
 * empty row, rows that open the record, an optional ⋮ actions column, and the
 * pager. Put it inside `RecordListPage` so `record-list.css` gives it the
 * register's row height, type scale, discs and pills.
 */
export function ListShell<T extends { id?: number | string }>({
  list,
  columns,
  searchPlaceholder,
  filters,
  rowHref,
  onRowClick,
  rowActions,
  rowLabel,
  empty = "No records found",
  itemLabel = "records",
  toolbar,
  rowClassName,
}: {
  list: ServerList<T>;
  columns: Column<T>[];
  searchPlaceholder?: string;
  filters?: ReactNode;
  rowHref?: (row: T) => string | null;
  /** For records with no page of their own: the row opens a preview instead. */
  onRowClick?: (row: T) => void;
  /** Menu items (DropdownMenuItem) for the row's ⋮ menu; null for none. */
  rowActions?: (row: T) => ReactNode;
  /** Names a row for the ⋮ button's screen-reader label. */
  rowLabel?: (row: T) => string;
  empty?: string;
  itemLabel?: string;
  toolbar?: ReactNode;
  rowClassName?: (row: T) => string | undefined;
}) {
  const navigate = useNavigate();
  const p = list.pagination;
  const colCount = columns.length + (rowActions ? 1 : 0);
  return (
    <div data-list-card="" className="bg-card rounded-xl border shadow-sm">
      {/* No strip at all for a register with nothing to filter (recent
          movements): an empty 4.6rem bar reads as a control that failed to load. */}
      {(filters || searchPlaceholder !== undefined || toolbar || list.isFiltered) && (
        <div data-list-filters="" className="p-4 border-b flex flex-wrap items-center gap-3">
          {filters}
          {searchPlaceholder !== undefined && (
            <SearchInput
              placeholder={searchPlaceholder}
              value={list.search}
              onChange={(e) => list.setSearch(e.target.value)}
              containerClassName="w-full sm:w-auto sm:min-w-[15rem] sm:flex-1"
            />
          )}
          {list.isFiltered && (
            <Button variant="ghost" size="sm" onClick={list.clearFilters}>
              Clear
            </Button>
          )}
          {toolbar && <div className="ml-auto flex items-center gap-2">{toolbar}</div>}
        </div>
      )}
      <ScrollableX>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              {columns.map((c) => (
                <SortableHeader
                  key={c.key}
                  label={c.label}
                  sortKey={c.sortKey}
                  activeSort={list.sort}
                  dir={list.dir}
                  onSort={list.toggleSort}
                  align={c.align}
                  className="whitespace-nowrap"
                />
              ))}
              {rowActions && <th data-list-actions="" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {list.initialLoading ? (
              <TableSkeleton cols={colCount} />
            ) : list.rows.length === 0 ? (
              <EmptyTableRow colSpan={colCount} message={empty} />
            ) : (
              list.rows.map((row, i) => {
                const href = rowHref?.(row);
                const actions = rowActions?.(row);
                const open = href ? () => navigate(href) : onRowClick ? () => onRowClick(row) : null;
                return (
                  <tr
                    key={String(row.id ?? i)}
                    className={cn("border-b hover:bg-muted/30 transition-colors", open && ROW_OPEN_CLASS, rowClassName?.(row), list.loading && "opacity-70")}
                    {...(open ? rowOpenProps(open) : {})}
                  >
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className={cn(
                          "py-3 px-4 text-card-foreground align-top",
                          c.align === "right" && "text-right tabular-nums",
                          c.align === "center" && "text-center",
                          c.className,
                        )}
                      >
                        {c.render(row)}
                      </td>
                    ))}
                    {rowActions && (
                      <td data-list-actions="">
                        {actions && <RowActionsMenu ariaLabel={`Actions for ${rowLabel?.(row) ?? "this row"}`}>{actions}</RowActionsMenu>}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </ScrollableX>
      {p && (
        <div className="p-4 border-t">
          <PaginationBar
            page={list.page}
            totalPages={p.total_pages}
            total={p.total}
            onPage={list.setPage}
            perPage={list.perPage}
            onPerPage={list.setPerPage}
            itemLabel={itemLabel}
            loading={list.loading}
          />
        </div>
      )}
    </div>
  );
}

export default ListShell;
