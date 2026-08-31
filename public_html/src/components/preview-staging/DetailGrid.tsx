import { cn } from "@/lib/utils";

interface DetailGridProps {
  children: React.ReactNode;
  cols?: 2 | 3;
  className?: string;
}

export function DetailGrid({ children, cols = 2, className }: DetailGridProps) {
  return (
    <div className={cn("grid gap-4 text-sm", cols === 2 ? "grid-cols-2" : "grid-cols-3", className)}>
      {children}
    </div>
  );
}

interface DetailFieldProps {
  label: string;
  value: React.ReactNode;
  colSpan?: boolean;
  mono?: boolean;
}

export function DetailField({ label, value, colSpan, mono }: DetailFieldProps) {
  return (
    <div className={colSpan ? "col-span-full" : undefined}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-card-foreground capitalize mt-0.5", mono && "font-mono text-xs")}>
        {value ?? "—"}
      </p>
    </div>
  );
}
