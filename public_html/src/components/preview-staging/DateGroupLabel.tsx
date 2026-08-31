import { cn } from "@/lib/utils";

interface DateGroupLabelProps {
  label: string;
  className?: string;
}

export function DateGroupLabel({ label, className }: DateGroupLabelProps) {
  return (
    <p
      className={cn(
        "text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 pt-3 pb-1",
        className
      )}
    >
      {label}
    </p>
  );
}
