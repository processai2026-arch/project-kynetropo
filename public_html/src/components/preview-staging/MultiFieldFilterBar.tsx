import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface MultiFieldFilterBarProps {
  search: string;
  onSearchChange: (v: string) => void;
  category: string;
  categories: string[];
  onCategoryChange: (v: string) => void;
  fromDate: string;
  onFromDateChange: (v: string) => void;
  toDate: string;
  onToDateChange: (v: string) => void;
  minAmt: string;
  onMinAmtChange: (v: string) => void;
  maxAmt: string;
  onMaxAmtChange: (v: string) => void;
  className?: string;
}

export function MultiFieldFilterBar({
  search,
  onSearchChange,
  category,
  categories,
  onCategoryChange,
  fromDate,
  onFromDateChange,
  toDate,
  onToDateChange,
  minAmt,
  onMinAmtChange,
  maxAmt,
  onMaxAmtChange,
  className,
}: MultiFieldFilterBarProps) {
  return (
    <div
      className={cn(
        "bg-card rounded-xl border p-4 shadow-sm grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3",
        className
      )}
    >
      <div className="lg:col-span-2 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <Select value={category} onValueChange={onCategoryChange}>
        <SelectTrigger>
          <SelectValue placeholder="All categories" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All categories</SelectItem>
          {categories.map((cat) => (
            <SelectItem key={cat} value={cat}>
              {cat}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        type="date"
        value={fromDate}
        onChange={(e) => onFromDateChange(e.target.value)}
      />

      <Input
        type="date"
        value={toDate}
        onChange={(e) => onToDateChange(e.target.value)}
      />

      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          placeholder="Min"
          value={minAmt}
          onChange={(e) => onMinAmtChange(e.target.value)}
          className="min-w-0"
        />
        <span className="text-xs text-muted-foreground shrink-0">–</span>
        <Input
          type="number"
          placeholder="Max"
          value={maxAmt}
          onChange={(e) => onMaxAmtChange(e.target.value)}
          className="min-w-0"
        />
      </div>
    </div>
  );
}
