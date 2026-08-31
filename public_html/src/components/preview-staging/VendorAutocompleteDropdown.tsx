import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export interface VendorAutocompleteDropdownProps {
  value: string;
  suggestions: string[];
  onChange: (value: string) => void;
  onSelect: (name: string) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  placeholder?: string;
  id?: string;
  className?: string;
  inputClassName?: string;
}

export function VendorAutocompleteDropdown({
  value,
  suggestions,
  onChange,
  onSelect,
  isOpen,
  onOpenChange,
  placeholder = "Search vendor...",
  id,
  className,
  inputClassName,
}: VendorAutocompleteDropdownProps) {
  const filtered = suggestions
    .filter((v) => v.toLowerCase().includes(value.toLowerCase()))
    .slice(0, 10);

  return (
    <div className={cn("relative", className)}>
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        className={inputClassName}
        onChange={(e) => {
          onChange(e.target.value);
          onOpenChange(true);
        }}
        onBlur={() => setTimeout(() => onOpenChange(false), 150)}
        onFocus={() => onOpenChange(true)}
        autoComplete="off"
      />
      {isOpen && filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-0.5 bg-card border border-border rounded-lg shadow-md max-h-40 overflow-y-auto">
          {filtered.map((v) => (
            <button
              key={v}
              type="button"
              onMouseDown={() => onSelect(v)}
              className="w-full text-left px-3 py-2 text-sm text-card-foreground hover:bg-muted/50 transition-colors first:rounded-t-lg last:rounded-b-lg"
            >
              {v}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
