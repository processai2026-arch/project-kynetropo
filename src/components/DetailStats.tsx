import type { ReactNode } from "react";

/**
 * The four figures under a record's header (mpTV-erp Operator page). Holds
 * `StatCard`s; inside `RecordDetailPage` they become flat tinted tiles — sky,
 * violet, teal, amber in order — with the icon chip leading and the number
 * above its label.
 */
export function DetailStats({ children }: { children: ReactNode }) {
  return <div data-detail-stats="" className="grid grid-cols-2 gap-4 lg:grid-cols-4">{children}</div>;
}

/**
 * Main column (tabs and their content) beside a narrower side column, the
 * Operator page's workspace. Stacks below 950px.
 */
export function DetailWorkspace({ main, side }: { main: ReactNode; side?: ReactNode }) {
  return (
    <div data-detail-workspace="" data-has-side={side ? "" : undefined}>
      <div className="min-w-0 space-y-4">{main}</div>
      {side && <aside className="min-w-0 space-y-4">{side}</aside>}
    </div>
  );
}

export default DetailStats;
