import { cn } from "@/lib/utils";

interface UnderlineTabBarProps {
  tabs: readonly string[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function UnderlineTabBar({ tabs, activeTab, onTabChange }: UnderlineTabBarProps) {
  return (
    <div className="flex gap-0 border-b overflow-x-auto">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onTabChange(tab)}
          className={cn(
            "px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
            activeTab === tab
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
