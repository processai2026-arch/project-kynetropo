/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState, type ReactNode } from "react";
import { ActionDialog } from "@/components/ActionDialog";
import { Field, NativeSelect } from "@/components/Field";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { opsAmcApi } from "@/lib/api/ops";
import { formatDate, parseDate, toIsoDate, todayIso } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AmcUserPlan, OpsAmcPlan, OpsAmcPlanBody, OpsAmcRecord } from "@/types/ops";
import { Download, ExternalLink, Plus, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { rupees } from "@/pages/crm/components/crm";
import { PAYMENT_MODES } from "@/pages/crm/components/PaymentDialog";

/** The same day a year later: what an AMC renews on. */
export function yearAfter(iso: string): string {
  const d = parseDate(iso);
  if (!d) return "";
  return toIsoDate(new Date(d.getFullYear() + 1, d.getMonth(), d.getDate()));
}

export const AMC_STATUS_STYLES: Record<string, string> = {
  active:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  due:     "bg-amber-50 text-amber-600 border-amber-200",
  overdue: "bg-red-50 text-red-600 border-red-200",
};

export function AmcStatusBadge({ status }: { status: string }) {
  const label = status === "due" ? "Due soon" : status;
  return <Badge className={cn("border capitalize", AMC_STATUS_STYLES[status] ?? "bg-muted text-muted-foreground")}>{label}</Badge>;
}

/** Where the current year stands: the free first year, paid, or not paid yet. */
export function AmcYearBadge({ amc }: { amc: OpsAmcRecord }) {
  if (!amc.term_paid) return <Badge className="border bg-red-50 text-red-600 border-red-200">Not paid</Badge>;
  if (amc.in_free_year) return <Badge className="border bg-sky-50 text-sky-700 border-sky-200">1st year free</Badge>;
  return <Badge className="border bg-emerald-50 text-emerald-700 border-emerald-200">Paid</Badge>;
}

/** "From 2nd year" / "From 1st year". */
export const amcPlanLabel = (amc: Pick<OpsAmcRecord, "first_year_free">) => amc.first_year_free ? "From 2nd year" : "From 1st year";

/** "In 12 days", "Today", "5 days overdue". */
export function dueText(days: number | null): ReactNode {
  if (days == null) return "—";
  if (days < 0) return <span className="text-red-600 font-medium">{Math.abs(days)}d overdue</span>;
  if (days === 0) return <span className="text-amber-600 font-medium">Today</span>;
  return <span className={days <= 30 ? "text-amber-600" : "text-muted-foreground"}>in {days}d</span>;
}

/** Buttons that act as one choice, for the AMC questions. */
function Choice<T extends string>({ value, onChange, options, label, disabled }: {
  value: T | null;
  onChange: (v: T) => void;
  options: { value: T; label: string; hint?: string }[];
  label: string;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("grid grid-cols-1 gap-2", options.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md border px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60",
            value === o.value ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50",
          )}
        >
          <span className="block font-medium text-card-foreground">{o.label}</span>
          {o.hint && <span className="block text-xs text-muted-foreground">{o.hint}</span>}
        </button>
      ))}
    </div>
  );
}

// ─── The AMC answer, shared by the AMC dialog and the project form ──────────

export interface AmcDraft {
  plan: OpsAmcPlan | null;
  amount: string;
  start_date: string;
  renewal_date: string;
  /** The renewal date was set by hand, so it no longer follows the start. */
  renewalTouched: boolean;
  paid: "yes" | "no" | null;
  payment_date: string;
  payment_mode: string;
  notes: string;
  /** Why: no AMC (offline setup…), or from the 1st / 2nd year. */
  reason: string;
  /** Storage the base price includes, the size of an extra block, and its price a year. */
  storage_gb: string;
  storage_step_gb: string;
  storage_step_price: string;
  /** Storage in use now (GB). */
  storage_used_gb: string;
  /** Users by category: in the base, per extra block, the block's price, and now. */
  users: UserDraft[];
}

export interface UserDraft { category: string; included: string; step: string; price: string; users: string }

/** Categories offered with one tap; any other can be typed. */
export const USER_CATEGORIES = ["ERP", "Web APK", "Mobile app", "Website"] as const;

/** Reasons for no AMC, offered as choices; anything else is typed. */
export const NO_AMC_REASONS = ["Offline setup", "Installation cost paid offline"] as const;

/** Extra blocks started: 7 users with 5 included at 1 a block -> 2; at 5 a block -> 1. */
function blocks(now: number, included: number, step: number): number {
  if (!(step > 0) || !(now > included)) return 0;
  return Math.ceil((now - included) / step - 1e-9);
}

/** What one category of users adds a year, now. */
export function userExtra(u: Pick<AmcUserPlan, "included" | "step" | "price" | "users">): number {
  return blocks(u.users, u.included, u.step) * u.price;
}

/** The parts of an AMC's yearly price: base, users by category, storage. */
export function amcBreakdown(a: {
  base: number; users: AmcUserPlan[];
  storage_gb: number | null; storage_step_gb: number | null; storage_step_price: number | null; storage_used_gb: number | null;
}) {
  const users = a.users.map((u) => ({ ...u, extra: userExtra(u) }));
  const storage = a.storage_gb && a.storage_step_gb && a.storage_used_gb != null
    ? blocks(a.storage_used_gb, a.storage_gb, a.storage_step_gb) * (a.storage_step_price ?? 0) : 0;
  const total = a.base + users.reduce((s, u) => s + u.extra, 0) + storage;
  return { users, storage, total };
}

