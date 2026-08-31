import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface NullableEntityItem {
  id: number;
  label: string;
}

export interface NullableEntitySelectProps {
  /** Currently selected entity ID, or null for no selection. */
  value: number | null;
  /** Called with the selected ID, or null when "None" is chosen. */
  onChange: (value: number | null) => void;
  /** Placeholder text shown when no item is selected. */
  placeholder?: string;
  /** List of selectable entities. */
  items: NullableEntityItem[];
  /** Disables the trigger. */
  disabled?: boolean;
  /** Extra Tailwind classes forwarded to the SelectTrigger. */
  className?: string;
}

export function NullableEntitySelect({
  value,
  onChange,
  placeholder = "Select…",
  items,
  disabled = false,
  className,
}: NullableEntitySelectProps) {
  // Represent null / undefined as an empty string so shadcn Select
  // shows the placeholder and the "None" item appears selected.
  const selectValue = value != null ? String(value) : "";

  const handleChange = (v: string) => {
    onChange(v ? Number(v) : null);
  };

  return (
    <Select
      value={selectValue}
      onValueChange={handleChange}
      disabled={disabled}
    >
      <SelectTrigger className={cn(className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {/* Sentinel value — always the first option so the user can clear the field */}
        <SelectItem value="">
          <span className="text-muted-foreground">None</span>
        </SelectItem>
        {items.map((item) => (
          <SelectItem key={item.id} value={String(item.id)}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default NullableEntitySelect;
