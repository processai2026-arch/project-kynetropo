import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface IconLabelBodyRowProps {
  icon: ReactNode;
  label: string;
  body: string;
  className?: string;
}

export function IconLabelBodyRow({ icon, label, body, className }: IconLabelBodyRowProps) {
  return (
    <div className={cn("flex-1 min-w-0", className)}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <h3 className="font-medium text-card-foreground">{label}</h3>
      </div>
      <p className="text-sm text-muted-foreground ml-6">{body}</p>
    </div>
  );
}
