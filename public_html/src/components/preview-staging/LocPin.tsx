import { MapPin } from "lucide-react";

// ── Relative-time helper ─────────────────────────────────────────────────────

/**
 * Returns a short human-readable string such as "just now", "3m ago", "2h ago"
 * given an ISO-8601 datetime string.  Returns an empty string on bad input.
 */
function relAgo(iso?: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  if (isNaN(diff)) return "";
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

// ── Props ────────────────────────────────────────────────────────────────────

export interface LocPinProps {
  /** Latitude of the location (decimal degrees). Renders nothing when null/undefined. */
  lat?: number | null;
  /** Longitude of the location (decimal degrees). Renders nothing when null/undefined. */
  lng?: number | null;
  /** Tooltip text shown on hover. Defaults to the coordinate pair. */
  title?: string | null;
  /**
   * When true the link renders as a live agent-trail indicator (emerald colour,
   * "Live · Xm ago" label). When false/omitted it renders as a static punch
   * location (primary colour, "Map" label).
   */
  live?: boolean;
  /** ISO-8601 timestamp of the last location update – shown as relative time
   *  when `live` is true. */
  seenAt?: string | null;
}

// ── Component ────────────────────────────────────────────────────────────────

export function LocPin({ lat, lng, title, live = false, seenAt }: LocPinProps) {
  if (lat == null || lng == null) return null;

  const label = live
    ? `Live${seenAt ? ` · ${relAgo(seenAt)}` : ""}`
    : "Map";

  return (
    <a
      href={`https://www.google.com/maps?q=${lat},${lng}`}
      target="_blank"
      rel="noreferrer"
      title={title ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`}
      className={`inline-flex items-center gap-0.5 text-xs mt-0.5 hover:underline ${
        live ? "text-emerald-600" : "text-primary"
      }`}
    >
      <MapPin className="h-3 w-3 shrink-0" />
      {label}
    </a>
  );
}

export default LocPin;
