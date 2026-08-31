import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PRESET_UNITS: string[] = [
  "-",
  "pcs",
  "box",
  "carton",
  "dozen",
  "kg",
  "g",
  "mg",
  "lb",
  "oz",
  "l",
  "ml",
  "m",
  "cm",
  "mm",
  "ft",
  "in",
  "sqm",
  "sqft",
  "set",
  "pair",
  "roll",
  "sheet",
  "bag",
  "bundle",
  "pack",
];

interface UnitSelectProps {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}

export function UnitSelect({ value, onChange, className }: UnitSelectProps) {
  const opts = PRESET_UNITS.includes(value)
    ? PRESET_UNITS
    : [value, ...PRESET_UNITS];

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn("w-full", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {opts.map((u) => (
          <SelectItem key={u} value={u}>
            {u === "-" ? "None ( - )" : u}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
