import { cn } from "@/lib/utils";

interface ClickableStatusPillProps {
  label: string;
  colorClass: string;
  onClick: () => void;
}

export function ClickableStatusPill({ label, colorClass, onClick }: ClickableStatusPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-xs font-medium px-3 py-1 rounded-full whitespace-nowrap transition-opacity hover:opacity-80 cursor-pointer",
        colorClass
      )}
    >
      {label}
    </button>
  );
}
