import { cn } from "@/lib/utils";

export interface CheckboxField {
  key: string;
  label: string;
}

export interface CheckboxFieldGridProps {
  fields: CheckboxField[];
  fieldMap: Record<string, boolean>;
  onToggle: (key: string) => void;
}

export function CheckboxFieldGrid({
  fields,
  fieldMap,
  onToggle,
}: CheckboxFieldGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
      {fields.map((field) => (
        <label
          key={field.key}
          className={cn(
            "flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors text-sm",
            fieldMap[field.key]
              ? "bg-primary/5 border-primary/30 text-foreground"
              : "border-border text-muted-foreground hover:bg-muted/30"
          )}
        >
          <input
            type="checkbox"
            checked={!!fieldMap[field.key]}
            onChange={() => onToggle(field.key)}
            className="rounded"
          />
          <span>{field.label}</span>
        </label>
      ))}
    </div>
  );
}
