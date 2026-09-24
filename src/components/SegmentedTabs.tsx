import { cn } from "@/lib/utils";

/**
 * The one segmented switch.
 *
 * Five of these had grown across the app with three different active states —
 * a white pill on grey in User Management, a blue fill on Reports, a bordered
 * row on Hubs — so the same control looked like three different controls
 * depending on which page you were on, and on User Management the selected tab
 * read as barely selected at all: white-on-grey is a shadow's worth of
 * difference, which disappears entirely on a laptop screen at an angle.
 *
 * The active tab now takes the brand fill everywhere. That is the same signal
 * the sidebar gives its open item and the tab strip gives its open page, so
 * "this is the one you are looking at" means one thing across the whole app.
 *
 * Decorative, not semantic: a switch between two views is not good or bad. Where
 * a choice does carry meaning — the recharge follow-up's done / not-done, where
 * not-done is a problem worth chasing — that one keeps its own colours and does
 * not come through here.
 */
export interface SegmentedTab<T extends string> {
  value: T;
  label: string;
  /** Optional count shown after the label, e.g. a row total. */
  count?: number;
}

export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
  size = "md",
  className,
}: {
  tabs: ReadonlyArray<SegmentedTab<T>>;
  value: T;
  onChange: (value: T) => void;
  /** `sm` for a switch sitting inside a card header. */
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    // A tinted trough behind the row, so the unselected tabs read as one
    // control rather than as loose buttons floating on the page.
    <div
      role="tablist"
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-lg bg-muted p-1",
        className,
      )}
    >
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={cn(
              "rounded-md font-medium transition-colors",
              size === "sm" ? "px-3 py-1 text-xs" : "px-4 py-1.5 text-sm",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-card/70 hover:text-foreground",
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn(
                  "ml-1.5 tabular-nums",
                  active ? "text-primary-foreground/75" : "text-muted-foreground/70",
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
