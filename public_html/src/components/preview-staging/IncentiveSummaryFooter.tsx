import { inr } from "@/lib/currency";

export interface IncentiveSummaryFooterProps {
  /** Configured monthly incentive amount (0 = no rate set) */
  monthlyRate: number;
  /** Amount earned so far this month */
  earned: number;
}

export function IncentiveSummaryFooter({ monthlyRate, earned }: IncentiveSummaryFooterProps) {
  return (
    <div className="pt-2 border-t text-xs text-muted-foreground space-y-1">
      <div className="flex justify-between">
        <span>Incentive if targets met</span>
        <span className="text-card-foreground font-medium">{inr(monthlyRate)}</span>
      </div>

      <div className="flex justify-between font-semibold text-emerald-600 pt-1 border-t">
        <span>Earned this month</span>
        <span>{inr(earned)}</span>
      </div>

      {monthlyRate === 0 ? (
        <p className="pt-1 text-xs text-amber-600">
          No incentive set — configure in Settings.
        </p>
      ) : earned === 0 ? (
        <p className="pt-1 text-xs text-muted-foreground">
          Targets not all met yet.
        </p>
      ) : null}
    </div>
  );
}

export default IncentiveSummaryFooter;
