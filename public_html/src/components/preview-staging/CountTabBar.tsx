import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Tab {
  /** Unique identifier — passed to onChange when the tab is clicked. */
  key: string;
  /** Display label shown inside the tab button. */
  label: string;
  /** Optional count rendered as "(n)" after the label. */
  count?: number;
}

export interface CountTabBarProps {
  /** Ordered list of tab descriptors. */
  tabs: Tab[];
  /** Key of the currently active tab. */
  value: string;
  /** Called with the tab's key when the user clicks a tab. */
  onChange: (key: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CountTabBar({ tabs, value, onChange }: CountTabBarProps) {
  return (
    <div className="inline-flex items-center border border-border rounded-lg overflow-hidden">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={cn(
            "px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap",
            value === tab.key
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted"
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className="ml-1 opacity-70">({tab.count})</span>
          )}
        </button>
      ))}
    </div>
  );
}

export default CountTabBar;
