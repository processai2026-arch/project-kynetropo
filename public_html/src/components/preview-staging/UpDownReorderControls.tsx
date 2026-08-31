import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface UpDownReorderControlsProps {
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

const btnBase =
  "p-0.5 rounded transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-30 disabled:cursor-not-allowed";
const btnActive = "text-muted-foreground hover:text-card-foreground";

export function UpDownReorderControls({
  index,
  total,
  onMoveUp,
  onMoveDown,
}: UpDownReorderControlsProps) {
  return (
    <div className="flex flex-col gap-1 mt-1">
      <button
        type="button"
        onClick={onMoveUp}
        disabled={index === 0}
        className={cn(btnBase, btnActive)}
        aria-label="Move item up"
      >
        <ChevronUp className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={onMoveDown}
        disabled={index === total - 1}
        className={cn(btnBase, btnActive)}
        aria-label="Move item down"
      >
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
