import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface StateTransitionDisplayProps {
  fromLabel: string;
  toLabel: string;
  className?: string;
}

export function StateTransitionDisplay({
  fromLabel,
  toLabel,
  className,
}: StateTransitionDisplayProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm", className)}>
      <span className="text-muted-foreground">{fromLabel}</span>
      <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
      <span className="font-medium text-card-foreground">{toLabel}</span>
    </span>
  );
}
