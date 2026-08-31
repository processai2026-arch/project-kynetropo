import { cn } from "@/lib/utils";

interface InlineStatusTextProps {
  label: string;
  value: boolean | null;
  trueLabel: string;
  falseLabel: string;
  trueClass?: string;
  falseClass?: string;
}

export function InlineStatusText({
  label,
  value,
  trueLabel,
  falseLabel,
  trueClass = "text-emerald-600 font-medium",
  falseClass = "text-amber-600",
}: InlineStatusTextProps) {
  return (
    <p className="text-sm text-muted-foreground">
      {label}:{" "}
      {value ? (
        <span className={cn(trueClass)}>{trueLabel}</span>
      ) : (
        <span className={cn(falseClass)}>{falseLabel}</span>
      )}
    </p>
  );
}
