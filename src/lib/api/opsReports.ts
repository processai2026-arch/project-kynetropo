import { apiFetch } from "@/lib/api/client";

/**
 * The client-and-project report catalogue, served from /admin/ops/reports.
 *
 * Deliberately separate from lib/api/reports.ts, which drives the manufacturing
 * module's /admin/reports endpoint. The two answer different questions from
 * different tables and only happen to share the word.
 */

/** How a value should be read, so the viewer and the export agree on it. */
export type ReportColumnType = "text" | "number" | "money" | "date" | "datetime" | "badge";

export interface ReportColumn {
  key: string;
  label: string;
  type: ReportColumnType;
}

/** A report as the catalogue describes it, without any rows. */
export interface ReportSummary {
  id: string;
  title: string;
  category: string;
  description: string;
  columns: ReportColumn[];
  /** False for a current-state report, where a From/To range means nothing. */
  has_dates: boolean;
}

export interface ReportResult {
  report: ReportSummary;
  rows: Record<string, unknown>[];
  row_count: number;
  /** True when the row limit cut the result short, so the page can say so. */
  truncated: boolean;
  range: { from: string | null; to: string | null };
}

const qs = (p?: Record<string, string | undefined>) => {
  if (!p) return "";
  const parts = Object.entries(p).filter(([, v]) => v !== undefined && v !== "");
  return parts.length ? `?${new URLSearchParams(parts as [string, string][])}` : "";
};

export const opsReportsApi = {
  /** Every report this system can run. */
  catalogue: () => apiFetch<{ data: { reports: ReportSummary[] } }>("/admin/ops/reports"),

  /** One report's rows. The id must be one the catalogue listed. */
  run: (id: string, params?: { from?: string; to?: string; limit?: number }) =>
    apiFetch<{ data: ReportResult }>(
      `/admin/ops/reports/${id}${qs({
        from: params?.from,
        to: params?.to,
        limit: params?.limit ? String(params.limit) : undefined,
      })}`,
    ),
};
