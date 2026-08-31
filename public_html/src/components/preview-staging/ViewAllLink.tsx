import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ViewAllLinkProps {
  label?: string;
  onClick: () => void;
  className?: string;
}

export function ViewAllLink({ label = "View all", onClick, className }: ViewAllLinkProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "text-xs text-primary hover:text-primary/80 flex items-center gap-0.5 transition-colors",
        className
      )}
    >
      {label}
      <ArrowUpRight className="h-3 w-3" />
    </button>
  );
}
