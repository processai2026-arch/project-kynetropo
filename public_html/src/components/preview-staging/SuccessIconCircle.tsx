import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SuccessIconCircleProps {
  icon: LucideIcon;
  size?: "sm" | "md" | "lg";
}

const containerSizes: Record<string, string> = {
  sm: "h-12 w-12",
  md: "h-16 w-16",
  lg: "h-20 w-20",
};

const iconSizes: Record<string, string> = {
  sm: "h-6 w-6",
  md: "h-8 w-8",
  lg: "h-10 w-10",
};

export function SuccessIconCircle({ icon: Icon, size = "md" }: SuccessIconCircleProps) {
  return (
    <div
      className={cn(
        "rounded-full bg-primary/10 flex items-center justify-center shrink-0",
        containerSizes[size]
      )}
    >
      <Icon className={cn("text-primary", iconSizes[size])} />
    </div>
  );
}
