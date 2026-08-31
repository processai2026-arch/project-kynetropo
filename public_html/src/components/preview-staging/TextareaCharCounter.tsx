import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface TextareaCharCounterProps {
  value: string;
  onChange: (v: string) => void;
  maxLength: number;
  label: string;
  optional?: boolean;
  placeholder?: string;
  rows?: number;
}

export function TextareaCharCounter({
  value,
  onChange,
  maxLength,
  label,
  optional = false,
  placeholder,
  rows = 3,
}: TextareaCharCounterProps) {
  const nearLimit = value.length >= Math.floor(maxLength * 0.9);

  return (
    <div>
      <Label>
        {label}
        {optional && (
          <span className="text-muted-foreground text-xs ml-1">(optional)</span>
        )}
      </Label>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
        maxLength={maxLength}
        rows={rows}
        placeholder={placeholder}
        className="mt-1 resize-none"
      />
      <p
        className={cn(
          "text-xs text-right mt-1",
          nearLimit ? "text-destructive" : "text-muted-foreground"
        )}
      >
        {value.length} / {maxLength}
      </p>
    </div>
  );
}
