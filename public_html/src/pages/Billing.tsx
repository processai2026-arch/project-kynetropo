import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { BRAND } from "@/brand";
import { billingApi, type BillingCycle, type BillingHistory, type BillingPlan, type BillingSummary, type LifecycleAction } from "@/lib/api/billing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

declare global { interface Window { Razorpay?: any } }

type LifecycleDialog = { action: LifecycleAction; plan?: BillingPlan } | null;

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

const today = () => new Date().toISOString().slice(0, 10);
const displayDate = (value?: string | null) => value ? new Date(value).toLocaleDateString() : "—";
const titleCase = (value: string) => value.split("_").join(" ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function Billing() {
  const [data, setData] = useState<BillingSummary | null>(null);
  const [history, setHistory] = useState<BillingHistory>({ payments: [], invoices: [], lifecycle: [] });
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [busy, setBusy] = useState<string | null>(null);
  const [dialog, setDialog] = useState<LifecycleDialog>(null);
  const [reason, setReason] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(today());

  const load = useCallback(async () => {
    try {
      const [summary, billingHistory] = await Promise.all([billingApi.summary(), billingApi.history()]);
      setData(summary);
      setHistory(billingHistory);
      if (summary.subscription?.billing_cycle) setCycle(summary.subscription.billing_cycle);
    } catch (error: any) {
      toast.error(error?.message ?? "Could not load billing");
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const subscribe = async (plan: BillingPlan) => {
    setBusy(plan.code);
    try {
      const checkout = await billingApi.subscribe(plan.code, cycle);
      if (checkout.activated) { toast.success("Plan activated"); await load(); return; }
      if (!checkout.order_id || !checkout.key_id || !checkout.amount || !checkout.currency) throw new Error("Checkout response is incomplete");
      if (!(await loadRazorpay())) throw new Error("Could not load payment gateway");
      const razorpay = new window.Razorpay({
        key: checkout.key_id, order_id: checkout.order_id, amount: checkout.amount, currency: checkout.currency,
        name: BRAND.name, description: `${checkout.name ?? plan.name} plan (${cycle})`, prefill: checkout.prefill,
        theme: { color: "#2ea0da" },
        handler: () => { toast.success("Payment received — activating your plan…"); setTimeout(() => void load(), 3500); },
        modal: { ondismiss: () => setBusy(null) },
      });
      razorpay.open();
    } catch (error: any) {
      toast.error(error?.message ?? "Could not start checkout");
    } finally {
      setBusy(null);
    }
  };

  const openLifecycle = (action: LifecycleAction, plan?: BillingPlan) => {
    setReason("");
    setEffectiveDate(action === "cancel" && data?.subscription?.current_end ? data.subscription.current_end.slice(0, 10) : today());
    setDialog({ action, plan });
  };

  const submitLifecycle = async () => {
    if (!dialog || !reason.trim()) return;
    setBusy(dialog.action);
    try {
      const result = dialog.action === "change_plan" && dialog.plan
        ? await billingApi.changePlan(dialog.plan.code, cycle, reason.trim(), effectiveDate)
        : dialog.action === "cancel"
          ? await billingApi.cancel(reason.trim(), effectiveDate)
          : await billingApi.resume(reason.trim(), effectiveDate);
      toast.success(result.status === "scheduled" ? `Change scheduled for ${displayDate(result.effective_at)}` : "Subscription updated");
      setDialog(null);
      await load();
    } catch (error: any) {
      toast.error(error?.message ?? "Could not update subscription");
    } finally {
      setBusy(null);
    }
  };

  if (!data) return <div className="p-6 text-muted-foreground">Loading billing…</div>;

  const sub = data.subscription;
  const plan = data.plan;
  const money = (amount: number, currency = "INR") => amount === 0 ? "Free" : new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(Number(amount));
  const statusColor: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-700", trialing: "bg-blue-100 text-blue-700",
    past_due: "bg-amber-100 text-amber-700", suspended: "bg-red-100 text-red-700", cancelled: "bg-gray-200 text-gray-700",
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Billing & Subscription</h1>
        <p className="text-sm text-muted-foreground">Manage your {BRAND.name} plan and billing history.</p>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-sm text-muted-foreground">Current plan</div>
            <div className="text-xl font-semibold">{plan?.name ?? "—"}</div>
            <div className="mt-1 text-sm text-muted-foreground">{sub?.billing_cycle ? `${titleCase(sub.billing_cycle)} billing` : "No billing cycle"}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusColor[data.tenant_status ?? ""] ?? "bg-muted"}`}>{data.tenant_status ?? "unknown"}</span>
            {(sub?.status === "cancelled" || sub?.cancel_at_end) && <Button size="sm" onClick={() => openLifecycle("resume")}>Resume</Button>}
            {sub && sub.status !== "cancelled" && !sub.cancel_at_end && <Button size="sm" variant="outline" onClick={() => openLifecycle("cancel")}>Cancel subscription</Button>}
          </div>
        </div>
        {sub?.status === "trialing" && sub.trial_days_left != null && <p className="mt-3 text-sm text-amber-600">Free trial — {sub.trial_days_left} day{sub.trial_days_left === 1 ? "" : "s"} left.</p>}
        {sub?.current_end && sub.status === "active" && !sub.cancel_at_end && <p className="mt-3 text-sm text-muted-foreground">Renews on {displayDate(sub.current_end)}.</p>}
        {sub?.cancel_at_end && <p className="mt-3 text-sm text-amber-700">Cancellation scheduled. Access remains active until the effective date.</p>}
        {data.scheduled_change && (
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            Scheduled: {titleCase(data.scheduled_change.action)}{data.scheduled_change.plan_name ? ` to ${data.scheduled_change.plan_name}` : ""} on {displayDate(data.scheduled_change.effective_at)}. Reason: {data.scheduled_change.reason}
          </div>
        )}
      </div>

      {!data.billing_enabled && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">Online payments aren't enabled yet. Paid checkout requires Razorpay configuration.</div>}

      <div className="inline-flex rounded-lg border bg-card p-1 text-sm">
        {(["monthly", "yearly"] as const).map((value) => <button key={value} onClick={() => setCycle(value)} className={`rounded-md px-4 py-1.5 font-medium capitalize ${cycle === value ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{value}</button>)}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {data.all_plans.map((item) => {
          const isCurrent = plan?.code === item.code && sub?.billing_cycle === cycle;
          const price = cycle === "monthly" ? item.price_monthly : item.price_yearly;
          const needsCheckout = sub?.status !== "active" && Number(price) > 0;
          return (
            <div key={item.code} className={`flex flex-col rounded-xl border p-5 ${isCurrent ? "border-primary ring-1 ring-primary/30" : ""}`}>
              <h3 className="font-semibold">{item.name}</h3>
              <div className="mt-2 text-2xl font-bold">{money(Number(price), item.currency)}{Number(price) > 0 && <span className="text-sm font-normal text-muted-foreground">/{cycle === "monthly" ? "mo" : "yr"}</span>}</div>
              <Button className="mt-4" disabled={isCurrent || busy === item.code || (needsCheckout && !data.billing_enabled)} onClick={() => needsCheckout ? void subscribe(item) : openLifecycle("change_plan", item)}>
                {isCurrent ? "Current plan" : busy === item.code ? "Starting…" : needsCheckout ? "Subscribe" : "Change plan"}
              </Button>
            </div>
          );
        })}
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Invoices</h2>
        <div className="rounded-xl border bg-card">
          <Table><TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Date</TableHead><TableHead>Period</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
            <TableBody>{history.invoices.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No invoices yet.</TableCell></TableRow> : history.invoices.map((invoice) => <TableRow key={invoice.billing_invoice_id}><TableCell className="font-medium">{invoice.number}</TableCell><TableCell>{displayDate(invoice.created_at)}</TableCell><TableCell>{displayDate(invoice.period_start)} – {displayDate(invoice.period_end)}</TableCell><TableCell>{titleCase(invoice.status)}</TableCell><TableCell className="text-right">{money(invoice.total, invoice.currency)}</TableCell></TableRow>)}</TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Payments</h2>
        <div className="rounded-xl border bg-card">
          <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Gateway</TableHead><TableHead>Reference</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
            <TableBody>{history.payments.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No payments yet.</TableCell></TableRow> : history.payments.map((payment) => <TableRow key={payment.payment_id}><TableCell>{displayDate(payment.paid_at ?? payment.created_at)}</TableCell><TableCell>{titleCase(payment.gateway)}</TableCell><TableCell className="font-mono text-xs">{payment.gateway_ref}</TableCell><TableCell>{titleCase(payment.status)}</TableCell><TableCell className="text-right">{money(payment.amount, payment.currency)}</TableCell></TableRow>)}</TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Subscription activity</h2>
        <div className="rounded-xl border bg-card">
          <Table><TableHeader><TableRow><TableHead>Effective date</TableHead><TableHead>Action</TableHead><TableHead>Change</TableHead><TableHead>Reason</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>{history.lifecycle.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No subscription changes yet.</TableCell></TableRow> : history.lifecycle.map((event) => <TableRow key={event.event_id}><TableCell>{displayDate(event.effective_at)}</TableCell><TableCell>{titleCase(event.action)}</TableCell><TableCell>{event.from_plan && event.to_plan ? `${event.from_plan} → ${event.to_plan}` : `${titleCase(event.from_status)} → ${titleCase(event.to_status)}`}</TableCell><TableCell className="max-w-xs whitespace-normal">{event.reason}</TableCell><TableCell>{titleCase(event.status)}</TableCell></TableRow>)}</TableBody>
          </Table>
        </div>
      </section>

      <Dialog open={!!dialog} onOpenChange={(open) => !open && busy === null && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog?.action === "change_plan" ? `Change to ${dialog.plan?.name}` : dialog?.action === "cancel" ? "Cancel subscription" : "Resume subscription"}</DialogTitle>
            <DialogDescription>The reason and effective date are retained in the billing audit history.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <label className="block space-y-1.5"><span className="text-sm font-medium">Effective date</span><Input type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} /></label>
            <label className="block space-y-1.5"><span className="text-sm font-medium">Reason</span><Textarea maxLength={500} rows={4} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Required" /></label>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialog(null)} disabled={busy !== null}>Keep current subscription</Button><Button variant={dialog?.action === "cancel" ? "destructive" : "default"} disabled={!reason.trim() || !effectiveDate || busy !== null} onClick={() => void submitLifecycle()}>{busy ? "Saving…" : dialog?.action === "cancel" ? "Confirm cancellation" : "Save change"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
