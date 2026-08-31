import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface DrillDownDetailsProps {
  /** Section label shown in the summary row */
  label: string;
  /** Count displayed in parentheses next to the label */
  count: number | string;
  /** Expandable content rendered when the section is open */
  children: React.ReactNode;
  /** Whether the section starts in the open state (default: false) */
  defaultOpen?: boolean;
  /** Extra Tailwind classes applied to the outer <details> element */
  className?: string;
}

export function DrillDownDetails({
  label,
  count,
  children,
  defaultOpen = false,
  className,
}: DrillDownDetailsProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <details
      className={cn("border-t", className)}
      open={open}
      onToggle={(e) =>
        setOpen((e.currentTarget as HTMLDetailsElement).open)
      }
    >
      <summary className="flex cursor-pointer select-none list-none items-center justify-between px-4 py-3 text-sm font-medium text-primary transition-colors hover:text-primary/80">
        <span>
          {label}{" "}
          <span className="font-normal text-muted-foreground">({count})</span>
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </summary>
      <div className="border-t">{children}</div>
    </details>
  );
}

export default DrillDownDetails;
