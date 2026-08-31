import { cn } from "@/lib/utils";

interface NumberedStepListProps {
  steps: string[];
  className?: string;
  size?: "sm" | "md";
  spacing?: "compact" | "relaxed";
}

export function NumberedStepList({
  steps,
  className,
  size = "sm",
  spacing = "compact",
}: NumberedStepListProps) {
  if (steps.length === 0) return null;

  return (
    <ol
      className={cn(
        "list-decimal list-inside",
        size === "sm" ? "text-sm" : "text-base",
        spacing === "compact" ? "space-y-1" : "space-y-2.5",
        className
      )}
    >
      {steps.map((step, i) => (
        <li key={i} className="text-card-foreground leading-snug">
          {step}
        </li>
      ))}
    </ol>
  );
}
