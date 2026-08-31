import { cn } from "@/lib/utils";

export interface SegmentedTab {
  key: string;
  label: string;
  count?: number;
}

export interface SegmentedTabBarProps {
  tabs: SegmentedTab[];
  value: string;
  onChange: (key: string) => void;
  className?: string;
}

export function SegmentedTabBar({
  tabs,
  value,
  onChange,
  className,
}: SegmentedTabBarProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center border border-border rounded-lg overflow-hidden bg-card",
        className
      )}
    >
      {tabs.map((tab, index) => {
        const isActive = value === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              index > 0 && "border-l border-border",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {tab.label}
            {tab.count != null && (
              <span className={cn("ml-1", isActive ? "opacity-80" : "opacity-60")}>
                ({tab.count})
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedTabBar;
