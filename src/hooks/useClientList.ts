import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES, type PaginationMeta, type SortDir } from "@/types/common";

/**
 * Everything a list page's register (`ListShell`) needs: the rows on screen,
 * search, filters, sorting and paging.
 *
 * Same shape as chennis-raymondshop's `useServerList`, so its `ListShell` works
 * unchanged — but this one holds the whole list in the browser, because the ops
 * endpoints return every row at once. Searching, filtering, sorting and paging
 * happen here, and `reload()` fetches the list again after a save or delete.
 */
export interface ListState<T> {
  /** The current page of rows. */
  rows: T[];
  /** Every row that passes search and filters, across all pages. */
  allRows: T[];
  /** Every row loaded, before search and filters — e.g. to build a filter's options. */
  source: T[];
  pagination: PaginationMeta | null;
  loading: boolean;
  initialLoading: boolean;
  search: string;
  setSearch: (value: string) => void;
  filters: Record<string, string>;
  setFilter: (key: string, value: string) => void;
  setFilters: (patch: Record<string, string>) => void;
  sort: string;
  dir: SortDir;
  toggleSort: (key: string) => void;
  page: number;
  setPage: (page: number) => void;
  perPage: number;
  setPerPage: (size: number) => void;
  reload: () => void;
  isFiltered: boolean;
  clearFilters: () => void;
}

export interface ClientListOptions<T> {
  /** Text the search box matches against (case-insensitive). */
  searchText?: (row: T) => Array<string | number | null | undefined>;
  /** Column sort keys → the value to sort by. */
  sorts?: Record<string, (row: T) => string | number | null | undefined>;
  defaultSort?: string;
  defaultDir?: SortDir;
  /** Filter keys → does this row pass that value? A blank value passes everything. */
  filters?: Record<string, (row: T, value: string) => boolean>;
}

const SIZE_KEY = "eco_page_size";

function storedSize(): number {
  try {
    const n = Number(localStorage.getItem(SIZE_KEY));
    return (PAGE_SIZES as readonly number[]).includes(n) ? n : DEFAULT_PAGE_SIZE;
  } catch {
    return DEFAULT_PAGE_SIZE;
  }
}

export function useClientList<T>(load: () => Promise<T[]>, options: ClientListOptions<T> = {}): ListState<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [search, setSearchState] = useState("");
  const [filters, setFilterState] = useState<Record<string, string>>({});
  const [sort, setSort] = useState(options.defaultSort ?? "");
  const [dir, setDir] = useState<SortDir>(options.defaultDir ?? "asc");
  const [page, setPage] = useState(1);
  const [perPage, setPerPageState] = useState(storedSize);

  // The loader and options are usually inline closures; keep the latest without re-fetching on every render.
  const loadRef = useRef(load);
  loadRef.current = load;
  const optsRef = useRef(options);
  optsRef.current = options;

  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    loadRef.current()
      .then((rows) => { if (alive) setData(Array.isArray(rows) ? rows : []); })
      .catch((e) => { if (alive) toast.error(e instanceof Error ? e.message : "Failed to load"); })
      .finally(() => { if (alive) { setLoading(false); setInitialLoading(false); } });
    return () => { alive = false; };
  }, [tick]);

  const allRows = useMemo(() => {
    const { searchText, filters: tests, sorts } = optsRef.current;
    const q = search.trim().toLowerCase();
    let rows = data;
    if (q && searchText) {
      rows = rows.filter((r) => searchText(r).some((v) => v !== null && v !== undefined && String(v).toLowerCase().includes(q)));
    }
    for (const [key, value] of Object.entries(filters)) {
      const test = tests?.[key];
      if (value && test) rows = rows.filter((r) => test(r, value));
    }
    const by = sort ? sorts?.[sort] : undefined;
    if (by) {
      const sign = dir === "asc" ? 1 : -1;
      rows = [...rows].sort((a, b) => {
        const x = by(a), y = by(b);
        if (x === y) return 0;
        if (x === null || x === undefined || x === "") return 1; // blanks last, either direction
        if (y === null || y === undefined || y === "") return -1;
        return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })) * sign;
      });
    }
    return rows;
  }, [data, search, filters, sort, dir]);

  const totalPages = Math.max(1, Math.ceil(allRows.length / perPage));
  const current = Math.min(page, totalPages);
  const rows = useMemo(() => allRows.slice((current - 1) * perPage, current * perPage), [allRows, current, perPage]);

  const setSearch = useCallback((value: string) => { setSearchState(value); setPage(1); }, []);
  const setFilter = useCallback((key: string, value: string) => { setFilterState((f) => ({ ...f, [key]: value })); setPage(1); }, []);
  const setFilters = useCallback((patch: Record<string, string>) => { setFilterState((f) => ({ ...f, ...patch })); setPage(1); }, []);
  const toggleSort = useCallback((key: string) => {
    setSort((prev) => {
      setDir((d) => (prev === key ? (d === "asc" ? "desc" : "asc") : "asc"));
      return key;
    });
  }, []);
  const setPerPage = useCallback((size: number) => {
    setPerPageState(size);
    setPage(1);
    try { localStorage.setItem(SIZE_KEY, String(size)); } catch { /* private mode: keep it for this page only */ }
  }, []);

  const isFiltered = search.trim() !== "" || Object.values(filters).some(Boolean);
  const clearFilters = useCallback(() => { setSearchState(""); setFilterState({}); setPage(1); }, []);

  return {
    rows,
    allRows,
    source: data,
    pagination: { page: current, per_page: perPage, total: allRows.length, total_pages: totalPages },
    loading,
    initialLoading,
    search,
    setSearch,
    filters,
    setFilter,
    setFilters,
    sort,
    dir,
    toggleSort,
    page: current,
    setPage,
    perPage,
    setPerPage,
    reload,
    isFiltered,
    clearFilters,
  };
}
