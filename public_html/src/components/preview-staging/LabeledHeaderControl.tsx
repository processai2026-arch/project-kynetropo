import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export interface LabeledHeaderControlProps
  extends Omit<React.ComponentProps<"input">, "onChange" | "value"> {
  /** Short text rendered above the input as an xs-sized label. */
  label: string;
  /** Controlled value of the input. */
  value: string;
  /** Called with the raw string value whenever the input changes. */
  onChange: (value: string) => void;
  /** Extra Tailwind classes appended to the Label element. */
  labelClassName?: string;
}

/**
 * LabeledHeaderControl
 *
 * A compact labeled input designed for the page header action bar.
 * Renders an xs-weight Label directly above a full-width Input with no extra
 * wrapper padding so it aligns flush with adjacent buttons at their bottom edge.
 *
 * All native <input> attributes (type, min, max, disabled, placeholder, className…)
 * are forwarded to the underlying Input component via rest props.
 */
export function LabeledHeaderControl({
  label,
  value,
  onChange,
  labelClassName,
  className,
  ...inputProps
}: LabeledHeaderControlProps) {
  const inputId = React.useId();

  return (
    <div className="flex flex-col gap-1">
      <Label
        htmlFor={inputId}
        className={cn("text-xs text-muted-foreground leading-none", labelClassName)}
      >
        {label}
      </Label>
      <Input
        id={inputId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn("h-9 text-sm", className)}
        {...inputProps}
      />
    </div>
  );
}

export default LabeledHeaderControl;
