import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Adopt `?q=` from the URL into a page's own search box.
 *
 * Most list pages have no per-record route — they are a table with a search
 * field — so the header search links to the page carrying the term, and the
 * page filters itself down on arrival. Without this, selecting a customer from
 * the search dropped you on an unfiltered list of every customer, which is
 * barely better than not searching.
 *
 * Keyed on location.search rather than run once, so searching for a second
 * record on a page you are already looking at still re-filters it.
 *
 * A missing or empty `q` deliberately does nothing: arriving from the sidebar
 * should not wipe what someone has already typed into the box.
 */
export function useSearchParamQuery(setSearch: (value: string) => void): void {
  const { search } = useLocation();

  useEffect(() => {
    const q = new URLSearchParams(search).get("q");
    if (q) setSearch(q);
    // setSearch is a useState setter — stable — so the URL is the only trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);
}
