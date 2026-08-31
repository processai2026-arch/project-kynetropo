import { cn } from "@/lib/utils";

interface DialogSectionSubheaderProps {
  children: React.ReactNode;
  className?: string;
}

export function DialogSectionSubheader({
  children,
  className,
}: DialogSectionSubheaderProps) {
  return (
    <p
      className={cn(
        "text-xs font-semibold text-muted-foreground uppercase mb-2",
        className
      )}
    >
      {children}
    </p>
  );
}
