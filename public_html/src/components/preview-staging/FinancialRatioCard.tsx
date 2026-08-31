import React from "react";
import { cn } from "@/lib/utils";

interface FinancialRatioCardProps {
  icon: React.ElementType;
  label: string;
  hint: string;
  benchmark: string;
  value: string | null;
  ok: boolean | null;
}

export function FinancialRatioCard({
  icon: Icon,
  label,
  hint,
  benchmark,
  value,
  ok,
}: FinancialRatioCardProps) {
  const isUnavailable = value === null || ok === null;

  if (isUnavailable) {
    return (
      <div className="bg-card rounded-xl border p-5 shadow-sm">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-muted text-muted-foreground">
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium text-card-foreground">{label}</p>
              <p className="text-xs text-muted-foreground">{hint}</p>
            </div>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            No input
          </span>
        </div>
        <div className="text-2xl font-bold text-muted-foreground">Not available</div>
        <p className="text-xs text-muted-foreground mt-1">
          Enter balance-sheet config to compute this
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border p-5 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "p-2 rounded-lg",
              ok
                ? "bg-primary/10 text-primary"
                : "bg-destructive/10 text-destructive"
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-medium text-card-foreground">{label}</p>
            <p className="text-xs text-muted-foreground">{hint}</p>
          </div>
        </div>
        <span
          className={cn(
            "text-xs px-2 py-0.5 rounded-full",
            ok
              ? "bg-primary/10 text-primary"
              : "bg-destructive/10 text-destructive"
          )}
        >
          {ok ? "Healthy" : "Watch"}
        </span>
      </div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      <p className="text-xs text-muted-foreground mt-1">{benchmark}</p>
    </div>
  );
}
