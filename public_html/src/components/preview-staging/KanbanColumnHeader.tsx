import React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export type DealStage =
  | "lead"
  | "qualified"
  | "proposal"
  | "negotiation"
  | "won"
  | "lost";

function inr(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export interface KanbanColumnHeaderProps {
  stage: DealStage;
  stageLabel: string;
  stageColorClass: string;
  dealCount: number;
  totalValue: number;
  children: React.ReactNode;
}

export function KanbanColumnHeader({
  stage,
  stageLabel,
  stageColorClass,
  dealCount,
  totalValue,
  children,
}: KanbanColumnHeaderProps) {
  return (
    <div
      className={cn(
        "w-72 shrink-0 rounded-xl border-t-4 bg-card border shadow-sm",
        stageColorClass
      )}
      data-stage={stage}
    >
      <div className="p-3 border-b">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm text-card-foreground">
            {stageLabel}
          </h3>
          <Badge variant="outline">{dealCount}</Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{inr(totalValue)}</p>
      </div>
      <div className="p-2 space-y-2 max-h-[60vh] overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
