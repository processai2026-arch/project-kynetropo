import { cn } from "@/lib/utils";

interface KeyValueRowProps {
  label: string;
  value: React.ReactNode;
  bold?: boolean;
  className?: string;
}

export function KeyValueRow({ label, value, bold, className }: KeyValueRowProps) {
  return (
    <div className={cn("flex justify-between border-b py-1.5 last:border-0 text-sm", className)}>
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("text-card-foreground", bold && "font-semibold")}>{value}</span>
    </div>
  );
}

interface KeyValuePanelProps {
  children: React.ReactNode;
  className?: string;
}

export function KeyValuePanel({ children, className }: KeyValuePanelProps) {
  return (
    <div className={cn("bg-muted/30 rounded-lg p-4 text-sm", className)}>
      {children}
    </div>
  );
}
