import { type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface IconMetricTileProps {
  icon: LucideIcon;
  label: string;
  value: string | number | ReactNode;
  variant?: "primary" | "success" | "warning" | "danger";
  className?: string;
}

const variantStyles: Record<
  NonNullable<IconMetricTileProps["variant"]>,
  { box: string; icon: string }
> = {
  primary: { box: "bg-primary/10",       icon: "text-primary"      },
  success: { box: "bg-emerald-500/10",   icon: "text-emerald-600"  },
  warning: { box: "bg-amber-500/10",     icon: "text-amber-600"    },
  danger:  { box: "bg-destructive/10",   icon: "text-destructive"  },
};

export function IconMetricTile({
  icon: Icon,
  label,
  value,
  variant = "primary",
  className,
}: IconMetricTileProps) {
  const styles = variantStyles[variant];

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-4 rounded-lg border bg-secondary/30",
        className
      )}
    >
      <div className={cn("p-2 rounded-lg shrink-0", styles.box)}>
        <Icon className={cn("h-4 w-4", styles.icon)} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className="font-semibold text-card-foreground">{value}</p>
      </div>
    </div>
  );
}
