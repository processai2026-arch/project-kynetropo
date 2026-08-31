import { CheckCircle2, Circle, MinusCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PipelineStageButtonProps {
  /** Text label rendered beneath the stage circle. */
  label: string;
  /** When true the stage is shown as completed (primary colour). */
  done?: boolean;
  /** When true the stage is shown as skipped (amber). Overrides `done` visually. */
  skipped?: boolean;
  /** Called when the user clicks the button. */
  onClick?: () => void;
}

export function PipelineStageButton({
  label,
  done = false,
  skipped = false,
  onClick,
}: PipelineStageButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 cursor-pointer group"
    >
      <span
        className={cn(
          "h-9 w-9 rounded-full border-2 flex items-center justify-center transition-colors group-hover:opacity-80",
          skipped
            ? "bg-amber-500 border-amber-500 text-white"
            : done
            ? "bg-primary border-primary text-primary-foreground"
            : "border-muted-foreground/30 text-muted-foreground/40"
        )}
      >
        {skipped ? (
          <MinusCircle className="h-4 w-4" />
        ) : done ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <Circle className="h-3.5 w-3.5" />
        )}
      </span>

      <span
        className={cn(
          "text-xs whitespace-nowrap group-hover:underline",
          skipped
            ? "text-amber-600 font-medium"
            : done
            ? "text-primary font-medium"
            : "text-muted-foreground"
        )}
      >
        {label}
      </span>
    </button>
  );
}

export default PipelineStageButton;
