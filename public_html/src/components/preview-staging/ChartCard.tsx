import { cn } from "@/lib/utils";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  headerRight?: React.ReactNode;
  className?: string;
  padding?: "sm" | "md" | "lg";
}

const PADDING: Record<string, string> = { sm: "p-4", md: "p-5", lg: "p-6" };

export function ChartCard({ title, subtitle, children, headerRight, className, padding = "md" }: ChartCardProps) {
  return (
    <div className={cn("bg-card rounded-xl border shadow-sm", PADDING[padding], className)}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-card-foreground">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {headerRight}
      </div>
      {children}
    </div>
  );
}
