import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PAGE_SIZES } from '@/types/common';

interface PaginationBarProps {
  page: number;
  totalPages: number;
  total: number;
  onPage: (page: number) => void;
  itemLabel?: string;
  /** Rows per page. Omit both this and `onPerPage` to hide the size picker. */
  perPage?: number;
  onPerPage?: (size: number) => void;
  /** The sizes the picker offers. Defaults to the record-list set. */
  sizes?: readonly number[];
  /** Dims the controls mid-fetch without unmounting them, so the bar doesn't jump. */
  loading?: boolean;
}

/**
 * The page numbers to draw, with `null` marking a gap.
 *
 * First and last are always in the list so both ends of a long table stay one
 * click away — the reason numbered pages exist here at all is that prev/next
 * alone made "page 1 of 23" a twenty-two click journey, which is how people end
 * up exporting a whole table to find one row.
 *
 * Exported for its own test: the gap arithmetic is the only part of this file
 * that can be wrong in a way the eye would not catch.
 */
export function pageWindow(page: number, totalPages: number): (number | null)[] {
  const WINDOW_MAX = 7;
  if (totalPages <= WINDOW_MAX) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const wanted = [1, totalPages, page - 1, page, page + 1]
    .filter((p) => p >= 1 && p <= totalPages);
  const sorted = [...new Set(wanted)].sort((a, b) => a - b);

  const out: (number | null)[] = [];
  let previous = 0;
  for (const p of sorted) {
    // A gap of exactly one page is written out instead of hidden. An ellipsis
    // there would occupy the same width as the number it replaced and cost a
    // click to get past.
    if (p - previous === 2) out.push(previous + 1);
    else if (p - previous > 2) out.push(null);
    out.push(p);
    previous = p;
  }
  return out;
}

/** Page controls under a table. */
export function PaginationBar({
  page,
  totalPages,
  total,
  onPage,
  itemLabel = 'records',
  perPage,
  onPerPage,
  sizes = PAGE_SIZES,
  loading = false,
}: PaginationBarProps) {
  const showSize = perPage !== undefined && onPerPage !== undefined;
  const pages = pageWindow(page, totalPages);

  return (
    /* `data-list-pager` is how the record-list skin finds this bar. It sits on
       the component rather than on a wrapper in each page, because several
       lists render the bar bare with nothing to hang an attribute on. */
    <div data-list-pager="" className="flex flex-wrap items-center justify-between gap-3 pt-2">
      <span className="text-xs text-muted-foreground">
        {total.toLocaleString('en-IN')} {itemLabel}
      </span>

      <div className="flex flex-wrap items-center gap-3">
        {showSize && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Rows</span>
            <Select value={String(perPage)} onValueChange={(v) => onPerPage(Number(v))}>
              <SelectTrigger className="h-9 w-[4.5rem] text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sizes.map((size) => (
                  <SelectItem key={size} value={String(size)} className="text-sm">
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            aria-label="Previous page"
            disabled={loading || page <= 1}
            onClick={() => onPage(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {pages.map((p, i) => (
            p === null ? (
              // Not a button: there is no single page it could sensibly go to,
              // and a clickable "…" invites the click it cannot answer.
              <span
                key={`gap-${i}`}
                aria-hidden
                className="px-1 text-sm text-muted-foreground select-none"
              >
                …
              </span>
            ) : (
              <Button
                key={p}
                variant={p === page ? 'default' : 'outline'}
                size="icon"
                className={cn('h-9 w-9 text-sm', p === page && 'pointer-events-none')}
                aria-label={`Page ${p}`}
                aria-current={p === page ? 'page' : undefined}
                disabled={loading}
                onClick={() => onPage(p)}
              >
                {p}
              </Button>
            )
          ))}

          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            aria-label="Next page"
            disabled={loading || page >= totalPages}
            onClick={() => onPage(page + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default PaginationBar;
