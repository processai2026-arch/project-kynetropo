import { cn } from "@/lib/utils";

interface TabPlaceholderCardProps {
  emoji?: string;
  title?: string;
  description?: string;
  className?: string;
}

export function TabPlaceholderCard({
  emoji = "📋",
  title = "Coming Soon",
  description = "This feature is not yet available.",
  className,
}: TabPlaceholderCardProps) {
  return (
    <div className={cn("bg-card rounded-xl border shadow-sm p-8 text-center", className)}>
      <p className="text-4xl mb-3">{emoji}</p>
      <p className="font-semibold text-card-foreground mb-1">{title}</p>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
