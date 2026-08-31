import React from "react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { ResponsiveContainer } from "recharts";

interface ChartCardWithHeaderProps {
  icon: LucideIcon;
  title: string;
  isEmpty: boolean;
  emptyMessage?: string;
  emptyHeight?: string;
  children: React.ReactNode;
}

export function ChartCardWithHeader({
  icon: Icon,
  title,
  isEmpty,
  emptyMessage = "No data available",
  emptyHeight = "h-48",
  children,
}: ChartCardWithHeaderProps) {
  return (
    <div className="bg-card rounded-xl border p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-semibold text-sm text-card-foreground">{title}</h3>
      </div>
      {isEmpty ? (
        <div
          className={cn(
            "flex items-center justify-center text-muted-foreground text-sm",
            emptyHeight
          )}
        >
          {emptyMessage}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          {children as React.ReactElement}
        </ResponsiveContainer>
      )}
    </div>
  );
}
