import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface OtherOptionRevealProps {
  options: string[];
  choiceValue: string;
  customValue: string;
  otherKey?: string;
  onChoiceChange: (v: string) => void;
  onCustomChange: (v: string) => void;
  label?: string;
}

export function OtherOptionReveal({
  options,
  choiceValue,
  customValue,
  otherKey = "Other",
  onChoiceChange,
  onCustomChange,
  label,
}: OtherOptionRevealProps) {
  const isOther = choiceValue === otherKey;
  const allOptions = options.includes(otherKey) ? options : [...options, otherKey];

  return (
    <div className={cn("space-y-1.5")}>
      {label && (
        <Label className="text-sm text-muted-foreground">{label}</Label>
      )}
      <Select value={choiceValue} onValueChange={onChoiceChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {allOptions.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isOther && (
        <div className="mt-2">
          <Input
            autoFocus
            placeholder="Enter custom value"
            value={customValue}
            onChange={(e) => onCustomChange(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
