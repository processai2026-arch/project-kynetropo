import { cn } from "@/lib/utils";

interface LineItemWithSubnoteProps {
  label: string;
  val: number;
  note?: string | null;
  className?: string;
}

export function LineItemWithSubnote({
  label,
  val,
  note = null,
  className,
}: LineItemWithSubnoteProps) {
  return (
    <div
      className={cn(
        "flex justify-between py-2 border-b last:border-0 text-sm text-card-foreground",
        className
      )}
    >
      <span className="pl-4 text-muted-foreground">
        {label}
        {note && (
          <span className="block text-xs text-muted-foreground/70">{note}</span>
        )}
      </span>
      <span>₹{val.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
    </div>
  );
}
