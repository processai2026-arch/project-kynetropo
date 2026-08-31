import { cn } from "@/lib/utils";

export interface GstMemoRow {
  label: string;
  value: number;
}

export interface GstMemoFootnoteProps {
  rows: GstMemoRow[];
  title?: string;
  className?: string;
}

export function GstMemoFootnote({
  rows,
  title,
  className,
}: GstMemoFootnoteProps) {
  if (rows.length === 0) return null;

  return (
    <div className={cn("mt-4 pt-3 border-t border-dashed", className)}>
      {title && (
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
          {title}
        </p>
      )}
      {rows.map((r) => (
        <div
          key={r.label}
          className="flex justify-between items-center text-xs text-muted-foreground mt-1"
        >
          <span>{r.label}</span>
          <span>
            ₹{r.value.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </span>
        </div>
      ))}
    </div>
  );
}