const recordBreakdown = (amc: OpsAmcRecord) => amcBreakdown({
  base: amc.base_amount ?? amc.amount, users: amc.user_plans ?? [],
  storage_gb: amc.storage_gb, storage_step_gb: amc.storage_step_gb, storage_step_price: amc.storage_step_price, storage_used_gb: amc.storage_used_gb,
});

/** The AMC a year when the customer uses `usedGb`: the base, plus each extra block started. */
export function amcForStorage(base: number, includedGb: number, stepGb: number, stepPrice: number, usedGb: number): number {
  if (!(includedGb > 0) || !(stepGb > 0) || usedGb <= includedGb) return base;
  return base + Math.ceil((usedGb - includedGb) / stepGb) * stepPrice;
}

const gb = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)} GB`;
const num = (v: number | null | undefined) => (v == null ? "" : String(v));

/** A draft from a saved AMC, or a blank one (plan unanswered) for a new AMC. */
export function amcDraft(amc: OpsAmcRecord | null | undefined, start = todayIso()): AmcDraft {
  if (!amc) {
    return { plan: null, amount: "", start_date: start, renewal_date: yearAfter(start), renewalTouched: false,
             paid: null, payment_date: todayIso(), payment_mode: "bank_transfer", notes: "",
             reason: "", storage_gb: "", storage_step_gb: "", storage_step_price: "", storage_used_gb: "", users: [] };
  }
  return {
    plan: amc.plan,
    // The form asks the base; the yearly price is worked out from it.
    amount: String(amc.base_amount ?? amc.amount),
    start_date: amc.start_date,
    renewal_date: amc.renewal_date,
    renewalTouched: amc.renewal_date !== yearAfter(amc.start_date),
    paid: amc.first_year_free ? null : amc.term_paid ? "yes" : "no",
    payment_date: amc.paid_on ?? todayIso(),
    payment_mode: amc.payment_mode || "bank_transfer",
    notes: amc.notes ?? "",
    reason: amc.reason ?? "",
    storage_gb: num(amc.storage_gb),
    storage_step_gb: num(amc.storage_step_gb),
    storage_step_price: num(amc.storage_step_price),
    storage_used_gb: num(amc.storage_used_gb),
    users: (amc.user_plans ?? []).map((u) => ({ category: u.category, included: String(u.included), step: String(u.step), price: String(u.price), users: String(u.users) })),
  };
}

/** The draft's user rows as numbers, for working out the price. */
const draftUsers = (d: AmcDraft): AmcUserPlan[] => d.users.map((u) => ({
  category: u.category.trim(), included: Number(u.included) || 0, step: Number(u.step) || 1,
  price: Number(u.price) || 0, users: u.users.trim() === "" ? Number(u.included) || 0 : Number(u.users) || 0,
}));

/** The draft's yearly price: base, users and storage in use. */
export function draftBreakdown(d: AmcDraft) {
  const storage = Number(d.storage_gb) > 0;
  return amcBreakdown({
    base: Number(d.amount) || 0, users: draftUsers(d),
    storage_gb: storage ? Number(d.storage_gb) : null, storage_step_gb: storage ? Number(d.storage_step_gb) : null,
    storage_step_price: storage ? Number(d.storage_step_price) : null,
    storage_used_gb: storage && d.storage_used_gb.trim() !== "" ? Number(d.storage_used_gb) : null,
  });
}

/**
 * What is still missing or wrong, in words; null when the answer can be saved.
 * The reason is asked whenever the answer is given or changed.
 */
export function amcDraftProblem(d: AmcDraft, { requireReason = true }: { requireReason?: boolean } = {}): string | null {
  if (!d.plan) return "Choose the AMC: from the 2nd year, from the 1st year, or no AMC";
  if (requireReason && !d.reason.trim()) return d.plan === "none" ? "Choose why there is no AMC" : "Say why the AMC is from the " + (d.plan === "first_year" ? "1st" : "2nd") + " year";
  if (d.plan === "none") return null;
  if (Number(d.storage_gb) > 0 && !(Number(d.storage_step_gb) > 0 && d.storage_step_price.trim() !== "")) {
    return "Enter how many GB each extra block adds, and its price a year";
  }
  const seen = new Set<string>();
  for (const u of d.users) {
    const name = u.category.trim();
    if (!name) return "Name each user category — ERP, Web APK…";
    if (seen.has(name.toLowerCase())) return `${name} is listed twice`;
    seen.add(name.toLowerCase());
    if (u.included.trim() === "" || Number(u.included) < 0) return `Enter how many ${name} users the base price covers`;
    if (!(Number(u.step) >= 1)) return `Enter how many ${name} users make one extra block (1 for each user)`;
    if (u.price.trim() === "" || Number(u.price) < 0) return `Enter the price a year for each extra block of ${name} users`;
  }
  if (!(Number(d.amount) > 0)) return "Enter the AMC base price per year";
  if (!d.start_date || !d.renewal_date) return "Enter the AMC start and renewal dates";
  if (d.renewal_date <= d.start_date) return "The AMC renewal date must be after its start date";
  if (d.plan === "first_year" && !d.paid) return "Say whether the first year's AMC is paid";
  if (d.plan === "first_year" && d.paid === "yes" && !d.payment_date) return "Enter when the first year's AMC was paid";
  return null;
}

export function amcDraftBody(d: AmcDraft): OpsAmcPlanBody {
  if (!d.plan || d.plan === "none") return { plan: "none", reason: d.reason.trim() };
  const storage = Number(d.storage_gb) > 0;
  return {
    reason: d.reason.trim(),
    storage_gb: storage ? Number(d.storage_gb) : null,
    storage_step_gb: storage ? Number(d.storage_step_gb) : null,
    storage_step_price: storage ? Number(d.storage_step_price) : null,
    storage_used_gb: storage && d.storage_used_gb.trim() !== "" ? Number(d.storage_used_gb) : null,
    user_plans: draftUsers(d),
    plan: d.plan,
    amount: Number(d.amount),
    start_date: d.start_date,
    renewal_date: d.renewal_date,
    first_year_paid: d.plan === "first_year" && d.paid === "yes",
    payment_date: d.payment_date,
    payment_mode: d.payment_mode,
    notes: d.notes.trim(),
  };
}

/**
 * The AMC questions: from the 2nd year (first year free), from the 1st year
 * (paid or not yet), or no AMC; then the price per year and the dates. The
 * renewal date follows the start date (a year later) until set by hand.
 *
 * With `original` (editing), it says what the change does to Finance. Once a
 * contract has renewed, the first-year answers are history and are locked.
 */
export function AmcPlanFields({ draft, onChange, original, allowNone = true, showNotes = false, idPrefix = "amc" }: {
  draft: AmcDraft;
  onChange: (next: AmcDraft) => void;
  original?: OpsAmcRecord | null;
  allowNone?: boolean;
  showNotes?: boolean;
  idPrefix?: string;
}) {
  const set = (patch: Partial<AmcDraft>) => onChange({ ...draft, ...patch });
  const setStart = (v: string) => set({ start_date: v, renewal_date: draft.renewalTouched ? draft.renewal_date : yearAfter(v) });
  // "Other" picked for no AMC, before anything is typed.
  const [otherPicked, setOtherPicked] = useState(false);
  // The calculator's "if they use … GB": a what-if, not saved.
  const [usedGb, setUsedGb] = useState("");
  const presetReason = (NO_AMC_REASONS as readonly string[]).includes(draft.reason);
  const noAmcChoice = presetReason ? draft.reason : draft.reason || otherPicked ? "Other" : null;
  const locked = !!original?.renewed;
  const breakdown = draftBreakdown(draft);
  // The yearly price — base plus users and storage in use — is what Finance sees.
  const amount = breakdown.total;
  const price = Number(draft.amount) > 0 ? rupees(amount) : "The AMC";
  const datesOk = !!draft.start_date && !!draft.renewal_date && draft.renewal_date > draft.start_date;

  const plans: { value: OpsAmcPlan; label: string; hint: string }[] = [
    { value: "second_year", label: "AMC from 2nd year", hint: "First year free" },
    { value: "first_year", label: "AMC from 1st year", hint: "Charged from the start" },
    ...(allowNone ? [{ value: "none" as const, label: "No AMC", hint: "No maintenance contract" }] : []),
  ];

  // What saving does, Finance included.
  const hadPayment = !!original && !original.renewed && original.payment_id !== null;
  const willPay = draft.plan === "first_year" && draft.paid === "yes";
  const notes: ReactNode[] = [];
  if (draft.plan === "none") {
    if (original) notes.push(<>The AMC will be removed{hadPayment ? <>, and its first-year payment of {rupees(original.amount)} taken out of Finance</> : null}.</>);
  } else if (datesOk && !locked) {
    if (draft.plan === "second_year") notes.push(<>First year free. {price} is first due on <b>{formatDate(draft.renewal_date)}</b>, then every year.</>);
    if (willPay) notes.push(<>{price} for the first year is in Finance as an AMC payment. The next one is due on <b>{formatDate(draft.renewal_date)}</b>.</>);
    if (draft.plan === "first_year" && draft.paid === "no") notes.push(<>{price} is due from <b>{formatDate(draft.start_date)}</b>; it shows on the dashboard until collected.</>);
    if (hadPayment && !willPay) notes.push(<>The first-year payment of {rupees(original!.amount)} will be taken out of Finance.</>);
    if (!hadPayment && willPay && original) notes.push(<>Saving records {price} in Finance.</>);
    // Matches the server: more users or storage is next year's price, so the payment received keeps its amount.
    const usageNow = JSON.stringify([draftUsers(draft).map((u) => [u.category.toLowerCase(), u.users]).sort(), draft.storage_used_gb.trim() === "" ? null : Number(draft.storage_used_gb)]);
    const usageWas = original ? JSON.stringify([(original.user_plans ?? []).map((u) => [u.category.toLowerCase(), u.users]).sort(), original.storage_used_gb]) : usageNow;
    if (hadPayment && willPay && amount !== original!.amount) {
      notes.push(usageNow === usageWas
        ? <>The AMC payment in Finance changes to {price}.</>
        : <>Users or storage changed: {price} applies from the next payment. The {rupees(original!.amount)} already received stays.</>);
    }
  } else if (locked && datesOk) {
    notes.push(<>Renewed since it began on {formatDate(original!.contract_start)}. Price and dates can change; payments are in Finance.</>);
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="AMC" required className="sm:col-span-2" hint={locked ? "Fixed once the contract has renewed" : undefined}>
        <Choice<OpsAmcPlan> label="AMC" value={draft.plan} disabled={locked}
          onChange={(plan) => { setOtherPicked(false); set({ plan, paid: plan === "first_year" ? draft.paid : null, reason: plan === draft.plan ? draft.reason : "" }); }} options={plans} />
      </Field>

      {draft.plan === "none" && (
        <Field label="Why no AMC?" required className="sm:col-span-2">
          <div className="space-y-2">
            <Choice<string> label="Why no AMC?" value={noAmcChoice}
              onChange={(v) => { setOtherPicked(v === "Other"); set({ reason: v === "Other" ? "" : v }); }}
              options={[...NO_AMC_REASONS.map((r) => ({ value: r as string, label: r })), { value: "Other", label: "Other" }]} />
            {noAmcChoice === "Other" && (
              <Input id={`${idPrefix}-reason`} autoFocus aria-label="Why no AMC" placeholder="The reason" value={draft.reason} maxLength={300}
                onChange={(e) => set({ reason: e.target.value })} />
            )}
          </div>
        </Field>
      )}
      {draft.plan && draft.plan !== "none" && (
        <Field label={`Why from the ${draft.plan === "first_year" ? "1st" : "2nd"} year?`} htmlFor={`${idPrefix}-reason`} required className="sm:col-span-2">
          <Input id={`${idPrefix}-reason`} maxLength={300} value={draft.reason} onChange={(e) => set({ reason: e.target.value })}
            placeholder={draft.plan === "first_year" ? "e.g. Hosted on our server from go-live" : "e.g. First year's support included in the project price"} />
        </Field>
      )}

      {draft.plan && draft.plan !== "none" && <>
        <Field label={draft.plan === "second_year" ? "Base price per year, from the 2nd year (₹)" : "Base price per year (₹)"} htmlFor={`${idPrefix}-amount`} required
          hint="Before extra users and storage">
          <Input id={`${idPrefix}-amount`} inputMode="decimal" value={draft.amount} onChange={(e) => set({ amount: e.target.value.replace(/[^\d.]/g, "") })} />
        </Field>

        {draft.plan === "first_year" && !locked ? (
          <Field label="First year paid?" required>
            <Choice<"yes" | "no"> label="First year paid?" value={draft.paid} onChange={(paid) => set({ paid })} options={[
              { value: "yes", label: "Paid" },
              { value: "no", label: "Not yet" },
            ]} />
          </Field>
        ) : <div className="hidden sm:block" />}

        <Field label={locked ? "This year from" : "AMC start date"} htmlFor={`${idPrefix}-start`} required
          hint={locked ? undefined : "Usually the delivery date"}>
          <Input id={`${idPrefix}-start`} type="date" value={draft.start_date} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label={draft.plan === "second_year" && !locked ? "Renewal date — first payment" : "Renewal date"} htmlFor={`${idPrefix}-renewal`} required
          error={draft.start_date && draft.renewal_date && draft.renewal_date <= draft.start_date ? "Must be after the start date" : null}
          hint={draft.renewalTouched ? "Set by hand" : "Auto: a year after the start date"}>
          <Input id={`${idPrefix}-renewal`} type="date" value={draft.renewal_date} onChange={(e) => set({ renewal_date: e.target.value, renewalTouched: true })} />
        </Field>

        {willPay && !locked && <>
          <Field label="Paid on" htmlFor={`${idPrefix}-paid-on`} required>
            <Input id={`${idPrefix}-paid-on`} type="date" value={draft.payment_date} onChange={(e) => set({ payment_date: e.target.value })} />
          </Field>
          <Field label="Mode">
            <NativeSelect value={draft.payment_mode} options={PAYMENT_MODES} onChange={(v) => set({ payment_mode: v })} />
          </Field>
        </>}

        <AmcUserFields draft={draft} set={set} idPrefix={idPrefix} />

        <AmcStorageFields draft={draft} set={set} usedGb={usedGb} setUsedGb={setUsedGb} idPrefix={idPrefix} />

        {Number(draft.amount) > 0 && (() => {
          const usersTotal = breakdown.users.reduce((s, u) => s + u.extra, 0);
          return (
            <div className="sm:col-span-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
              <p className="font-medium text-card-foreground">
                AMC a year now: Base {rupees(Number(draft.amount))} + Storage {rupees(breakdown.storage)} + Users {rupees(usersTotal)} = <b>{rupees(breakdown.total)}</b>
              </p>
              {breakdown.users.length > 0 && (
                <p className="text-muted-foreground">
                  Users: {breakdown.users.map((u) => `${u.category || "—"} ${u.users}/${u.included} ${rupees(u.extra)}`).join(" · ")}
                </p>
              )}
              <p className="text-muted-foreground">This is the amount Finance expects; it changes when users or storage change.</p>
            </div>
          );
        })()}

        {showNotes && (
          <Field label="Notes" htmlFor={`${idPrefix}-notes`} className="sm:col-span-2">
            <Textarea id={`${idPrefix}-notes`} rows={2} value={draft.notes} onChange={(e) => set({ notes: e.target.value })} />
          </Field>
        )}
      </>}

      {notes.length > 0 && (
        <div className="sm:col-span-2 space-y-1 rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          {notes.map((n, i) => <p key={i}>{n}</p>)}
        </div>
      )}
    </div>
  );
}

/**
 * The storage the AMC includes, and what more costs: e.g. 20 GB in the base
 * price, then every 10 GB more adds ₹500 a year. The steps are worked out as
 * they are typed, with a "what if they use …" check.
 */
function AmcStorageFields({ draft, set, usedGb, setUsedGb, idPrefix }: {
  draft: AmcDraft;
  set: (patch: Partial<AmcDraft>) => void;
  usedGb: string;
  setUsedGb: (v: string) => void;
  idPrefix: string;
}) {
  const base = Number(draft.amount);
  const included = Number(draft.storage_gb);
  const step = Number(draft.storage_step_gb);
  const stepPrice = Number(draft.storage_step_price);
  const ready = base > 0 && included > 0 && step > 0 && draft.storage_step_price.trim() !== "" && stepPrice >= 0;
  const digits = (v: string) => v.replace(/[^\d.]/g, "");
  const used = Number(usedGb);

  return (
    <div className="sm:col-span-2 space-y-3 rounded-md border p-3">
      <div>
        <p className="text-sm font-medium text-card-foreground">Storage in the AMC</p>
        <p className="text-xs text-muted-foreground">Optional. How much the base price covers, and what each extra block adds a year.</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Field label="GB in base" htmlFor={`${idPrefix}-gb`}>
          <Input id={`${idPrefix}-gb`} inputMode="decimal" placeholder="e.g. 20" value={draft.storage_gb} onChange={(e) => set({ storage_gb: digits(e.target.value) })} />
        </Field>
        <Field label="GB per block" htmlFor={`${idPrefix}-step`}>
          <Input id={`${idPrefix}-step`} inputMode="decimal" placeholder="e.g. 10" value={draft.storage_step_gb} onChange={(e) => set({ storage_step_gb: digits(e.target.value) })} />
        </Field>
        <Field label="₹ per block / year" htmlFor={`${idPrefix}-step-price`}>
          <Input id={`${idPrefix}-step-price`} inputMode="decimal" placeholder="e.g. 500" value={draft.storage_step_price} onChange={(e) => set({ storage_step_price: digits(e.target.value) })} />
        </Field>
        <Field label="GB used now" htmlFor={`${idPrefix}-used-now`}>
          <Input id={`${idPrefix}-used-now`} inputMode="decimal" placeholder="e.g. 25" value={draft.storage_used_gb} onChange={(e) => set({ storage_used_gb: digits(e.target.value) })} />
        </Field>
      </div>
      {ready && (
        <div className="space-y-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
          <ul className="space-y-0.5 text-muted-foreground">
            {[0, 1, 2].map((n) => (
              <li key={n}>
                {n === 0 ? <>Up to <b className="text-foreground">{gb(included)}</b></> : <>{gb(included + (n - 1) * step)} – <b className="text-foreground">{gb(included + n * step)}</b></>}
                {": "}<b className="text-foreground">{rupees(base + n * stepPrice)}</b> a year
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-2 border-t pt-2">
            <label htmlFor={`${idPrefix}-used`} className="text-muted-foreground">If they use</label>
            <Input id={`${idPrefix}-used`} inputMode="decimal" className="h-8 w-24" placeholder="GB" value={usedGb} onChange={(e) => setUsedGb(digits(e.target.value))} />
            <span className="text-muted-foreground">GB, the AMC from that year is</span>
            <b className="text-foreground">{rupees(used > 0 ? amcForStorage(base, included, step, stepPrice, used) : base)}</b>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Users in the AMC, per category: how many the base price covers, how many make
 * one extra block (1 — each user; 5 — every five), the block's price a year, and
 * how many there are now. ERP: 5 in the base, ₹500 for each one more. Web APK:
 * 10 in the base, ₹500 for every 5 more.
 */
function AmcUserFields({ draft, set, idPrefix }: { draft: AmcDraft; set: (patch: Partial<AmcDraft>) => void; idPrefix: string }) {
  const digits = (v: string) => v.replace(/[^\d]/g, "");
  const money = (v: string) => v.replace(/[^\d.]/g, "");
  const rows = draft.users;
  const setRow = (i: number, patch: Partial<UserDraft>) => set({
    users: rows.map((r, j) => {
      if (j !== i) return r;
      // "Users now" follows "Users in base" until it is set to something else,
      // so the number on screen is always the number saved.
      const follow = patch.included !== undefined && (r.users === "" || r.users === r.included);
      return { ...r, ...patch, ...(follow ? { users: patch.included } : {}) };
    }),
  });
  const add = (category = "") => set({ users: [...rows, { category, included: "", step: "1", price: "", users: "" }] });
  const taken = new Set(rows.map((r) => r.category.trim().toLowerCase()));
  const plans = draftUsers(draft);
  const base = Number(draft.amount) || 0;
  // The calculator's "if they have … users", per row: a what-if, not saved.
  const [whatIf, setWhatIf] = useState<Record<number, string>>({});
  const usersText = (n: number) => `${n} user${n === 1 ? "" : "s"}`;

  return (
    <div className="sm:col-span-2 space-y-3 rounded-md border p-3">
      <div>
        <p className="text-sm font-medium text-card-foreground">Users in the AMC</p>
        <p className="text-xs text-muted-foreground">Optional. Per category: users the base price covers, and what more users add a year. Users per block: 1 charges each extra user; 5 charges every 5 more.</p>
      </div>
      {rows.map((r, i) => {
        const p = plans[i];
        const extra = userExtra(p);
        const step = Number(r.step) || 1;
        return (
          <div key={i} className="space-y-2 rounded-md bg-muted/30 p-3">
            <div className="flex items-end gap-2">
              <Field label="Category" htmlFor={`${idPrefix}-u${i}-cat`} className="flex-1">
                <Input id={`${idPrefix}-u${i}-cat`} placeholder="ERP, Web APK…" maxLength={60} value={r.category} onChange={(e) => setRow(i, { category: e.target.value })} />
              </Field>
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${r.category || "this category"}`} onClick={() => set({ users: rows.filter((_, j) => j !== i) })}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Field label="Users in base" htmlFor={`${idPrefix}-u${i}-inc`}>
                <Input id={`${idPrefix}-u${i}-inc`} inputMode="numeric" placeholder="e.g. 5" value={r.included} onChange={(e) => setRow(i, { included: digits(e.target.value) })} />
              </Field>
              <Field label="Users per block" htmlFor={`${idPrefix}-u${i}-step`}>
                <Input id={`${idPrefix}-u${i}-step`} inputMode="numeric" placeholder="1" value={r.step} onChange={(e) => setRow(i, { step: digits(e.target.value) })} />
              </Field>
              <Field label="₹ per block / year" htmlFor={`${idPrefix}-u${i}-price`}>
                <Input id={`${idPrefix}-u${i}-price`} inputMode="decimal" placeholder="e.g. 500" value={r.price} onChange={(e) => setRow(i, { price: money(e.target.value) })} />
              </Field>
              <Field label="Users now" htmlFor={`${idPrefix}-u${i}-now`}>
                <Input id={`${idPrefix}-u${i}-now`} inputMode="numeric" placeholder={r.included || "0"} value={r.users} onChange={(e) => setRow(i, { users: digits(e.target.value) })} />
              </Field>
            </div>
            {r.included !== "" && r.price !== "" && (
              // Worked out as it is typed, like storage: the first steps, then a "what if".
              <div className="space-y-2 rounded-md bg-background px-3 py-2 text-sm">
                <ul className="space-y-0.5 text-muted-foreground">
                  {[0, 1, 2].map((n) => (
                    <li key={n}>
                      {n === 0
                        ? <>Up to <b className="text-foreground">{usersText(p.included)}</b></>
                        : step === 1
                          ? <b className="text-foreground">{usersText(p.included + n)}</b>
                          : <>{p.included + (n - 1) * step + 1} – <b className="text-foreground">{usersText(p.included + n * step)}</b></>}
                      {": "}<b className="text-foreground">{rupees(base + n * p.price)}</b> a year
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">
                  {p.users > p.included
                    ? <b className="text-foreground">{usersText(p.users)} now → +{rupees(extra)} a year.</b>
                    : <>{usersText(p.users)} now — inside the base.</>}
                </p>
                <div className="flex flex-wrap items-center gap-2 border-t pt-2">
                  <label htmlFor={`${idPrefix}-u${i}-if`} className="text-muted-foreground">If they have</label>
                  <Input id={`${idPrefix}-u${i}-if`} inputMode="numeric" className="h-8 w-24" placeholder="users" value={whatIf[i] ?? ""}
                    onChange={(e) => setWhatIf((w) => ({ ...w, [i]: digits(e.target.value) }))} />
                  <span className="text-muted-foreground">{r.category || "these"} users, the AMC from that year is</span>
                  <b className="text-foreground">{rupees(base + (whatIf[i] ? userExtra({ ...p, users: Number(whatIf[i]) }) : 0))}</b>
                </div>
              </div>
            )}
          </div>
        );
      })}
      <div className="flex flex-wrap gap-2">
        {USER_CATEGORIES.filter((c) => !taken.has(c.toLowerCase())).map((c) => (
          <Button key={c} type="button" variant="outline" size="sm" onClick={() => add(c)}><Plus className="h-3.5 w-3.5" /> {c}</Button>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => add()}><Plus className="h-3.5 w-3.5" /> Other</Button>
      </div>
    </div>
  );
}

