import { cn } from "@/lib/utils";

interface PanelCardProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function PanelCard({ title, icon, children, action, className }: PanelCardProps) {
  return (
    <div className={cn("rounded-xl border bg-card shadow-sm", className)}>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2 font-semibold text-card-foreground text-sm">
          {icon}
          {title}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}
