import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  PAGE_SIZES, pageNumbers, pageSlice, setPageSize, usePageSize, type PageSize,
} from "@/lib/pageSize";

/**
 * Paging for a list, in one hook and one component.
 *
 * Most pages here loaded every row and rendered the lot. That is fine at two
 * hundred and unusable at two thousand: the browser lays out every row, every
 * filter keystroke re-renders every row, and there is no way to say "show me
 * the next hundred".
 *
 * Client-side, deliberately. Twenty of the list endpoints already accept
 * page/limit and twelve or so do not, so server paging would mean a different
 * shape of code on different pages and a backend change per endpoint before
 * any of it worked. Slicing what the page already holds gives every list the
 * same control today; an endpoint can move to server paging later without the
 * component changing, because it only ever sees an array.
 */
export function usePagedRows<T>(rows: T[]) {
  const size = usePageSize();
  const [page, setPage] = useState(1);

  // Filtering down to fewer pages while sitting on page 6 would leave an empty
  // table and no clue why. Snapping back to the last real page is the only
  // answer that shows rows.
  const slice = useMemo(() => pageSlice(rows, page, size), [rows, page, size]);
  useEffect(() => {
    if (slice.page !== page) setPage(slice.page);
  }, [slice.page, page]);

  return { ...slice, size, setPage };
}

export interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  from: number;
  to: number;
  onPage: (page: number) => void;
  /** What the rows are, for the count: "of 214 invoices". */
  noun?: string;
  className?: string;
}

export function Pagination({
  page, totalPages, total, from, to, onPage, noun = "rows", className,
}: PaginationProps) {
  const size = usePageSize();

  // Nothing to page through and the default row count still selected: the
  // control would be three dead buttons and a dropdown nobody needs.
  if (total === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm",
        className,
      )}
    >
      <p className="text-muted-foreground">
        {/* The range, not just the page number: "26–50 of 214" answers "how far
            through am I" without arithmetic. */}
        Showing <span className="font-medium text-foreground eco-nums">{from}–{to}</span>
        {" of "}
        <span className="font-medium text-foreground eco-nums">{total}</span> {noun}
      </p>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground whitespace-nowrap">Rows</span>
          <Select
            value={String(size)}
            onValueChange={(v) => {
              setPageSize(Number(v) as PageSize);
              // Back to the first page: row 26 is on a different page at 50 a
              // page than at 25, so holding the page number would jump you
              // somewhere you did not ask to go.
              onPage(1);
            }}
          >
            <SelectTrigger className="h-8 w-[4.5rem]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((n) => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <Button
              variant="outline" size="icon" className="h-8 w-8"
              onClick={() => onPage(page - 1)}
              disabled={page <= 1}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {pageNumbers(page, totalPages).map((n, i) =>
              n === "gap" ? (
                <span key={`gap-${i}`} className="px-1 text-muted-foreground">…</span>
              ) : (
                <Button
                  key={n}
                  variant={n === page ? "default" : "outline"}
                  size="icon"
                  className="h-8 w-8 eco-nums"
                  onClick={() => onPage(n)}
                  aria-label={`Page ${n}`}
                  aria-current={n === page ? "page" : undefined}
                >
                  {n}
                </Button>
              ),
            )}

            <Button
              variant="outline" size="icon" className="h-8 w-8"
              onClick={() => onPage(page + 1)}
              disabled={page >= totalPages}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
