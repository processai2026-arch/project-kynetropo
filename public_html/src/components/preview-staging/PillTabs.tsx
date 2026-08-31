import { cn } from "@/lib/utils";

interface PillTabsProps<T extends string> {
  tabs: Array<{ value: T; label: string; count?: number }>;
  active: T;
  onChange: (value: T) => void;
  variant?: "pill" | "underline" | "segment";
  className?: string;
}

export function PillTabs<T extends string>({
  tabs,
  active,
  onChange,
  variant = "pill",
  className,
}: PillTabsProps<T>) {
  if (variant === "underline") {
    return (
      <div className={cn("flex border-b border-border", className)}>
        {tabs.map(t => (
          <button
            key={t.value}
            onClick={() => onChange(t.value)}
            className={cn(
              "px-5 py-3 text-sm font-medium border-b-2 transition-colors",
              active === t.value
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span
                className={cn(
                  "ml-2 px-1.5 py-0.5 rounded-full text-xs font-semibold",
                  active === t.value ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>
    );
  }

  if (variant === "segment") {
    return (
      <div className={cn("inline-flex bg-muted rounded-lg p-1", className)}>
        {tabs.map(t => (
          <button
            key={t.value}
            onClick={() => onChange(t.value)}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              active === t.value
                ? "bg-background shadow-sm border border-border text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("flex gap-1", className)}>
      {tabs.map(t => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            "px-4 py-1.5 rounded-full text-sm font-medium border transition-colors",
            active === t.value
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-card text-muted-foreground border-border hover:bg-muted"
          )}
        >
          {t.label}
          {t.count !== undefined && ` (${t.count})`}
        </button>
      ))}
    </div>
  );
}
