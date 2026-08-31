import { cn } from "@/lib/utils";

interface DialogKeyValueField {
  label: string;
  value: string;
  valueColor?: "default" | "muted" | "destructive";
}

export interface DialogKeyValueGridProps {
  fields: DialogKeyValueField[];
}

const valueColorClasses: Record<
  NonNullable<DialogKeyValueField["valueColor"]>,
  string
> = {
  default: "text-card-foreground",
  muted: "text-muted-foreground",
  destructive: "text-destructive font-medium",
};

export function DialogKeyValueGrid({ fields }: DialogKeyValueGridProps) {
  return (
    <div className="grid grid-cols-2 gap-4 text-sm">
      {fields.map((f, i) => (
        <div key={i} className="space-y-0.5">
          <span className="font-semibold text-card-foreground">
            {f.label}:
          </span>
          <p className={cn(valueColorClasses[f.valueColor ?? "muted"])}>
            {f.value}
          </p>
        </div>
      ))}
    </div>
  );
}
