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
import type { OpsAmcRecord } from "@/types/ops";
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

/** "In 12 days", "Today", "5 days overdue". */
export function dueText(days: number | null): ReactNode {
  if (days == null) return "—";
  if (days < 0) return <span className="text-red-600 font-medium">{Math.abs(days)}d overdue</span>;
  if (days === 0) return <span className="text-amber-600 font-medium">Today</span>;
  return <span className={days <= 30 ? "text-amber-600" : "text-muted-foreground"}>in {days}d</span>;
}

/** Two or three buttons that act as one choice, for the yes/no questions. */
function Choice<T extends string>({ value, onChange, options, label }: {
  value: T | null;
  onChange: (v: T) => void;
  options: { value: T; label: string; hint?: string }[];
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md border px-3 py-2 text-left text-sm transition-colors",
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

type ClientRef = { id: number; name: string; company?: string | null };
type ProjectRef = { id: number; client_id: number; name: string; project_code?: string | null };

const EMPTY = {
  client_id: "", project_id: "", amount: "", start_date: "", renewal_date: "", renewalTouched: false,
  payment_mode: "bank_transfer", payment_date: "", notes: "",
};

/**
 * Add an AMC, or edit one. Adding asks first whether the first year is charged:
 *
 *   First year free  → the yearly amount and the renewal date, when they first pay.
 *   First year charged → the amount and whether it is paid; a paid first year
 *                        goes into Finance as an AMC payment.
 *
 * Either way the renewal date follows the start date (a year later) until it
 * is changed by hand. AMC stays separate from the project's price and balance.
 *
 * Give `project` to add from a project page; give `clients` and `projects`
 * to choose them; give `amc` to edit.
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
  const [form, setForm] = useState(EMPTY);
  const [firstYear, setFirstYear] = useState<"free" | "charged" | null>(null);
  const [paid, setPaid] = useState<"yes" | "no" | null>(null);

  useEffect(() => {
    if (!open) return;
    const start = amc?.start_date ?? todayIso();
    setForm({
      ...EMPTY,
      client_id: String(amc?.client_id ?? project?.client_id ?? ""),
      project_id: String(amc?.project_id ?? project?.id ?? ""),
      amount: amc ? String(amc.amount) : "",
      start_date: start,
      renewal_date: amc?.renewal_date ?? yearAfter(start),
      payment_date: todayIso(),
      notes: amc?.notes ?? "",
    });
    setFirstYear(null);
    setPaid(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, amc]);

  const set = (k: keyof typeof EMPTY, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const setStart = (v: string) => setForm((f) => ({ ...f, start_date: v, renewal_date: f.renewalTouched ? f.renewal_date : yearAfter(v) }));
  const setRenewal = (v: string) => setForm((f) => ({ ...f, renewal_date: v, renewalTouched: true }));

  const editing = !!amc;
  const amount = Number(form.amount);
  const clientProjects = form.client_id ? projects.filter((p) => String(p.client_id) === form.client_id) : projects;
  const datesOk = !!form.start_date && !!form.renewal_date && form.renewal_date > form.start_date;
  const ready = amount > 0 && datesOk && !!form.project_id
    && (editing || (firstYear === "free" || (firstYear === "charged" && paid !== null && (paid === "no" || !!form.payment_date))));

  const summary = !datesOk ? null
    : editing ? null
    : firstYear === "free" ? <>Nothing is due now. {amount > 0 ? rupees(amount) : "The yearly amount"} is first due on <b>{formatDate(form.renewal_date)}</b>, then every year.</>
    : firstYear === "charged" && paid === "yes" ? <>{amount > 0 ? rupees(amount) : "The amount"} goes into Finance as an AMC payment. The next one is due on <b>{formatDate(form.renewal_date)}</b>.</>
    : firstYear === "charged" && paid === "no" ? <>{amount > 0 ? rupees(amount) : "The amount"} is due from <b>{formatDate(form.start_date)}</b>. After it is collected, the next one is due on {formatDate(form.renewal_date)}.</>
    : null;

  const fixedProject = project ?? (amc ? { name: amc.project_name ?? "", project_code: amc.project_code } : null);

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      wide
      title={editing ? "Edit AMC" : "Add AMC"}
      description={fixedProject && <>
        {fixedProject.project_code ? `${fixedProject.project_code} · ` : ""}{fixedProject.name}
        {amc && <> · first year {amc.first_year_free ? "free" : "charged"}</>}
      </>}
      confirmLabel={editing ? "Save AMC" : "Add AMC"}
      disabled={!ready}
      successMessage={editing ? "AMC updated" : paid === "yes" ? "AMC added — first year's payment is in Finance" : "AMC added"}
      onConfirm={async () => {
        if (editing && amc) {
          await opsAmcApi.update(amc.id, { amount, start_date: form.start_date, renewal_date: form.renewal_date, notes: form.notes.trim() });
        } else {
          await opsAmcApi.create({
            client_id: Number(form.client_id),
            project_id: Number(form.project_id),
            amount,
            first_year_free: firstYear === "free",
            first_year_paid: firstYear === "charged" && paid === "yes",
            start_date: form.start_date,
            renewal_date: form.renewal_date,
            payment_mode: form.payment_mode,
            payment_date: form.payment_date,
            notes: form.notes.trim(),
            recorded_by: userName ?? "",
          });
        }
        onSaved();
      }}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {!fixedProject && <>
          <Field label="Client" required>
            <NativeSelect value={form.client_id} placeholder="Choose client"
              onChange={(v) => setForm((f) => ({ ...f, client_id: v, project_id: "" }))}
              options={clients.map((c) => ({ value: c.id, label: c.company ? `${c.name} · ${c.company}` : c.name }))} />
          </Field>
          <Field label="Project" required>
            <NativeSelect value={form.project_id} placeholder="Choose project"
              onChange={(v) => {
                const p = projects.find((x) => String(x.id) === v);
                setForm((f) => ({ ...f, project_id: v, client_id: p ? String(p.client_id) : f.client_id }));
              }}
              options={clientProjects.map((p) => ({ value: p.id, label: `${p.project_code ? `${p.project_code} · ` : ""}${p.name}` }))} />
          </Field>
        </>}

        {!editing && (
          <Field label="Is the first year's AMC charged?" required className="sm:col-span-2">
            <Choice<"free" | "charged"> label="Is the first year's AMC charged?" value={firstYear} onChange={setFirstYear} options={[
              { value: "free", label: "No — first year free", hint: "They start paying at the renewal" },
              { value: "charged", label: "Yes — charged from the start", hint: "The first year is paid for too" },
            ]} />
          </Field>
        )}

        {(editing || firstYear) && <>
          <Field label={firstYear === "free" ? "Amount per year, from the renewal (₹)" : "AMC amount per year (₹)"} htmlFor="amc-amount" required>
            <Input id="amc-amount" inputMode="decimal" value={form.amount} onChange={(e) => set("amount", e.target.value.replace(/[^\d.]/g, ""))} />
          </Field>

          {firstYear === "charged" ? (
            <Field label="Is the first year paid?" required>
              <Choice<"yes" | "no"> label="Is the first year paid?" value={paid} onChange={setPaid} options={[
                { value: "yes", label: "Paid" },
                { value: "no", label: "Not yet" },
              ]} />
            </Field>
          ) : <div className="hidden sm:block" />}

          <Field label={editing ? "This year from" : "Start date"} htmlFor="amc-start" required
            hint={firstYear === "free" ? "When the free year begins, usually the delivery date" : undefined}>
            <Input id="amc-start" type="date" value={form.start_date} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label={firstYear === "free" ? "Renewal date — first payment due" : "Renewal date"} htmlFor="amc-renewal" required
            error={form.renewal_date && form.start_date && form.renewal_date <= form.start_date ? "Must be after the start date" : null}
            hint={form.renewalTouched ? "Set by hand" : "Auto: a year after the start date"}>
            <Input id="amc-renewal" type="date" value={form.renewal_date} onChange={(e) => setRenewal(e.target.value)} />
          </Field>

          {firstYear === "charged" && paid === "yes" && <>
            <Field label="Paid on" htmlFor="amc-paid-on" required>
              <Input id="amc-paid-on" type="date" value={form.payment_date} onChange={(e) => set("payment_date", e.target.value)} />
            </Field>
            <Field label="Mode">
              <NativeSelect value={form.payment_mode} options={PAYMENT_MODES} onChange={(v) => set("payment_mode", v)} />
            </Field>
          </>}

          <Field label="Notes" htmlFor="amc-notes" className="sm:col-span-2">
            <Textarea id="amc-notes" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>

          {summary && <p className="sm:col-span-2 rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">{summary}</p>}
        </>}
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
