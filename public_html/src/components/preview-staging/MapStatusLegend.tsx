import React from "react";

export interface MapStatusEntry {
  status: string;
  color: string;
}

export interface MapStatusLegendProps {
  entries: MapStatusEntry[];
}

export function MapStatusLegend({ entries }: MapStatusLegendProps) {
  return (
    <div className="flex items-center gap-3 ml-3">
      {entries.map(({ status, color }) => (
        <span
          key={status}
          className="flex items-center gap-1 text-xs text-muted-foreground capitalize"
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            aria-hidden="true"
            focusable="false"
          >
            <circle cx="5" cy="5" r="4" fill={color} />
          </svg>
          {status.replace(/_/g, " ")}
        </span>
      ))}
    </div>
  );
}

export default MapStatusLegend;
