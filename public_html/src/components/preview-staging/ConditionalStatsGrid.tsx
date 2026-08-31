import React from "react";

/**
 * ConditionalStatsGrid
 *
 * Renders the standard 4-column stats row only after the server-side stats
 * payload has resolved. When `stats` is null or undefined — either because
 * the fetch is still in-flight or because it failed — the component returns
 * null so the rest of the page is never blocked.
 *
 * Pass StatCard elements as children; the grid handles responsive columns.
 */

interface ConditionalStatsGridProps {
  /**
   * The loaded stats object returned by the API.
   * The grid mounts only when this is truthy.
   * Pass `null` or `undefined` while loading or on error.
   */
  stats: Record<string, unknown> | null | undefined;
  /** One or more StatCard elements to display inside the grid. */
  children: React.ReactNode;
}

export function ConditionalStatsGrid({
  stats,
  children,
}: ConditionalStatsGridProps): React.ReactElement | null {
  if (!stats) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {children}
    </div>
  );
}

export default ConditionalStatsGrid;
