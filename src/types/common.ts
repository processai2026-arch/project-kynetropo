/** Types shared by list pages, tables and the pager (ported from the chennis-raymondshop kit). */

export type SortDir = "asc" | "desc";

/** The pager's view of a list, whether it was paged by the API or in the browser. */
export interface PaginationMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

/** Rows-per-page choices for record lists. */
export const PAGE_SIZES = [25, 50, 75, 100, 200] as const;
export const DEFAULT_PAGE_SIZE = 25;

/** Rows-per-page choices for the small tables inside cards. */
export const CARD_PAGE_SIZES = [5, 10, 25] as const;
export const DEFAULT_CARD_PAGE_SIZE = 5;
