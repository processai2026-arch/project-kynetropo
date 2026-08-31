import type { LucideIcon } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ViewToggleTab {
  /** Unique key — must match the `value` prop on the corresponding TabsContent */
  value: string;
  /** Human-readable label shown in the trigger */
  label: string;
  /** Optional lucide-react icon rendered before the label */
  icon?: LucideIcon;
}

export interface ViewToggleTabsProps {
  /** Value of the tab that should be active on first render */
  defaultValue: string;
  /** Ordered list of tab definitions */
  tabs: ViewToggleTab[];
  /** One or more <TabsContent> nodes rendered below the tab bar */
  children: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Style constant — active trigger becomes a solid primary button
// ---------------------------------------------------------------------------

const TRIGGER_CLASS =
  "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ViewToggleTabs({
  defaultValue,
  tabs,
  children,
}: ViewToggleTabsProps) {
  return (
    <Tabs defaultValue={defaultValue}>
      <TabsList className="h-9 border border-border bg-muted/50 p-0.5">
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className={cn(
              TRIGGER_CLASS,
              "gap-1.5 px-3 text-sm font-medium text-muted-foreground",
            )}
          >
            {tab.icon && <tab.icon className="h-4 w-4 shrink-0" />}
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {children}
    </Tabs>
  );
}

export default ViewToggleTabs;
