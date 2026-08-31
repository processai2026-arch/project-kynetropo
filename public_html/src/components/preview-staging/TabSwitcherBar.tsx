import { cn } from "@/lib/utils";

export interface TabItem {
  key: string;
  label: string;
}

export interface TabSwitcherBarProps {
  tabs: TabItem[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}

export function TabSwitcherBar({ tabs, active, onChange, className }: TabSwitcherBarProps) {
  return (
    <div className={cn("flex gap-1 p-4 border-b", className)}>
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className={cn(
            "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
            active === t.key
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
