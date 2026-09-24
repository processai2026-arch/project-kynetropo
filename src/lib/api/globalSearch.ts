/**
 * Header search — one request across every record type.
 * Endpoint: GET /admin/search?q=...
 */
import { apiFetch } from "./client";

export interface SearchHit {
  id: number;
  title: string;
  subtitle: string;
  /** Right-aligned: a stage, a status, a date. May be empty. */
  meta: string;
  url: string;
}

export interface SearchGroup {
  label: string;
  type: string;
  items: SearchHit[];
}

/**
 * Below this the server returns nothing, because one or two characters match
 * most of the database — that is not a result, it is the whole table with the
 * useful part hidden. Mirrored here so the UI can say so rather than firing a
 * request it knows will come back empty.
 */
export const MIN_QUERY = 2;

export async function globalSearch(q: string, signal?: AbortSignal): Promise<SearchGroup[]> {
  const res = await apiFetch<{ data: { groups: SearchGroup[] } }>(
    `/admin/search?q=${encodeURIComponent(q)}`,
    // Never cached: a search is asked once and the answer changes as records are
    // edited. `signal` lets a superseded keystroke's request be dropped.
    { skipCache: true, signal },
  );
  return res.data?.groups ?? [];
}
