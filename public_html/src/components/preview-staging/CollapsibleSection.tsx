import React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CollapsibleSectionProps {
  expanded: boolean;
  onToggle: () => void;
  header: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function CollapsibleSection({
  expanded,
  onToggle,
  header,
  children,
  className,
}: CollapsibleSectionProps) {
  return (
    <div className={cn("bg-card rounded-xl border shadow-sm", className)}>
      <div className="p-4 flex items-center gap-4">
        <div className="flex-1 min-w-0">{header}</div>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 shrink-0 ml-auto"
          onClick={onToggle}
          aria-expanded={expanded}
        >
          {expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      </div>
      {expanded && (
        <div className="border-t p-4 space-y-3">{children}</div>
      )}
    </div>
  );
}
