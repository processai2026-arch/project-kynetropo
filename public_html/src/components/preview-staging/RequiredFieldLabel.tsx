import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

interface RequiredFieldLabelProps {
  /** The `id` of the form control this label is associated with. */
  htmlFor: string;
  /** Visible label text or inline content. */
  children: ReactNode;
}

export function RequiredFieldLabel({ htmlFor, children }: RequiredFieldLabelProps) {
  return (
    <Label htmlFor={htmlFor}>
      {children}{" "}
      <span className="text-destructive" aria-hidden="true">
        *
      </span>
    </Label>
  );
}

export default RequiredFieldLabel;
