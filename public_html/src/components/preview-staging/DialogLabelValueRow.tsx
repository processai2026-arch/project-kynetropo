import { cn } from "@/lib/utils";

interface DialogLabelValueRowProps {
  label: string;
  value: React.ReactNode;
  valueBold?: boolean;
}

export function DialogLabelValueRow({
  label,
  value,
  valueBold = true,
}: DialogLabelValueRowProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <span className="text-muted-foreground font-medium">{label}</span>
      <span
        className={cn(
          "col-span-2 text-foreground",
          valueBold ? "font-semibold" : "font-normal"
        )}
      >
        {value}
      </span>
    </div>
  );
}
