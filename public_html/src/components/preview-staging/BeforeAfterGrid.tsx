import { cn } from "@/lib/utils";

interface BeforeAfterGridProps {
  before: string;
  after: string;
  className?: string;
}

export function BeforeAfterGrid({ before, after, className }: BeforeAfterGridProps) {
  return (
    <div className={cn("grid grid-cols-2 gap-4 text-sm", className)}>
      <div className="space-y-1">
        <span className="font-semibold text-card-foreground">Before:</span>
        <p className="text-muted-foreground">{before}</p>
      </div>
      <div className="space-y-1">
        <span className="font-semibold text-card-foreground">After:</span>
        <p className="text-muted-foreground">{after}</p>
      </div>
    </div>
  );
}
