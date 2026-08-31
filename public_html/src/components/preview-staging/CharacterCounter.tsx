import { cn } from "@/lib/utils";

interface CharacterCounterProps {
  current: number;
  max: number;
  className?: string;
}

export function CharacterCounter({ current, max, className }: CharacterCounterProps) {
  const isNearLimit = current >= max * 0.9;
  const isAtLimit = current >= max;

  return (
    <p
      className={cn(
        "text-xs text-right mt-1",
        isAtLimit
          ? "text-destructive"
          : isNearLimit
          ? "text-amber-500"
          : "text-muted-foreground",
        className
      )}
    >
      {current} / {max}
    </p>
  );
}

export default CharacterCounter;
