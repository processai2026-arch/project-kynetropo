import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface TwoLineCellProps {
  /** Primary value — rendered bold at full size */
  primary: ReactNode;
  /** Secondary sub-label — rendered smaller and muted below the primary */
  secondary?: ReactNode;
  /** Optional extra class names applied to the wrapper */
  className?: string;
}

export function TwoLineCell({ primary, secondary, className }: TwoLineCellProps) {
  return (
    <div className={cn("leading-tight", className)}>
      <div className="font-medium text-card-foreground">{primary}</div>
      {secondary != null && secondary !== "" && (
        <div className="text-xs text-muted-foreground mt-0.5">{secondary}</div>
      )}
    </div>
  );
}

export default TwoLineCell;
