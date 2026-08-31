import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface AmPmTimePickerProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  optional?: boolean;
}

function parse24h(raw: string): { hour: string; minute: string; period: "AM" | "PM" } | null {
  const match = raw?.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const h24 = parseInt(match[1], 10);
  const period: "AM" | "PM" = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 || 12;
  return { hour: String(h12), minute: match[2], period };
}

function build24h(hour: string, minute: string, period: "AM" | "PM"): string {
  const h12 = parseInt(hour, 10);
  const h24 = period === "AM" ? (h12 === 12 ? 0 : h12) : h12 === 12 ? 12 : h12 + 12;
  return `${String(h24).padStart(2, "0")}:${minute}`;
}

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

export function AmPmTimePicker({
  label,
  value,
  onChange,
  optional = false,
}: AmPmTimePickerProps) {
  const parsed = parse24h(value);
  const hour = parsed?.hour ?? "";
  const minute = parsed?.minute ?? "";
  const period: "AM" | "PM" = parsed?.period ?? "AM";

  const emit = (h: string, m: string, p: "AM" | "PM") => {
    if (!h || !m) {
      onChange("");
      return;
    }
    onChange(build24h(h, m, p));
  };

  return (
    <div className="space-y-1.5">
      <Label className={cn("text-sm text-muted-foreground")}>
        {label}
        {optional && (
          <span className="ml-1 text-xs text-muted-foreground font-normal">(optional)</span>
        )}
      </Label>

      <div className="flex items-center gap-2">
        <Select value={hour} onValueChange={(v) => emit(v, minute, period)}>
          <SelectTrigger className="w-[72px]">
            <SelectValue placeholder="HH" />
          </SelectTrigger>
          <SelectContent>
            {HOURS.map((h) => (
              <SelectItem key={h} value={h}>
                {h}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="text-muted-foreground text-sm select-none">:</span>

        <Select value={minute} onValueChange={(v) => emit(hour, v, period)}>
          <SelectTrigger className="w-[72px]">
            <SelectValue placeholder="MM" />
          </SelectTrigger>
          <SelectContent>
            {MINUTES.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={period} onValueChange={(v) => emit(hour, minute, v as "AM" | "PM")}>
          <SelectTrigger className="w-[72px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AM">AM</SelectItem>
            <SelectItem value="PM">PM</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
