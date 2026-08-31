import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface AmountInputWithFillButtonProps {
  value: string;
  onChange: (v: string) => void;
  maxValue: number;
  placeholder?: string;
  fillLabel?: string;
  disabled?: boolean;
  className?: string;
}

export function AmountInputWithFillButton({
  value,
  onChange,
  maxValue,
  placeholder = "0.00",
  fillLabel = "Full",
  disabled = false,
  className,
}: AmountInputWithFillButtonProps) {
  const handleFill = () => {
    onChange(String(maxValue));
  };

  return (
    <div className={cn("flex gap-2", className)}>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        min={0}
        max={maxValue}
        step="0.01"
        disabled={disabled}
        className="flex-1"
      />
      <Button
        type="button"
        variant="outline"
        onClick={handleFill}
        disabled={disabled || maxValue <= 0}
        className="shrink-0"
      >
        {fillLabel}
      </Button>
    </div>
  );
}
