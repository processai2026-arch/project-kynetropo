import { cn } from "@/lib/utils";

export type RaciRole = "R" | "A" | "C" | "I" | "-";

export interface RaciRoleConfig {
  label: string;
  color: string;
}

export interface RaciLegendProps {
  roles?: RaciRole[];
  labels?: Record<RaciRole, RaciRoleConfig>;
}

const DEFAULT_ROLES: RaciRole[] = ["R", "A", "C", "I"];

const DEFAULT_LABELS: Record<RaciRole, RaciRoleConfig> = {
  R: { label: "Responsible", color: "bg-blue-100 text-blue-700" },
  A: { label: "Accountable", color: "bg-amber-100 text-amber-700" },
  C: { label: "Consulted", color: "bg-purple-100 text-purple-700" },
  I: { label: "Informed", color: "bg-emerald-100 text-emerald-700" },
  "-": { label: "Not Involved", color: "bg-muted text-muted-foreground" },
};

export function RaciLegend({
  roles = DEFAULT_ROLES,
  labels = DEFAULT_LABELS,
}: RaciLegendProps) {
  return (
    <div className="flex flex-wrap gap-3 mt-2 text-[11px] text-muted-foreground">
      {roles
        .filter((r) => r !== "-")
        .map((r) => (
          <div key={r} className="flex items-center gap-1">
            <span
              className={cn(
                "w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center",
                labels[r]?.color
              )}
            >
              {r}
            </span>
            {labels[r]?.label}
          </div>
        ))}
    </div>
  );
}
