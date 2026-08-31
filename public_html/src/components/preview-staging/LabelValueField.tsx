import type { ReactElement } from "react";

export interface LabelValueFieldProps {
  /** The field label — rendered as a muted caption above the value. */
  label: string;
  /**
   * The value to display.
   * - null / undefined / empty string → renders an em-dash (—)
   * - boolean → renders "Yes" or "No"
   * - everything else → coerced to string via String()
   */
  value: string | number | boolean | null | undefined;
}

function normalise(value: LabelValueFieldProps["value"]): string {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

export function LabelValueField({ label, value }: LabelValueFieldProps): ReactElement {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm text-card-foreground mt-0.5">{normalise(value)}</dd>
    </div>
  );
}

export default LabelValueField;
