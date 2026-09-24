import type { LucideIcon } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface DetailTab {
  value: string;
  label: string;
  icon?: LucideIcon;
  /** Shown beside the label — how many rows the tab holds. */
  count?: number;
}

/**
 * The tab bar of a record page (mpTV-erp Operator page): a bordered strip of
 * icon + label tabs, the active one underlined in the page's primary. Pages
 * render their own content for `value`, as they did with UnderlineTabs.
 */
export function DetailTabs({
  value,
  onValueChange,
  tabs,
  ariaLabel = "Record details",
}: {
  value: string;
  onValueChange: (value: string) => void;
  tabs: DetailTab[];
  ariaLabel?: string;
}) {
  return (
    <Tabs value={value} onValueChange={onValueChange}>
      <TabsList data-detail-tabs="" aria-label={ariaLabel}
        className="flex h-12 w-full justify-start overflow-x-auto rounded-lg border bg-card p-0">
        {tabs.map(({ value: v, label, icon: Icon, count }) => (
          <TabsTrigger key={v} value={v}
            className="h-full shrink-0 gap-2 rounded-none border-b-2 border-transparent px-4 text-xs font-medium data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none">
            {Icon && <Icon className="h-4 w-4" aria-hidden />}
            {label}
            {count !== undefined && <span data-tab-count="" className="rounded-full bg-muted px-1.5 text-[0.68rem] tabular-nums">{count}</span>}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

export default DetailTabs;
