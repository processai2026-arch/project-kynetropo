import { Label } from "@/components/ui/label";

interface LabelWithHintProps {
  /** The `for` attribute forwarded to the underlying <label> element. */
  htmlFor?: string;
  /** Visible label text. */
  label: string;
  /** When true, appends a destructive-colored asterisk after the label text. */
  required?: boolean;
  /** Short parenthetical annotation rendered in muted text after the label (and asterisk). */
  hint?: string;
}

export function LabelWithHint({ htmlFor, label, required, hint }: LabelWithHintProps) {
  return (
    <Label htmlFor={htmlFor}>
      {label}
      {required && (
        <span className="text-destructive ml-0.5" aria-hidden="true">
          *
        </span>
      )}
      {hint && (
        <span className="text-xs text-muted-foreground ml-1">({hint})</span>
      )}
    </Label>
  );
}

export default LabelWithHint;
