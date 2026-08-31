import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface AutoCalculatedFieldHintProps {
  labelText: string;
  htmlFor: string;
  className?: string;
}

export function AutoCalculatedFieldHint({
  labelText,
  htmlFor,
  className,
}: AutoCalculatedFieldHintProps) {
  return (
    <Label htmlFor={htmlFor} className={cn(className)}>
      {labelText}{" "}
      <span className="text-xs text-muted-foreground">auto-calculated</span>
    </Label>
  );
}
