import { cn } from "@/lib/utils";

export interface InsightItem {
  label: string;
  detail?: string;
  link?: string;
}

interface InsightSectionProps {
  title: string;
  icon: React.ReactNode;
  tone: "recommendation" | "improvement" | "critical" | "metric";
  items: InsightItem[];
  onItemClick?: (item: InsightItem) => void;
}

type Tone = InsightSectionProps["tone"];

const toneClasses: Record<Tone, string> = {
  recommendation: "border-l-primary bg-secondary/30",
  improvement:    "border-l-amber-400 bg-amber-50/60",
  critical:       "border-l-destructive bg-red-50/60",
  metric:         "border-l-emerald-500 bg-emerald-50/60",
};

const badgeClasses: Record<Tone, string> = {
  recommendation: "bg-primary/10 text-primary",
  improvement:    "bg-amber-100 text-amber-700",
  critical:       "bg-destructive/10 text-destructive",
  metric:         "bg-emerald-100 text-emerald-700",
};

const linkClasses: Record<Tone, string> = {
  recommendation: "text-primary hover:underline",
  improvement:    "text-amber-600 hover:underline",
  critical:       "text-destructive hover:underline",
  metric:         "text-emerald-600 hover:underline",
};

export function InsightSection({
  title,
  icon,
  tone,
  items,
  onItemClick,
}: InsightSectionProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-l-4 p-5 space-y-3",
        toneClasses[tone]
      )}
    >
      <div className="flex items-center gap-2 font-semibold text-foreground">
        <span className={cn("p-1.5 rounded-md", badgeClasses[tone])}>
          {icon}
        </span>
        {title}
        <span className="text-xs text-muted-foreground font-normal">
          ({items.length})
        </span>
      </div>

      <ul className="space-y-2.5">
        {items.map((item, i) => (
          <li key={i} className="text-sm flex items-start justify-between gap-3">
            <span className="text-card-foreground leading-snug">
              {item.label}
              {item.detail && (
                <span className="text-muted-foreground"> — {item.detail}</span>
              )}
            </span>
            {item.link && onItemClick && (
              <button
                type="button"
                onClick={() => onItemClick(item)}
                className={cn(
                  "text-xs shrink-0 font-medium transition-colors",
                  linkClasses[tone]
                )}
              >
                {item.link}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
