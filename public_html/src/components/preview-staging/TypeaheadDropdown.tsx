import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface TypeaheadDropdownProps<T> {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  items: T[];
  maxItems?: number;
  getKey: (item: T) => string | number;
  getPrimary: (item: T) => string;
  getSecondary: (item: T) => string;
  onSelect: (item: T) => void;
  emptyText?: string;
}

export function TypeaheadDropdown<T>({
  label,
  value,
  onChange,
  placeholder = "Search…",
  items,
  maxItems = 15,
  getKey,
  getPrimary,
  getSecondary,
  onSelect,
  emptyText = "No results found",
}: TypeaheadDropdownProps<T>) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {value && (
        <div className="border rounded-lg divide-y max-h-48 overflow-y-auto mt-1">
          {items.slice(0, maxItems).map(item => (
            <button
              key={getKey(item)}
              type="button"
              onClick={() => { onSelect(item); onChange(""); }}
              className="w-full text-left px-3 py-2.5 hover:bg-muted/50 text-sm flex justify-between"
            >
              <span className="font-medium">{getPrimary(item)}</span>
              <span className="text-muted-foreground font-mono text-xs">{getSecondary(item)}</span>
            </button>
          ))}
          {items.length === 0 && (
            <div className="px-3 py-3 text-sm text-muted-foreground text-center">
              {emptyText}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
