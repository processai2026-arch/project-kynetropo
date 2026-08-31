import { cn } from "@/lib/utils";

interface ActiveInactiveStatusPillProps {
  active: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
}

export function ActiveInactiveStatusPill({
  active,
  activeLabel = "Active",
  inactiveLabel = "Inactive",
}: ActiveInactiveStatusPillProps) {
  return (
    <span
      className={cn(
        "text-xs px-2 py-1 rounded-full",
        active
          ? "bg-primary/10 text-primary"
          : "bg-destructive/10 text-destructive"
      )}
    >
      {active ? activeLabel : inactiveLabel}
    </span>
  );
}
