import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export interface InlineDecimalInputProps {
  /** Controlled numeric value from the parent. */
  value: number;
  /** Called with the new numeric value on every keystroke. */
  onChange: (value: number) => void;
  /** Additional Tailwind classes to merge onto the Input element. */
  className?: string;
}

/**
 * Compact right-aligned decimal input sized for use inside dialog info grids.
 *
 * Keeps an internal string draft so the user can type "1." without the
 * trailing dot being immediately stripped by Number() conversion.
 * The draft is normalised (trailing dot removed, empty → "0") on blur.
 * External value changes (e.g. a parent recalculation) are reflected in the
 * draft only when the numeric representation diverges from the new prop.
 */
export function InlineDecimalInput({
  value,
  onChange,
  className,
}: InlineDecimalInputProps) {
  const [draft, setDraft] = useState<string>(() => String(value ?? 0));

  // Sync draft when the parent changes value externally (e.g. after recalculation).
  // We compare the numeric interpretation of the current draft against the new value
  // so that mid-typing states like "1." are preserved when they still match.
  useEffect(() => {
    const draftAsNumber =
      draft === "" || draft === "." ? 0 : parseFloat(draft);
    if (!Number.isFinite(draftAsNumber) || draftAsNumber !== value) {
      setDraft(String(value ?? 0));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Allow only digits and a single decimal point; strip leading zeros before digits.
    const cleaned = raw
      .replace(/[^\d.]/g, "")
      .replace(/^0+(?=\d)/, "");
    setDraft(cleaned);
    onChange(cleaned === "" || cleaned === "." ? 0 : Number(cleaned));
  };

  const handleBlur = () => {
    // Normalise on blur: remove trailing dot, convert empty/invalid to "0".
    const n = parseFloat(draft);
    setDraft(Number.isFinite(n) ? String(n) : "0");
  };

  return (
    <Input
      type="text"
      inputMode="decimal"
      className={cn("h-7 w-24 text-right", className)}
      value={draft}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
}

export default InlineDecimalInput;
