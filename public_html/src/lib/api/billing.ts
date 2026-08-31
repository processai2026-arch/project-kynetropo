import { apiFetch } from "./client";

type Envelope<T> = { success: boolean; message: string; data: T };

export type BillingCycle = "monthly" | "yearly";
export type LifecycleAction = "change_plan" | "cancel" | "resume";

export interface BillingPlan {
  code: string;
  name: string;
  price_monthly: number;
  price_yearly: number;
  currency: string;
}

export interface BillingSubscription {
  subscription_id: number;
  status: string;
  billing_cycle: BillingCycle;
  trial_ends_at: string | null;
  current_start: string | null;
  current_end: string | null;
  cancel_at_end: boolean;
  trial_days_left: number | null;
}

export interface ScheduledLifecycleChange {
  event_id: number;
  action: LifecycleAction;
  reason: string;
  effective_at: string;
  billing_cycle: BillingCycle;
  plan_code: string | null;
  plan_name: string | null;
}

export interface BillingSummary {
  billing_enabled: boolean;
  razorpay_key_id: string | null;
  tenant_status: string | null;
  subscription: BillingSubscription | null;
  plan: BillingPlan | null;
  all_plans: BillingPlan[];
  scheduled_change: ScheduledLifecycleChange | null;
}

export interface BillingPayment {
  payment_id: number;
  billing_invoice_id: number | null;
  gateway: string;
  gateway_ref: string;
  amount: number;
  currency: string;
  status: string;
  paid_at: string | null;
  created_at: string;
}

export interface BillingInvoice {
  billing_invoice_id: number;
  number: string;
  amount: number;
  tax: number;
  total: number;
  currency: string;
  status: string;
  period_start: string | null;
  period_end: string | null;
  due_at: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface LifecycleEvent {
  event_id: number;
  action: LifecycleAction;
  from_status: string;
  to_status: string;
  billing_cycle: BillingCycle;
  reason: string;
  effective_at: string;
  applied_at: string | null;
  status: "scheduled" | "applied" | "superseded";
  from_plan: string | null;
  to_plan: string | null;
}

export interface BillingHistory {
  payments: BillingPayment[];
  invoices: BillingInvoice[];
  lifecycle: LifecycleEvent[];
}

export interface PlatformBillingMetrics {
  mrr: number;
  arr: number;
  active_subscriptions: number;
  churn_rate: number;
  churned_30d: number;
  captured_payments_30d: number;
  currency: string;
  period_days: number;
}

export interface CheckoutOrder {
  activated?: boolean;
  order_id?: string;
  amount?: number;
  currency?: string;
  key_id?: string;
  name?: string;
  prefill?: { email: string; name: string; contact: string };
}

export interface LifecycleResult {
  event_id: number;
  status: "applied" | "scheduled";
  effective_at: string;
}

const post = <T>(path: string, body: object) => apiFetch<Envelope<T>>(path, {
  method: "POST",
  skipCache: true,
  body: JSON.stringify(body),
}).then((response) => response.data);

export const billingApi = {
  summary: () => apiFetch<Envelope<BillingSummary>>("/admin/billing", { skipCache: true }).then((response) => response.data),
  history: (limit = 50) => apiFetch<Envelope<BillingHistory>>(`/admin/billing/history?limit=${limit}`, { skipCache: true }).then((response) => response.data),
  subscribe: (planCode: string, billingCycle: BillingCycle) => post<CheckoutOrder>("/admin/billing/subscribe", { plan_code: planCode, billing_cycle: billingCycle }),
  changePlan: (planCode: string, billingCycle: BillingCycle, reason: string, effectiveDate: string) =>
    post<LifecycleResult>("/admin/billing/change-plan", { plan_code: planCode, billing_cycle: billingCycle, reason, effective_date: effectiveDate }),
  cancel: (reason: string, effectiveDate: string) => post<LifecycleResult>("/admin/billing/cancel", { reason, effective_date: effectiveDate }),
  resume: (reason: string, effectiveDate: string) => post<LifecycleResult>("/admin/billing/resume", { reason, effective_date: effectiveDate }),
  platformMetrics: () => apiFetch<Envelope<PlatformBillingMetrics>>("/platform/billing/metrics", { skipCache: true }).then((response) => response.data),
};

