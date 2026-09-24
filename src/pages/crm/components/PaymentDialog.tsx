import { useEffect, useState } from "react";
import { ActionDialog } from "@/components/ActionDialog";
import { Field, NativeSelect } from "@/components/Field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { opsFinanceApi } from "@/lib/api/ops";
import { todayIso } from "@/lib/format";
import type { OpsPayment } from "@/types/ops";
import { rupees } from "./crm";

export const PAYMENT_TYPES = [
  { value: "advance", label: "Advance" },
  { value: "mid", label: "Mid-payment" },
  { value: "final", label: "Final" },
  { value: "amc", label: "AMC" },
  { value: "other", label: "Other" },
];

export const PAYMENT_MODES = [
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "upi", label: "UPI" },
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "other", label: "Other" },
];

type ProjectRef = { id: number; client_id: number; name: string; project_code?: string | null; balance?: number | null };

/**
 * Record a payment against a project, or correct one already recorded.
 *
 * Goes through the Finance API (ops_payments), so the project's received and
 * balance move with it and the payment shows on the Finance page — the same
 * record either way. Given several projects (a client's), it asks which one.
 */
export function PaymentDialog({
  open,
  onOpenChange,
  projects,
  payment,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The project(s) the payment can be for; a picker shows when there is more than one. */
  projects: ProjectRef[];
  /** Set to edit this payment; leave out to record a new one. */
  payment?: OpsPayment | null;
  onSaved: () => void;
}) {
  const { userName } = useAuth();
  const [form, setForm] = useState({ amount: "", payment_date: todayIso(), type: "advance", mode: "bank_transfer", reference: "", notes: "" });
  const [projectId, setProjectId] = useState("");
  const project = projects.find((p) => String(p.id) === projectId) ?? (projects.length === 1 ? projects[0] : undefined);

  useEffect(() => {
    if (!open) return;
    setProjectId(payment ? String(payment.project_id) : projects.length === 1 ? String(projects[0].id) : "");
    setForm(payment
      ? {
          amount: String(payment.amount), payment_date: payment.payment_date, type: payment.type, mode: payment.mode,
          reference: payment.reference ?? "", notes: payment.notes ?? "",
        }
      : { amount: "", payment_date: todayIso(), type: "advance", mode: "bank_transfer", reference: "", notes: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, payment]);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const amount = Number(form.amount);

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      wide
      title={payment ? "Edit payment" : "Record payment"}
      description={project && <>
        {project.project_code ? `${project.project_code} · ` : ""}{project.name}
        {!payment && project.balance != null && Number(project.balance) > 0 && <> · balance {rupees(project.balance)}</>}
      </>}
      confirmLabel={payment ? "Save payment" : "Record payment"}
      disabled={!(amount > 0) || !form.payment_date || !project}
      successMessage={payment ? "Payment updated" : "Payment recorded — it now shows in Finance"}
      onConfirm={async () => {
        const body = {
          amount,
          payment_date: form.payment_date,
          type: form.type as OpsPayment["type"],
          mode: form.mode as OpsPayment["mode"],
          // "" (not null) so clearing a field on edit sticks: the API skips absent fields.
          reference: form.reference.trim(),
          notes: form.notes.trim(),
        };
        if (!project) return;
        if (payment) await opsFinanceApi.updatePayment(payment.id, body);
        else await opsFinanceApi.addPayment({ ...body, client_id: project.client_id, project_id: project.id, recorded_by: userName ?? "" });
        onSaved();
      }}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {!payment && projects.length > 1 && (
          <Field label="Project" required className="sm:col-span-2">
            <NativeSelect value={projectId} placeholder="Choose project" onChange={setProjectId}
              options={projects.map((p) => ({ value: p.id, label: `${p.project_code ? `${p.project_code} · ` : ""}${p.name}` }))} />
          </Field>
        )}
        <Field label="Amount (₹)" htmlFor="pay-amount" required>
          <Input id="pay-amount" inputMode="decimal" autoFocus value={form.amount} onChange={(e) => set("amount", e.target.value.replace(/[^\d.]/g, ""))} />
        </Field>
        <Field label="Date" htmlFor="pay-date" required>
          <Input id="pay-date" type="date" value={form.payment_date} onChange={(e) => set("payment_date", e.target.value)} />
        </Field>
        <Field label="Type">
          <NativeSelect value={form.type} options={PAYMENT_TYPES} onChange={(v) => set("type", v)} />
        </Field>
        <Field label="Mode">
          <NativeSelect value={form.mode} options={PAYMENT_MODES} onChange={(v) => set("mode", v)} />
        </Field>
        <Field label="Reference" htmlFor="pay-ref" hint="UTR, cheque number…" className="sm:col-span-2">
          <Input id="pay-ref" value={form.reference} onChange={(e) => set("reference", e.target.value)} />
        </Field>
        <Field label="Notes" htmlFor="pay-notes" className="sm:col-span-2">
          <Textarea id="pay-notes" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
      </div>
    </ActionDialog>
  );
}

export default PaymentDialog;
