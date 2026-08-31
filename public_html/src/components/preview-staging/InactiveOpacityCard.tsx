import { cn } from "@/lib/utils";

interface InactiveOpacityCardProps {
  active: boolean;
  children: React.ReactNode;
  className?: string;
}

export function InactiveOpacityCard({
  active,
  children,
  className,
}: InactiveOpacityCardProps) {
  return (
    <div
      className={cn(
        "bg-card rounded-xl border border-border p-4 transition-opacity duration-200",
        !active && "opacity-50",
        className
      )}
    >
      {children}
    </div>
  );
}
