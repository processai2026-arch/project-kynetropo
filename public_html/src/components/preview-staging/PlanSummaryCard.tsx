import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BillingSubscription, ScheduledLifecycleChange } from "@/lib/api/billing";

export type Subscription = BillingSubscription;
export type ScheduledChange = ScheduledLifecycleChange;

export interface PlanSummaryCardProps {
  planName?: string;
  billingCycle?: string;
  tenantStatus?: string;
  sub: Subscription | null;
  scheduledChange?: ScheduledChange | null;
  onResume: () => void;
  onCancel: () => void;
}

const STATUS_BADGE_STYLES: Record<string, string> = {
  active:    "bg-emerald-50 text-emerald-700 border-emerald-200",
  trialing:  "bg-blue-50 text-blue-700 border-blue-200",
  past_due:  "bg-amber-50 text-amber-700 border-amber-200",
  suspended: "bg-red-50 text-red-600 border-red-200",
  cancelled: "bg-gray-100 text-gray-500 border-gray-200",
};

function SubscriptionStatusPill({ status }: { status: string }) {
  return (
    <Badge
      className={cn(
        "border capitalize",
        STATUS_BADGE_STYLES[status] ?? "bg-muted text-muted-foreground border-border"
      )}
    >
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

const titleCase = (value: string) =>
  value.split("_").join(" ").replace(/\b\w/g, (l) => l.toUpperCase());

const displayDate = (value?: string | null): string =>
  value ? new Date(value).toLocaleDateString() : "—";

export function PlanSummaryCard({
  planName,
  billingCycle,
  tenantStatus,
  sub,
  scheduledChange,
  onResume,
  onCancel,
}: PlanSummaryCardProps) {
  const showResume = sub?.status === "cancelled" || !!sub?.cancel_at_end;
  const showCancel = !!sub && sub.status !== "cancelled" && !sub.cancel_at_end;
  const showTrialNotice = sub?.status === "trialing" && sub.trial_days_left != null;
  const showRenewalNotice =
    !!sub?.current_end && sub.status === "active" && !sub.cancel_at_end;
  const showCancelNotice = !!sub?.cancel_at_end;

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm text-muted-foreground">Current plan</div>
          <div className="text-xl font-semibold text-card-foreground">
            {planName ?? "—"}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            {billingCycle ? `${titleCase(billingCycle)} billing` : "No billing cycle"}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {tenantStatus && <SubscriptionStatusPill status={tenantStatus} />}
          {showResume && (
            <Button size="sm" onClick={onResume}>
              Resume
            </Button>
          )}
          {showCancel && (
            <Button size="sm" variant="outline" onClick={onCancel}>
              Cancel subscription
            </Button>
          )}
        </div>
      </div>

      {showTrialNotice && (
        <p className="mt-3 text-sm text-amber-600">
          Free trial — {sub!.trial_days_left} day
          {sub!.trial_days_left === 1 ? "" : "s"} left.
        </p>
      )}

      {showRenewalNotice && (
        <p className="mt-3 text-sm text-muted-foreground">
          Renews on {displayDate(sub!.current_end)}.
        </p>
      )}

      {showCancelNotice && (
        <p className="mt-3 text-sm text-amber-700">
          Cancellation scheduled. Access remains active until the effective date.
        </p>
      )}

      {scheduledChange && (
        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          Scheduled: {titleCase(scheduledChange.action)}
          {scheduledChange.plan_name ? ` to ${scheduledChange.plan_name}` : ""} on{" "}
          {displayDate(scheduledChange.effective_at)}. Reason: {scheduledChange.reason}
        </div>
      )}
    </div>
  );
}