/** How an AMC's yearly price is made up, in one or two short lines, for lists. */
export function AmcPriceParts({ amc, className }: { amc: OpsAmcRecord; className?: string }) {
  const b = recordBreakdown(amc);
  const users = b.users.filter((u) => u.users > 0 || u.extra > 0);
  if (users.length === 0 && !amc.storage_gb) return null;
  return (
    <span className={cn("block text-xs text-muted-foreground", className)}>
      Base {rupees(amc.base_amount ?? amc.amount)}
      {users.map((u) => (
        <span key={u.category}> · {u.category} {u.users}/{u.included}{u.extra > 0 ? ` +${rupees(u.extra)}` : ""}</span>
      ))}
      {amc.storage_gb ? <> · {amc.storage_used_gb ?? "?"}/{amc.storage_gb} GB{b.storage > 0 ? ` +${rupees(b.storage)}` : ""}</> : null}
    </span>
  );
}

/**
 * Users or storage changed: say how many there are now, and the yearly price
 * follows — in Finance, the dashboard's AMC due and the renewals. Payments
 * already recorded stay as they were.
 */
export function AmcUsageDialog({ open, onOpenChange, amc, onSaved }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amc: OpsAmcRecord | null;
  onSaved: () => void;
}) {
  const { userName } = useAuth();
  const [users, setUsers] = useState<Record<string, string>>({});
  const [used, setUsed] = useState("");
  useEffect(() => {
    if (!open || !amc) return;
    setUsers(Object.fromEntries((amc.user_plans ?? []).map((u) => [u.category, String(u.users)])));
    setUsed(amc.storage_used_gb == null ? "" : String(amc.storage_used_gb));
  }, [open, amc]);
  if (!amc) return null;

  const plans = (amc.user_plans ?? []).map((u) => ({ ...u, users: users[u.category] === undefined || users[u.category] === "" ? u.users : Number(users[u.category]) }));
  const next = amcBreakdown({
    base: amc.base_amount ?? amc.amount, users: plans, storage_gb: amc.storage_gb, storage_step_gb: amc.storage_step_gb,
    storage_step_price: amc.storage_step_price, storage_used_gb: used.trim() === "" ? null : Number(used),
  });
  const nothing = plans.length === 0 && !amc.storage_gb;

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      wide
      title="Update users and storage"
      description={<>{amc.client_name} · {amc.project_name}</>}
      confirmLabel="Save"
      disabled={nothing}
      successMessage="AMC updated — Finance shows the new amount"
      onConfirm={async () => {
        await opsAmcApi.usage(amc.id, {
          users: Object.fromEntries(plans.map((u) => [u.category, u.users])),
          ...(amc.storage_gb ? { storage_used_gb: used.trim() === "" ? null : Number(used) } : {}),
          recorded_by: userName ?? "",
        });
        onSaved();
      }}
    >
      {nothing ? (
        <p className="text-sm text-muted-foreground">This AMC has no users or storage in its price. Edit the AMC to add them.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {plans.map((u) => (
            <Field key={u.category} label={`${u.category} users now`} htmlFor={`amc-use-${u.category}`}
              hint={`${u.included} in the base; ${rupees(u.price)} for ${u.step === 1 ? "each user" : `every ${u.step}`} more`}>
              <Input id={`amc-use-${u.category}`} inputMode="numeric" value={users[u.category] ?? ""}
                onChange={(e) => setUsers((s) => ({ ...s, [u.category]: e.target.value.replace(/[^\d]/g, "") }))} />
            </Field>
          ))}
          {amc.storage_gb ? (
            <Field label="Storage used now (GB)" htmlFor="amc-use-gb"
              hint={`${amc.storage_gb} GB in the base; ${rupees(amc.storage_step_price ?? 0)} for every ${amc.storage_step_gb} GB more`}>
              <Input id="amc-use-gb" inputMode="decimal" value={used} onChange={(e) => setUsed(e.target.value.replace(/[^\d.]/g, ""))} />
            </Field>
          ) : null}
          <div className="sm:col-span-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
            <p>
              AMC a year: <span className="text-muted-foreground">{rupees(amc.amount)}</span>
              {Math.abs(next.total - amc.amount) > 0.004 ? <> → <b className="text-foreground">{rupees(next.total)}</b></> : " (no change)"}
            </p>
            <p className="text-xs text-muted-foreground">
              The next AMC payment in Finance and on the dashboard becomes this amount. Payments already received are not changed.
            </p>
          </div>
        </div>
      )}
    </ActionDialog>
  );
}

