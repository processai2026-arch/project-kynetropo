import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export interface DialogTab {
  key: string;
  label: string;
  icon?: LucideIcon;
}

export interface DialogUnderlineTabsProps {
  tabs: DialogTab[];
  active: string;
  onChange: (key: string) => void;
}

export function DialogUnderlineTabs({
  tabs,
  active,
  onChange,
}: DialogUnderlineTabsProps) {
  return (
    <div className="flex border-b">
      {tabs.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={cn(
            "inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors",
            active === key
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {Icon && <Icon className="h-3.5 w-3.5" />}
          {label}
        </button>
      ))}
    </div>
  );
}
