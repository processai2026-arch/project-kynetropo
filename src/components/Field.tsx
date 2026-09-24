import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { RecordCombobox, type ComboOption } from "@/components/RecordCombobox";
import { cn } from "@/lib/utils";

/** Label + control + server/field error, the mpTV-erp field wrapper. */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string | null;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-sm text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Read-only label/value pair for detail cards. */
export function Info({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm text-card-foreground mt-0.5 break-words">{children ?? "—"}</dd>
    </div>
  );
}

/** A plain HTML select styled like shadcn inputs — reliable inside dialogs and forms. */
/**
 * The app's dropdown (ADR-41): the same searchable pop-up as the customer picker,
 * not the browser's own list. The name stays from when it was a native <select>,
 * so the forty places that use it did not have to change. A list of six or fewer
 * opens without a search box.
 */
export function NativeSelect({
  value,
  onChange,
  options,
  placeholder,
  id,
  disabled,
  className,
}: {
  value: string | number | null | undefined;
  onChange: (value: string) => void;
  options: { value: string | number; label: string }[];
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
}) {
  const current = value === null || value === undefined ? "" : String(value);
  const items: ComboOption[] = [
    // As the native list had it: the placeholder row takes the choice back to empty.
    ...(placeholder !== undefined && current !== "" ? [{ value: "", label: placeholder }] : []),
    ...options.map((o) => ({ value: String(o.value), label: o.label })),
  ];
  return (
    <RecordCombobox id={id} value={current} options={items} placeholder={placeholder ?? "Choose…"} disabled={disabled}
      className={className} onChange={onChange} searchable={options.length > 6} searchPlaceholder="Type to search…" />
  );
}

export default Field;
