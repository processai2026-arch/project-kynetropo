import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ActionUploadCardProps {
  /** Lucide icon component — pass the component itself, not a JSX element. */
  icon: LucideIcon;
  /** Bold label rendered below the icon. */
  title: string;
  /** Dimmed helper text rendered below the title. */
  description: string;
  /** Callback fired when the card is clicked. */
  onClick: () => void;
  /** Optional extra Tailwind classes merged onto the root element. */
  className?: string;
}

export function ActionUploadCard({
  icon: Icon,
  title,
  description,
  onClick,
  className,
}: ActionUploadCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border bg-card p-6 text-left w-full",
        "hover:bg-muted/30 transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
    >
      <Icon className="h-6 w-6 text-primary mb-3 shrink-0" />
      <div className="text-base font-semibold text-card-foreground">{title}</div>
      <p className="text-sm text-muted-foreground mt-1">{description}</p>
    </button>
  );
}

export default ActionUploadCard;
