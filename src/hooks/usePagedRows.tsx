import { useMemo, useState, type ReactNode } from "react";
import { PaginationBar } from "@/components/PaginationBar";
import { rememberSize, storedSize } from "@/hooks/useClientList";

/**
 * Pages a table whose rows are already in hand: the rows on this page, and the
 * pager to draw under the table (25 / 50 / 75 / 100 / 200 a page, the size
 * remembered across every list — UI-STANDARDS §4). Nothing is drawn for an
 * empty table.
 */
export function usePagedRows<T>(all: T[], itemLabel = "records"): { rows: T[]; bar: ReactNode } {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(storedSize);
  const totalPages = Math.max(1, Math.ceil(all.length / perPage));
  // A filter that leaves fewer pages lands on the last one rather than an empty page.
  const current = Math.min(page, totalPages);
  const rows = useMemo(() => all.slice((current - 1) * perPage, current * perPage), [all, current, perPage]);
  const bar = all.length === 0 ? null : (
    <div className="border-t p-4">
      <PaginationBar
        page={current}
        totalPages={totalPages}
        total={all.length}
        onPage={setPage}
        perPage={perPage}
        onPerPage={(size) => { setPerPage(size); setPage(1); rememberSize(size); }}
        itemLabel={itemLabel}
      />
    </div>
  );
  return { rows, bar };
}
