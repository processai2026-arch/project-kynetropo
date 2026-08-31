import { cn } from "@/lib/utils";

interface ThreeStateToggleButtonProps {
  isActive: boolean;
  isDone: boolean;
  label: string;
  stepNumber?: string;
  onClick: () => void;
  activeColorClass: string;
  doneColorClass: string;
  hoverColorClass: string;
}

export function ThreeStateToggleButton({
  isActive,
  isDone,
  label,
  stepNumber,
  onClick,
  activeColorClass,
  doneColorClass,
  hoverColorClass,
}: ThreeStateToggleButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors",
        isActive
          ? activeColorClass
          : isDone
          ? doneColorClass
          : `bg-card text-card-foreground border-border ${hoverColorClass}`
      )}
    >
      {isDone ? "✓ " : stepNumber}
      {label}
      {isActive && <span className="animate-pulse">●</span>}
    </button>
  );
}
