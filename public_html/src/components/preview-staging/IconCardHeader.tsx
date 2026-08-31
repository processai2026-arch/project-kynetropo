import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface IconCardHeaderProps {
  /** A Lucide icon component to display on the left */
  icon: LucideIcon;
  /** Section heading text */
  title: string;
  /** Optional trailing action — if a string is passed, renders a compact outline button */
  action?: React.ReactNode | string;
  /** Callback fired when the action button is clicked (only used when action is a string) */
  onAction?: () => void;
}

export function IconCardHeader({ icon: Icon, title, action, onAction }: IconCardHeaderProps) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="h-4 w-4 text-primary shrink-0" />
      <h2 className="text-base font-semibold text-card-foreground flex-1">{title}</h2>
      {action && (
        typeof action === "string" ? (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs px-2"
            onClick={onAction}
          >
            {action}
          </Button>
        ) : (
          action
        )
      )}
    </div>
  );
}

export default IconCardHeader;
