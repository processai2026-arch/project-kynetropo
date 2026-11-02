import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { FileText, Pencil, RotateCcw, ShieldCheck, Users, Wallet } from "lucide-react";
import { ActionDialog } from "@/components/ActionDialog";
import { SectionCard } from "@/components/SectionCard";
import { Button } from "@/components/ui/button";
import { ScrollableX } from "@/components/ui/scrollable-x";
import { useAuth } from "@/contexts/AuthContext";
import { useLoad } from "@/hooks/useLoad";
import { opsAmcApi } from "@/lib/api/ops";
import { formatDate, humanise } from "@/lib/format";
import { rupees } from "@/pages/crm/components/crm";
import { PAYMENT_MODES } from "@/pages/crm/components/PaymentDialog";
import type { OpsAmcPayment, OpsAmcRecord } from "@/types/ops";
import { AmcStatusBadge, AmcYearBadge, amcBreakdown, dueText } from "./AmcDialogs";

/*
 * An AMC laid out as tables, so it reads at a glance: the contract (plan,
 * this year, what is due), the price a year line by line, and each year's
 * payment — with Revert on the latest collection.
 */

const gb = (n: number | null | undefined) => (n == null ? "—" : `${Number.isInteger(n) ? n : Number(n).toFixed(1)} GB`);
const modeLabel = (m: string | null | undefined) => (m ? PAYMENT_MODES.find((o) => o.value === m)?.label ?? humanise(m) : "");
const span = (from: string | null, to: string | null) => (from && to ? `${formatDate(from)} – ${formatDate(to)}` : "—");

/** The contract as label / value rows. */
export function AmcContractTable({ amc }: { amc: OpsAmcRecord }) {
  const rows: [string, ReactNode][] = [
    ["Plan", amc.first_year_free ? "AMC from the 2nd year (1st year free)" : "AMC from the 1st year"],
    ["Contract started", formatDate(amc.contract_start)],
    ["This year", <>{span(amc.start_date, amc.renewal_date)} <AmcYearBadge amc={amc} /></>],
    ["Next payment", <>{rupees(amc.amount)} due {formatDate(amc.due_date)} <span className="text-xs">({dueText(amc.days_until_due)})</span></>],
    ["Status", <AmcStatusBadge status={amc.status} />],
    ["Last paid on", amc.paid_on ? `${formatDate(amc.paid_on)}${amc.payment_mode ? ` · ${modeLabel(amc.payment_mode)}` : ""}` : "—"],
  ];
  if (amc.reason) rows.push(["Why this AMC", amc.reason]);
  if (amc.notes) rows.push(["Notes", amc.notes]);
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k}>
            <th scope="row" className="w-44 text-left align-top font-normal text-muted-foreground">{k}</th>
            <td className="text-card-foreground">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The price a year: base, each user category, storage, and the total — like the AMC sheet. */
export function AmcPriceTable({ amc }: { amc: OpsAmcRecord }) {
  const b = amcBreakdown({
    base: amc.base_amount ?? amc.amount, users: amc.user_plans ?? [],
    storage_gb: amc.storage_gb, storage_step_gb: amc.storage_step_gb, storage_step_price: amc.storage_step_price, storage_used_gb: amc.storage_used_gb,
  });
  const per = (n: number, unit: string) => (n === 1 ? `each ${unit}` : `every ${n} ${unit}s`);
  return (
    <ScrollableX>
      <table className="w-full text-sm">
        <thead><tr>
          <th className="text-left">Item</th><th className="text-center">In base</th><th className="text-center">Now</th>
          <th className="text-center">Extra</th><th className="text-left">Price for more</th><th className="text-right">A year</th>
        </tr></thead>
        <tbody>
          <tr>
            <td className="font-medium">Base price</td><td className="text-center">—</td><td className="text-center">—</td><td className="text-center">—</td>
            <td className="text-muted-foreground">Included</td>
            <td className="text-right tabular-nums">{rupees(amc.base_amount ?? amc.amount)}</td>
          </tr>
          {b.users.map((u) => (
            <tr key={u.category}>
              <td className="font-medium">{u.category} users</td>
              <td className="text-center">{u.included}</td>
              <td className="text-center">{u.users}</td>
              <td className="text-center">{u.users > u.included ? u.users - u.included : "—"}</td>
              <td className="whitespace-nowrap text-muted-foreground">{rupees(u.price)} for {per(u.step, "user")} more</td>
              <td className="text-right tabular-nums">{rupees(u.extra)}</td>
            </tr>
          ))}
          {amc.storage_gb ? (
            <tr>
              <td className="font-medium">Storage</td>
              <td className="text-center">{gb(amc.storage_gb)}</td>
              <td className="text-center">{gb(amc.storage_used_gb)}</td>
              <td className="text-center">{amc.storage_used_gb != null && amc.storage_used_gb > amc.storage_gb ? gb(amc.storage_used_gb - amc.storage_gb) : "—"}</td>
              <td className="whitespace-nowrap text-muted-foreground">{rupees(amc.storage_step_price ?? 0)} for every {gb(amc.storage_step_gb)} more</td>
              <td className="text-right tabular-nums">{rupees(b.storage)}</td>
            </tr>
          ) : null}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <td colSpan={5} style={{ textAlign: "left" }}>Total a year</td>
            <td className="text-right tabular-nums">{rupees(amc.amount)}</td>
          </tr>
        </tfoot>
      </table>
    </ScrollableX>
  );
}

