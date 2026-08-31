import { cn } from "@/lib/utils";

interface UnderlineTabsProps {
  tabs: readonly string[];
  active: string;
  onChange: (tab: string) => void;
}

export function UnderlineTabs({ tabs, active, onChange }: UnderlineTabsProps) {
  return (
    <div className="flex gap-1 border-b">
      {tabs.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
            active === t
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
