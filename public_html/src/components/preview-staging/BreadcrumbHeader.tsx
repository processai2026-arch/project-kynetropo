import { cn } from "@/lib/utils";

interface BreadcrumbHeaderProps {
  backLabel: string;
  onBack: () => void;
  title: string;
  badge?: React.ReactNode;
  className?: string;
}

export function BreadcrumbHeader({ backLabel, onBack, title, badge, className }: BreadcrumbHeaderProps) {
  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      <button
        onClick={onBack}
        className="text-muted-foreground hover:text-foreground text-sm transition-colors"
      >
        ← {backLabel}
      </button>
      <span className="text-muted-foreground">/</span>
      <h1 className="text-2xl font-bold text-foreground">{title}</h1>
      {badge}
    </div>
  );
}
