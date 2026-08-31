import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

// Month names indexed 1–12; value stored as numeric string "1"–"12"
const MONTH_NAMES: readonly string[] = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export interface MonthYearSelectPairProps {
  /** Currently selected month as a numeric string ("1"–"12"). Empty string shows placeholder. */
  period_month: string;
  /** Currently selected year as a string (e.g. "2024"). Empty string shows placeholder. */
  period_year: string;
  /** Called with the new month string when the user changes the month select. */
  onChangeMonth: (value: string) => void;
  /** Called with the new year string when the user changes the year select. */
  onChangeYear: (value: string) => void;
  /** Ordered list of year strings to populate the year select (e.g. ["2022","2023","2024"]). */
  yearOptions: string[];
}

export function MonthYearSelectPair({
  period_month,
  period_year,
  onChangeMonth,
  onChangeYear,
  yearOptions,
}: MonthYearSelectPairProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-1.5">
        <Label htmlFor="period_month">Period Month *</Label>
        <Select value={period_month} onValueChange={onChangeMonth}>
          <SelectTrigger id="period_month">
            <SelectValue placeholder="Month" />
          </SelectTrigger>
          <SelectContent>
            {MONTH_NAMES.map((name, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="period_year">Period Year *</Label>
        <Select value={period_year} onValueChange={onChangeYear}>
          <SelectTrigger id="period_year">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map((y) => (
              <SelectItem key={y} value={y}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export default MonthYearSelectPair;
