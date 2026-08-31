import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BuyerContextRow {
  /** Short label displayed on the left side of each row */
  label: string;
  /** Value displayed on the right — accepts a string or any ReactNode (e.g. a Badge) */
  value: ReactNode;
}

export interface BuyerContextCardProps {
  /** "sold" → green tint; "reserved" → amber tint */
  variant: "sold" | "reserved";
  /** Card heading text */
  title: string;
  /** Icon rendered next to the heading — pass a lucide element sized h-4 w-4 */
  icon?: ReactNode;
  /** Ordered array of label/value rows to display */
  rows: BuyerContextRow[];
  /** Text for the navigable deal link; omit the prop to hide the link entirely */
  linkLabel?: string;
  /** Called when the deal link button is clicked */
  onLinkClick?: () => void;
}

// ─── Variant token map ────────────────────────────────────────────────────────

const variantStyles = {
  sold: {
    card:    "bg-emerald-50/60 border-emerald-200",
    heading: "text-emerald-800",
    label:   "text-emerald-700/80",
    value:   "text-emerald-800",
    link:    "text-emerald-700 hover:text-emerald-900",
  },
  reserved: {
    card:    "bg-amber-50/60 border-amber-200",
    heading: "text-amber-800",
    label:   "text-amber-700/80",
    value:   "text-amber-800",
    link:    "text-amber-700 hover:text-amber-900",
  },
} as const;

// ─── Component ────────────────────────────────────────────────────────────────

export function BuyerContextCard({
  variant,
  title,
  icon,
  rows,
  linkLabel,
  onLinkClick,
}: BuyerContextCardProps) {
  const s = variantStyles[variant];

  return (
    <div className={cn("rounded-xl shadow-sm p-5 border", s.card)}>

      {/* Heading */}
      <h2 className={cn("text-base font-semibold mb-3 flex items-center gap-2", s.heading)}>
        {icon}
        {title}
      </h2>

      {/* Rows */}
      <div className="space-y-2 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-4">
            <span className={s.label}>{row.label}</span>
            <span className={cn("font-semibold text-right", s.value)}>
              {row.value}
            </span>
          </div>
        ))}
      </div>

      {/* Deal link — only rendered when both label and handler are provided */}
      {linkLabel && onLinkClick && (
        <button
          type="button"
          className={cn(
            "mt-3 text-xs inline-flex items-center gap-1 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded",
            s.link
          )}
          onClick={onLinkClick}
        >
          {linkLabel}
          <ExternalLink className="h-3 w-3" />
        </button>
      )}

    </div>
  );
}

export default BuyerContextCard;