/**
 * The AMC sheet for the client: the PDF itself shown as the preview, so what
 * is seen is exactly what is sent, with a button to download it.
 */
export function AmcSheetDialog({ amc, onClose }: { amc: OpsAmcRecord | null; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!amc) return;
    let made: string | null = null;
    let live = true;
    setUrl(null); setBlob(null); setError(null);
    (async () => {
      try {
        const [{ buildAmcSheet }, { loadCompanyProfile }] = await Promise.all([import("./amcSheet"), import("@/lib/companyProfile")]);
        const pdf = await buildAmcSheet(amc, await loadCompanyProfile());
        if (!live) return;
        made = URL.createObjectURL(pdf);
        setBlob(pdf);
        setUrl(made);
      } catch (e) {
        if (live) setError(e instanceof Error ? e.message : "Could not make the sheet");
      }
    })();
    return () => { live = false; if (made) URL.revokeObjectURL(made); };
  }, [amc]);

  const download = async () => {
    if (!amc || !blob) return;
    const { amcSheetFileName } = await import("./amcSheet");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = amcSheetFileName(amc);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <Dialog open={amc !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[92vh] max-w-4xl flex-col gap-3">
        <DialogHeader>
          <DialogTitle>AMC sheet</DialogTitle>
          {amc && <DialogDescription>{[amc.client_name, amc.client_company].filter(Boolean).join(" · ")} — {amc.project_name}</DialogDescription>}
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-hidden rounded-md border bg-muted/40">
          {error ? <p className="p-6 text-sm text-destructive">{error}</p>
            : url ? <iframe title="AMC sheet preview" src={url} className="h-full w-full" />
            : <p className="p-6 text-sm text-muted-foreground">Making the sheet…</p>}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          {url && <Button variant="outline" onClick={() => window.open(url, "_blank", "noopener")}><ExternalLink className="h-4 w-4" /> Open in new tab</Button>}
          <Button onClick={() => void download()} disabled={!blob}><Download className="h-4 w-4" /> Download PDF</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type ClientRef = { id: number; name: string; company?: string | null };
type ProjectRef = { id: number; client_id: number; name: string; project_code?: string | null };

/**
 * Add an AMC, or edit one — every answer, the first year's payment included.
 *
 * Give `project` to add from a project page; give `clients` and `projects`
 * to choose them; give `amc` to edit. Choosing "No AMC" while editing
 * removes it.
 */
export function AmcFormDialog({ open, onOpenChange, amc, project, clients = [], projects = [], onSaved }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amc?: OpsAmcRecord | null;
  project?: ProjectRef;
  clients?: ClientRef[];
  projects?: ProjectRef[];
  onSaved: () => void;
}) {
  const { userName } = useAuth();
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [draft, setDraft] = useState<AmcDraft>(() => amcDraft(null));

  useEffect(() => {
    if (!open) return;
    setClientId(String(amc?.client_id ?? project?.client_id ?? ""));
    setProjectId(String(amc?.project_id ?? project?.id ?? ""));
    setDraft(amcDraft(amc));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, amc]);

  const editing = !!amc;
  const problem = amcDraftProblem(draft) ?? (!projectId ? "Choose the project" : null);
  const clientProjects = clientId ? projects.filter((p) => String(p.client_id) === clientId) : projects;
  const fixedProject = project ?? (amc ? { name: amc.project_name ?? "", project_code: amc.project_code } : null);
  const removing = editing && draft.plan === "none";

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      wide
      title={editing ? "Edit AMC" : "Add AMC"}
      description={fixedProject && <>{fixedProject.project_code ? `${fixedProject.project_code} · ` : ""}{fixedProject.name}</>}
      confirmLabel={removing ? "Remove AMC" : editing ? "Save AMC" : "Add AMC"}
      destructive={removing}
      disabled={problem !== null}
      successMessage={removing ? "AMC removed" : editing ? "AMC updated" : "AMC added"}
      onConfirm={async () => {
        const body = { ...amcDraftBody(draft), recorded_by: userName ?? "" };
        if (editing && amc) await opsAmcApi.update(amc.id, body);
        else await opsAmcApi.create({ ...body, client_id: Number(clientId), project_id: Number(projectId) });
        onSaved();
      }}
    >
      <div className="grid grid-cols-1 gap-4">
        {!fixedProject && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Client" required>
              <NativeSelect value={clientId} placeholder="Choose client"
                onChange={(v) => { setClientId(v); setProjectId(""); }}
                options={clients.map((c) => ({ value: c.id, label: c.company ? `${c.name} · ${c.company}` : c.name }))} />
            </Field>
            <Field label="Project" required>
              <NativeSelect value={projectId} placeholder="Choose project"
                onChange={(v) => {
                  const p = projects.find((x) => String(x.id) === v);
                  setProjectId(v);
                  if (p) setClientId(String(p.client_id));
                }}
                options={clientProjects.map((p) => ({ value: p.id, label: `${p.project_code ? `${p.project_code} · ` : ""}${p.name}` }))} />
            </Field>
          </div>
        )}
        <AmcPlanFields draft={draft} onChange={setDraft} original={amc} allowNone={editing} showNotes idPrefix="amc-dlg" />
      </div>
    </ActionDialog>
  );
}

