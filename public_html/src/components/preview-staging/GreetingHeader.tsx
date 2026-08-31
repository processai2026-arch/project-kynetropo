import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface GreetingHeaderProps {
  greeting: string;
  firstName: string;
  dateLabel: string;
  actionLabel: string;
  actionIcon: LucideIcon;
  onAction: () => void;
  className?: string;
}

export function GreetingHeader({
  greeting,
  firstName,
  dateLabel,
  actionLabel,
  actionIcon: ActionIcon,
  onAction,
  className,
}: GreetingHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between flex-wrap gap-3", className)}>
      <div>
        <h1 className="text-xl font-semibold text-foreground">
          {greeting}, {firstName}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">{dateLabel}</p>
      </div>
      <Button onClick={onAction}>
        <ActionIcon className="h-4 w-4 mr-1.5" />
        {actionLabel}
      </Button>
    </div>
  );
}
