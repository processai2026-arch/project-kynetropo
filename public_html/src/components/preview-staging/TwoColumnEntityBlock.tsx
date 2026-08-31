import React from "react";
import { cn } from "@/lib/utils";

export interface TwoColumnEntityBlockProps {
  leftLabel: string;
  leftTitle: string;
  leftDetails: string[];
  rightLabel: string;
  rightTitle: string;
  rightDetails: string[];
  /** Optional extra Tailwind classes applied to the outer wrapper */
  className?: string;
}

interface EntityPanelProps {
  label: string;
  title: string;
  details: string[];
}

function EntityPanel({ label, title, details }: EntityPanelProps) {
  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">
        {label}
      </p>
      <p className="font-semibold text-card-foreground text-sm">{title}</p>
      {details.map((line, i) => (
        <p key={i} className="text-muted-foreground text-xs leading-relaxed">
          {line}
        </p>
      ))}
    </div>
  );
}

export function TwoColumnEntityBlock({
  leftLabel,
  leftTitle,
  leftDetails,
  rightLabel,
  rightTitle,
  rightDetails,
  className,
}: TwoColumnEntityBlockProps) {
  return (
    <div className={cn("grid grid-cols-2 gap-6 mb-6", className)}>
      <EntityPanel label={leftLabel} title={leftTitle} details={leftDetails} />
      <EntityPanel label={rightLabel} title={rightTitle} details={rightDetails} />
    </div>
  );
}

export default TwoColumnEntityBlock;
