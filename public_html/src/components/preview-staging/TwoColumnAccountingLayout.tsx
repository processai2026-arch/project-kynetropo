import { cn } from "@/lib/utils";

interface TwoColumnAccountingLayoutProps {
  left: React.ReactNode;
  right: React.ReactNode;
  className?: string;
}

export function TwoColumnAccountingLayout({
  left,
  right,
  className,
}: TwoColumnAccountingLayoutProps) {
  return (
    <div className={cn("grid grid-cols-1 lg:grid-cols-2 gap-6", className)}>
      <div className="space-y-4">{left}</div>
      <div className="space-y-4">{right}</div>
    </div>
  );
}
