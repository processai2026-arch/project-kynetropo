import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PageHeaderWithSubtitleProps {
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function PageHeaderWithSubtitle({
  title,
  subtitle,
  actionLabel,
  onAction,
}: PageHeaderWithSubtitleProps) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        <p className={cn("text-sm text-muted-foreground mt-0.5")}>{subtitle}</p>
      </div>
      {actionLabel && (
        <Button variant="outline" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