/** Each AMC payment, newest first; the latest collection can be reverted. */
export function AmcPaymentsTable({ payments, onRevert }: { payments: OpsAmcPayment[]; onRevert?: (p: OpsAmcPayment) => void }) {
  return (
    <ScrollableX>
      <table className="w-full text-sm">
        <thead><tr>
          <th className="text-left">Paid on</th><th className="text-left">For the year</th><th className="text-left">Mode</th>
          <th className="text-left">Reference</th><th className="text-right">Amount</th><th />
        </tr></thead>
        <tbody>
          {payments.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">No AMC payments yet</td></tr>}
          {payments.map((p) => (
            <tr key={p.id}>
              <td className="whitespace-nowrap"><Link to={`/finance/payments/${p.id}`} className="text-primary hover:underline">{formatDate(p.payment_date)}</Link></td>
              <td className="whitespace-nowrap">{span(p.year_from, p.year_to)}</td>
              <td>{modeLabel(p.mode)}</td>
              <td className="text-muted-foreground">{p.reference || "—"}</td>
              <td className="text-right font-medium tabular-nums text-emerald-700">{rupees(p.amount)}</td>
              <td className="w-px whitespace-nowrap text-right">
                {p.current && onRevert && (
                  <Button size="sm" variant="outline" onClick={() => onRevert(p)} title="Undo this collection">
                    <RotateCcw className="h-3.5 w-3.5" /> Revert
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollableX>
  );
}

/** Confirm reverting the AMC's latest collection. */
export function AmcRevertDialog({ amc, payment, onOpenChange, onDone }: {
  amc: OpsAmcRecord | null;
  payment: OpsAmcPayment | null;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const { userName } = useAuth();
  return (
    <ActionDialog
      open={amc !== null && payment !== null}
      onOpenChange={onOpenChange}
      title="Revert this AMC collection?"
      destructive
      confirmLabel="Revert collection"
      successMessage="Collection reverted"
      description={payment && <div className="space-y-2">
        <p>
          The {rupees(payment.amount)} paid on {formatDate(payment.payment_date)}
          {payment.year_from && payment.year_to ? <> for {span(payment.year_from, payment.year_to)}</> : null} is taken out of Finance.
        </p>
        <p>The AMC goes back to how it was before this was collected — its year, renewal date and due amount.</p>
      </div>}
      onConfirm={async () => {
        if (!amc) return;
        await opsAmcApi.revert(amc.id, userName ?? "");
        onDone();
      }}
    />
  );
}

/**
 * One AMC as a project shows it: the contract, the price a year and the
 * payments, as tables, with its actions. Loads its own payments.
 */
export function AmcPanel({ amc, onCollect, onUsage, onSheet, onEdit, onChanged, reloadKey = 0 }: {
  amc: OpsAmcRecord;
  onCollect: (a: OpsAmcRecord) => void;
  onUsage: (a: OpsAmcRecord) => void;
  onSheet: (a: OpsAmcRecord) => void;
  onEdit: (a: OpsAmcRecord) => void;
  onChanged: () => void;
  /** Bump to load the payments again after a collection elsewhere. */
  reloadKey?: number;
}) {
  const { data, reload } = useLoad(() => opsAmcApi.get(amc.id), [amc.id, reloadKey]);
  const [reverting, setReverting] = useState<OpsAmcPayment | null>(null);
  const current = data ?? amc;
  const hasUsage = (current.user_plans?.length ?? 0) > 0 || !!current.storage_gb;

  return (
    <SectionCard icon={ShieldCheck} title={<Link to={`/amc/${amc.id}`} className="hover:text-primary">AMC · {rupees(current.amount)} a year</Link>}
      subtitle="Yearly maintenance — separate from the quoted amount and balance"
      headerAction={<div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" onClick={() => onCollect(current)}><Wallet className="h-4 w-4" /> {current.term_paid ? "Collect renewal" : "Collect"}</Button>
        {hasUsage && <Button size="sm" variant="outline" onClick={() => onUsage(current)}><Users className="h-4 w-4" /> Users & storage</Button>}
        <Button size="sm" variant="outline" onClick={() => onSheet(current)}><FileText className="h-4 w-4" /> Sheet</Button>
        <Button size="sm" variant="outline" onClick={() => onEdit(current)}><Pencil className="h-4 w-4" /> Edit</Button>
      </div>}>
      <div className="space-y-5">
        <AmcContractTable amc={current} />
        <div>
          <h3 className="mb-2 text-sm font-semibold text-card-foreground">Price a year</h3>
          <AmcPriceTable amc={current} />
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold text-card-foreground">Payments</h3>
          <AmcPaymentsTable payments={data?.payments ?? []} onRevert={setReverting} />
        </div>
      </div>
      <AmcRevertDialog amc={reverting ? current : null} payment={reverting} onOpenChange={(v) => { if (!v) setReverting(null); }}
        onDone={() => { setReverting(null); void reload(); onChanged(); }} />
    </SectionCard>
  );
}
