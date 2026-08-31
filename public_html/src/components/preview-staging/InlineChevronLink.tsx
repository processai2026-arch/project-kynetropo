import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface InlineChevronLinkProps {
  label: string;
  onClick: () => void;
  className?: string;
}

export function InlineChevronLink({ label, onClick, className }: InlineChevronLinkProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-xs text-primary hover:underline flex items-center gap-1 mt-1",
        className
      )}
    >
      {label}
      <ChevronRight className="h-3 w-3" />
    </button>
  );
}
