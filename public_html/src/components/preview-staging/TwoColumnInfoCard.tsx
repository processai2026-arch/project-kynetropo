import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface InfoColBlock {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  mono?: boolean;
}

export interface TwoColumnInfoCardProps {
  left: InfoColBlock;
  right: InfoColBlock;
  className?: string;
}

function ColBlock({ label, value, detail, mono = false }: InfoColBlock) {
  return (
    <div>
      <p className="text-xs uppercase text-muted-foreground font-semibold tracking-wide">
        {label}
      </p>
      <p
        className={cn(
          "text-xs break-all mt-1 text-card-foreground",
          mono && "font-mono"
        )}
      >
        {value}
      </p>
      {detail != null && (
        <p className="text-xs text-muted-foreground mt-1">{detail}</p>
      )}
    </div>
  );
}

export function TwoColumnInfoCard({ left, right, className }: TwoColumnInfoCardProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 md:grid-cols-2 gap-3 border rounded-lg p-3",
        className
      )}
    >
      <ColBlock {...left} />
      <ColBlock {...right} />
    </div>
  );
}
