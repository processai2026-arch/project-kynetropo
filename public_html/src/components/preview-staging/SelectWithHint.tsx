import React from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface SelectWithHintProps {
  /** Field label rendered above the select trigger. */
  label: string;
  /** Currently selected value (controlled). */
  value: string;
  /** Called with the new value when the selection changes. */
  onChange: (value: string) => void;
  /** Placeholder text shown inside the trigger when no value is selected. */
  placeholder?: string;
  /**
   * Helper text shown below the trigger.
   * Only visible when a value has been selected (auto-fill feedback pattern).
   */
  hint?: string;
  /** SelectItem elements rendered inside the dropdown. */
  children: React.ReactNode;
}

export function SelectWithHint({
  label,
  value,
  onChange,
  placeholder,
  hint,
  children,
}: SelectWithHintProps) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
      {value && hint && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

export default SelectWithHint;
