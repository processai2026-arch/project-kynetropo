import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface YearRangeSelectProps {
  /** Currently selected year. */
  year: number;
  /** Callback invoked with the newly chosen year as a number. */
  setYear: (year: number) => void;
}

/**
 * YearRangeSelect
 *
 * A compact Select that renders the previous, current, and next calendar year
 * as options. Designed for year-scoped data filtering (leave registers, payroll
 * runs, attendance exports, etc.).
 *
 * Width is fixed at w-32 to keep filter bars tidy.
 */
export function YearRangeSelect({ year, setYear }: YearRangeSelectProps) {
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
      <SelectTrigger className="w-32">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {years.map((y) => (
          <SelectItem key={y} value={String(y)}>
            {y}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default YearRangeSelect;
