import { cn } from "@/lib/utils";

interface SectionCardProps {
  title?: string;
  titleSize?: "sm" | "base";
  children: React.ReactNode;
  className?: string;
  headerRight?: React.ReactNode;
}

export function SectionCard({ title, titleSize = "base", children, className, headerRight }: SectionCardProps) {
  const titleClass = titleSize === "sm"
    ? "text-sm font-semibold text-muted-foreground uppercase tracking-wider"
    : "text-base font-semibold text-card-foreground";

  return (
    <div className={cn("bg-card rounded-xl border shadow-sm", className)}>
      {(title || headerRight) && (
        <div className="flex items-center justify-between p-4 border-b">
          {title && <h2 className={titleClass}>{title}</h2>}
          {headerRight}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}
