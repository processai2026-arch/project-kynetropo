import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface ImportTileButtonProps {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
}

export function ImportTileButton({
  icon: Icon,
  title,
  description,
  onClick,
}: ImportTileButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border bg-card p-6 text-left w-full transition-colors",
        "hover:bg-muted/30",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      )}
    >
      <Icon className="h-6 w-6 text-primary mb-3" />
      <div className="font-semibold text-card-foreground">{title}</div>
      <p className="text-sm text-muted-foreground mt-1">{description}</p>
    </button>
  );
}
