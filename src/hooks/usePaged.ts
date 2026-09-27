import { useEffect, useMemo, useState } from "react";

/** Entries per page for timelines and activity lists on detail pages. */
export const TIMELINE_PAGE_SIZE = 10;

/**
 * Client-side paging for a list that is already fully loaded, such as a
 * record's timeline. The page stays in range when the list shrinks, and goes
 * back to the start when `resetKey` changes (a different record is shown).
 *
 * `fromEnd` is for oldest-first threads with a composer underneath (a bug's
 * comments): it opens on the LAST page, and stays on the newest entries as
 * they are added, because the page is counted from the end.
 */
/**
 * The entries on page `page` (1-based, counted from the start). With
 * `fromEnd`, pages are cut from the end: the newest page is full and the
 * oldest page takes the remainder.
 */
export function slicePage<T>(items: readonly T[], page: number, pageSize: number, fromEnd = false): T[] {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const p = Math.min(Math.max(page, 1), totalPages);
  if (!fromEnd) return items.slice((p - 1) * pageSize, p * pageSize);
  const fromLast = totalPages - p + 1;
  return items.slice(Math.max(0, items.length - fromLast * pageSize), items.length - (fromLast - 1) * pageSize);
}

export function usePaged<T>(
  items: readonly T[],
  pageSize = TIMELINE_PAGE_SIZE,
  { resetKey, fromEnd = false }: { resetKey?: unknown; fromEnd?: boolean } = {},
) {
  // With fromEnd, `slot` is the page counted from the end (1 = last page).
  const [slot, setSlot] = useState(1);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => { setSlot(1); }, [resetKey]);

  const clamped = Math.min(Math.max(slot, 1), totalPages);
  useEffect(() => { if (clamped !== slot) setSlot(clamped); }, [clamped, slot]);

  const page = fromEnd ? totalPages - clamped + 1 : clamped;
  const setPage = (n: number) => setSlot(fromEnd ? totalPages - n + 1 : n);

  const pageItems = useMemo(
    () => slicePage(items, page, pageSize, fromEnd),
    [items, page, pageSize, fromEnd],
  );

  return { page, setPage, pageItems, total, totalPages };
}
