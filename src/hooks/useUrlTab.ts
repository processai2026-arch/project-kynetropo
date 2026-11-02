import { useSearchParams } from "react-router-dom";

/**
 * A record page's open tab, kept in the address (?tab=), so Back from a row
 * opened in that tab returns to it, and a link can open a page on a tab.
 */
export function useUrlTab<T extends string>(tabs: readonly T[], fallback: T): [T, (tab: string) => void] {
  const [params, setParams] = useSearchParams();
  const current = params.get("tab");
  const tab = (tabs as readonly string[]).includes(current ?? "") ? (current as T) : fallback;
  const setTab = (t: string) => setParams((p) => { const n = new URLSearchParams(p); n.set("tab", t); return n; }, { replace: true });
  return [tab, setTab];
}