/**
 * Record this year's AMC payment. An unpaid year becomes paid; a paid (or
 * free) year renews, so the next year starts on the renewal date. The payment
 * shows in Finance as AMC and does not touch the project's balance.
 */
export function AmcCollectDialog({ open, onOpenChange, amc, onSaved }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amc: OpsAmcRecord | null;
  onSaved: () => void;
}) {
  const { userName } = useAuth();
  const [form, setForm] = useState({ amount: "", payment_date: todayIso(), payment_mode: "bank_transfer", reference: "" });
  useEffect(() => {
    if (open && amc) setForm({ amount: String(amc.amount), payment_date: todayIso(), payment_mode: amc.payment_mode || "bank_transfer", reference: "" });
  }, [open, amc]);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  if (!amc) return null;

  const from = amc.term_paid ? amc.renewal_date : amc.start_date;
  const to = amc.term_paid ? yearAfter(amc.renewal_date) : amc.renewal_date;
  const amount = Number(form.amount);

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      wide
      title={amc.term_paid ? "Collect AMC renewal" : "Collect this year's AMC"}
      description={<>{amc.client_name} · {amc.project_name}</>}
      confirmLabel="Record payment"
      disabled={!(amount > 0) || !form.payment_date}
      successMessage="AMC payment recorded in Finance"
      onConfirm={async () => {
        await opsAmcApi.collect(amc.id, { amount, payment_date: form.payment_date, payment_mode: form.payment_mode, reference: form.reference.trim(), recorded_by: userName ?? "" });
        onSaved();
      }}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <p className="sm:col-span-2 rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          <AmcPriceParts amc={amc} className="mb-1" />
          For <b>{formatDate(from)}</b> to <b>{formatDate(to)}</b>. The next payment is then due on {formatDate(to)}.
          It shows in Finance as AMC and does not change the project's balance.
        </p>
        <Field label="Amount (₹)" htmlFor="amc-c-amount" required>
          <Input id="amc-c-amount" inputMode="decimal" value={form.amount} onChange={(e) => set("amount", e.target.value.replace(/[^\d.]/g, ""))} />
        </Field>
        <Field label="Paid on" htmlFor="amc-c-date" required>
          <Input id="amc-c-date" type="date" value={form.payment_date} onChange={(e) => set("payment_date", e.target.value)} />
        </Field>
        <Field label="Mode">
          <NativeSelect value={form.payment_mode} options={PAYMENT_MODES} onChange={(v) => set("payment_mode", v)} />
        </Field>
        <Field label="Reference" htmlFor="amc-c-ref" hint="UTR, cheque number…">
          <Input id="amc-c-ref" value={form.reference} onChange={(e) => set("reference", e.target.value)} />
        </Field>
      </div>
    </ActionDialog>
  );
}
