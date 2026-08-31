import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Month labels — index 0 unused so index === month number (1-based)
const MONTH_LABELS = [
  "",
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
] as const;

export interface TypeOption {
  value: string;
  label: string;
}

export interface MonthYearPeriodFilterProps {
  /** Current month value: "all" or "1"–"12" */
  filterMonth: string;
  /** Current year value: e.g. "2025" */
  filterYear: string;
  /** Current type value: "all" or a domain-specific string */
  filterType: string;
  onChangeMonth: (value: string) => void;
  onChangeYear: (value: string) => void;
  onChangeType: (value: string) => void;
  /** Year strings to show in the year select, e.g. ["2023","2024","2025"] */
  yearOptions: string[];
  /**
   * Type options to show after the "All Types" catch-all entry.
   * Pass an empty array to hide the type select entirely.
   */
  typeOptions: TypeOption[];
}

export function MonthYearPeriodFilter({
  filterMonth,
  filterYear,
  filterType,
  onChangeMonth,
  onChangeYear,
  onChangeType,
  yearOptions,
  typeOptions,
}: MonthYearPeriodFilterProps) {
  return (
    <div className="flex flex-wrap gap-3">
      {/* Month */}
      <Select value={filterMonth} onValueChange={onChangeMonth}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Month" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Months</SelectItem>
          {MONTH_LABELS.slice(1).map((label, idx) => (
            <SelectItem key={idx + 1} value={String(idx + 1)}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Year */}
      <Select value={filterYear} onValueChange={onChangeYear}>
        <SelectTrigger className="w-32">
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

      {/* Type — only rendered when typeOptions is non-empty */}
      {typeOptions.length > 0 && (
        <Select value={filterType} onValueChange={onChangeType}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Transaction Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {typeOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

export default MonthYearPeriodFilter;
