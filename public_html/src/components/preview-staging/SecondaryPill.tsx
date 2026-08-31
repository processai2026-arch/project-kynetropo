import { cn } from "@/lib/utils";

interface SecondaryPillProps {
  label?: string;
  className?: string;
}

export function SecondaryPill({ label, className }: SecondaryPillProps) {
  return (
    <span
      className={cn(
        "text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground",
        className
      )}
    >
      {label || "Not set"}
    </span>
  );
}
