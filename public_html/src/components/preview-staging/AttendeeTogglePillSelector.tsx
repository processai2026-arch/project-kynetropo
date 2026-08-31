import { cn } from "@/lib/utils";

interface AttendeeOption {
  id: string;
  name: string;
}

interface AttendeeTogglePillSelectorProps {
  options: AttendeeOption[];
  selected: string[];
  onToggle: (id: string) => void;
  className?: string;
}

export function AttendeeTogglePillSelector({
  options,
  selected,
  onToggle,
  className,
}: AttendeeTogglePillSelectorProps) {
  if (options.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">No options available.</p>
    );
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {options.map((option) => {
        const isSelected = selected.includes(option.id);
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onToggle(option.id)}
            className={cn(
              "text-xs px-3 py-1.5 rounded-full border transition-colors",
              isSelected
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card hover:bg-muted text-muted-foreground border-border"
            )}
          >
            {option.name}
          </button>
        );
      })}
    </div>
  );
}
