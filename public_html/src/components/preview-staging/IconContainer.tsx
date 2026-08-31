import { cn } from "@/lib/utils";

interface IconContainerProps {
  icon: React.ElementType;
  size?: "sm" | "md";
  className?: string;
}

const sizeMap: Record<"sm" | "md", { container: string; iconSize: string }> = {
  sm: { container: "h-8 w-8", iconSize: "h-4 w-4" },
  md: { container: "h-10 w-10", iconSize: "h-5 w-5" },
};

export function IconContainer({ icon: Icon, size = "md", className }: IconContainerProps) {
  const { container, iconSize } = sizeMap[size];
  return (
    <div
      className={cn(
        "rounded-lg bg-primary/10 flex items-center justify-center shrink-0",
        container,
        className
      )}
    >
      <Icon className={cn("text-primary", iconSize)} />
    </div>
  );
}
