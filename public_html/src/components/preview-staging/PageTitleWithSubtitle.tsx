import { cn } from "@/lib/utils";

interface PageTitleWithSubtitleProps {
  title: string;
  subtitle: string;
  className?: string;
}

export function PageTitleWithSubtitle({
  title,
  subtitle,
  className,
}: PageTitleWithSubtitleProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <h1 className="text-2xl font-bold text-foreground">{title}</h1>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}
