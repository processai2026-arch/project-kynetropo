import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepperProps {
  steps: string[];
  currentStep: number;
  className?: string;
}

export function Stepper({ steps, currentStep, className }: StepperProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {steps.map((label, i) => (
        <div key={label} className="flex flex-1 items-center gap-2">
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
              i <= currentStep
                ? "border-primary bg-primary text-primary-foreground"
                : "border-muted text-muted-foreground"
            )}
          >
            {i < currentStep ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
          </div>
          <span className={cn("text-sm", i === currentStep ? "font-medium text-foreground" : "text-muted-foreground")}>
            {label}
          </span>
          {i < steps.length - 1 && <div className="h-px flex-1 bg-border" />}
        </div>
      ))}
    </div>
  );
}
