import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CircleDollarSign, FolderKanban, IndianRupee, Plus, Receipt, ShieldCheck, TrendingUp, Users, Wallet } from "lucide-react";
import { RecordDetailPage } from "@/components/RecordDetailPage";
import { RecordProfileHeader, ProfileLinkCard } from "@/components/RecordProfileHeader";
import { DetailStats } from "@/components/DetailStats";
import { StatCard } from "@/components/StatCard";
import { SectionCard } from "@/components/SectionCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollableX } from "@/components/ui/scrollable-x";
import { useLoad } from "@/hooks/useLoad";
import { opsFinanceApi } from "@/lib/api/ops";
import { formatDate, humanise } from "@/lib/format";
import { rowOpenProps, ROW_OPEN_CLASS } from "@/lib/rowNav";
import { rupees } from "@/pages/crm/components/crm";
import { PAYMENT_MODES, PAYMENT_TYPES, PaymentDialog } from "@/pages/crm/components/PaymentDialog";
import { AmcContractTable, AmcPriceTable } from "./components/AmcTables";
import { categoryLabel } from "./components/ExpenseBits";

const label = (options: { value: string; label: string }[], v: string) => options.find((o) => o.value === v)?.label ?? humanise(v);

/** A project's money in one place: what was quoted and paid, its AMC, and what was spent on it. */
export default function FinanceProject() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const { data: p, loading, error, reload } = useLoad(() => opsFinanceApi.project(id), [id]);
  const [paying, setPaying] = useState(false);

  if (error) return <p className="text-destructive">{error}</p>;

  const payments = p?.payments ?? [];
  const expenses = p?.expenses ?? [];
  const amcs = p?.amcs ?? [];

  return (
    <RecordDetailPage>
      <RecordProfileHeader
        backTo="/finance"
        backLabel="Finance"
        crumb={p?.name ?? "Project"}
        icon={FolderKanban}
        loading={loading && !p}
        eyebrow={p ? `Project money · ${p.project_code ?? "Project"} · ${p.stage}` : undefined}
        title={p?.name ?? "Project"}
        subtitle={p && <><Users aria-hidden /><Link to={`/clients/${p.client_id}`} className="hover:text-primary">{p.client_code ? `${p.client_code} · ` : ""}{p.client_name}{p.client_company ? ` · ${p.client_company}` : ""}</Link></>}
        facts={p ? [
          { icon: IndianRupee, label: "Quoted", value: rupees(p.quoted) },
          { icon: Wallet, label: "Received", value: `${rupees(p.received)} (${p.pct_collected}%)` },
          { icon: CircleDollarSign, label: "Balance", value: rupees(p.balance) },
          { icon: ShieldCheck, label: "AMC a year", value: p.amc_per_year ? rupees(p.amc_per_year) : "No AMC" },
        ] : []}
        aside={p && <ProfileLinkCard icon={FolderKanban} label="Project page" value={p.name} onClick={() => navigate(`/projects/${p.id}`)} />}
        actions={p && <>
          <Button onClick={() => setPaying(true)}><Plus className="h-4 w-4" /> Record payment</Button>
          <Button variant="outline" onClick={() => navigate(`/finance/expenses/new?project_id=${p.id}`)}><Receipt className="h-4 w-4" /> Add expense</Button>
        </>}
      />

      <DetailStats>
        <StatCard title="Received" value={p ? rupees(p.received) : "—"} subtitle={p ? `of ${rupees(p.quoted)} quoted · ${humanise(p.payment_status)}` : undefined} icon={Wallet} accent="sky" subtitleColor="muted" />
        <StatCard title="Balance" value={p ? rupees(p.balance) : "—"} subtitle={p && p.balance > 0 ? "Still to collect" : "Nothing owed"} icon={CircleDollarSign} accent="amber" subtitleColor="muted" />
        <StatCard title="AMC collected" value={p ? rupees(p.amc_collected) : "—"} subtitle={p?.amc_per_year ? `${rupees(p.amc_per_year)} a year` : "No AMC"} icon={ShieldCheck} accent="violet" subtitleColor="muted" />
        <StatCard title="Net" value={p ? rupees(p.net) : "—"} subtitle={p ? `Received + AMC − ${rupees(p.expenses_total)} spent` : undefined} icon={TrendingUp} accent="teal" subtitleColor="muted" />
      </DetailStats>

      <SectionCard icon={Wallet} title={`Payments (${payments.length})`} subtitle="Project payments and AMC — open one to see it, change it or delete it" bodyPadding=""
        headerAction={<Button size="sm" onClick={() => setPaying(true)}><Plus className="h-4 w-4" /> Record payment</Button>}>
        <ScrollableX>
          <table className="w-full text-sm">
            <thead><tr>
              <th className="text-left">Date</th><th className="text-left">For</th><th className="text-left">Mode</th>
              <th className="text-left">Reference</th><th className="text-left">Recorded by</th><th className="text-right">Amount</th>
            </tr></thead>
            <tbody>
              {payments.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">No payments yet</td></tr>}
              {payments.map((x) => (
                <tr key={x.id} className={ROW_OPEN_CLASS} {...rowOpenProps(() => navigate(`/finance/payments/${x.id}`))}>
                  <td className="whitespace-nowrap">{formatDate(x.payment_date)}</td>
                  <td>{x.type === "amc" ? <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700">AMC</Badge> : label(PAYMENT_TYPES, x.type)}</td>
                  <td>{label(PAYMENT_MODES, x.mode)}</td>
                  <td className="text-muted-foreground">{x.reference || "—"}</td>
                  <td className="text-muted-foreground">{x.recorded_by || "—"}</td>
                  <td className="text-right font-medium tabular-nums text-emerald-700">{rupees(x.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollableX>
      </SectionCard>

      {amcs.map((a) => (
        <SectionCard key={a.id} icon={ShieldCheck} title={`AMC · ${rupees(a.amount)} a year`}
          headerAction={<Button size="sm" variant="outline" onClick={() => navigate(`/amc/${a.id}`)}>Open AMC — collect or revert</Button>}>
          <div className="space-y-5">
            <AmcContractTable amc={a} />
            <div>
              <h3 className="mb-2 text-sm font-semibold text-card-foreground">Price a year</h3>
              <AmcPriceTable amc={a} />
            </div>
          </div>
        </SectionCard>
      ))}

      <SectionCard icon={Receipt} title={`Expenses (${expenses.length})`} subtitle="Spent on this project" bodyPadding=""
        headerAction={p && <Button size="sm" variant="outline" onClick={() => navigate(`/finance/expenses/new?project_id=${p.id}`)}><Plus className="h-4 w-4" /> Add expense</Button>}>
        <ScrollableX>
          <table className="w-full text-sm">
            <thead><tr>
              <th className="text-left">Date</th><th className="text-left">Category</th><th className="text-left">What for</th>
              <th className="text-left">Added by</th><th className="text-right">Amount</th>
            </tr></thead>
            <tbody>
              {expenses.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Nothing spent on this project</td></tr>}
              {expenses.map((x) => (
                <tr key={x.id} className={ROW_OPEN_CLASS} {...rowOpenProps(() => navigate(`/finance/expenses/${x.id}`))}>
                  <td className="whitespace-nowrap">{formatDate(x.date)}</td>
                  <td>{categoryLabel(x.category)}</td>
                  <td>{x.description || "—"}</td>
                  <td className="text-muted-foreground">{x.added_by || "—"}</td>
                  <td className="text-right font-medium tabular-nums text-red-600">{rupees(x.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollableX>
      </SectionCard>

      {p && (
        <PaymentDialog open={paying} onOpenChange={setPaying}
          projects={[{ id: p.id, client_id: p.client_id, name: p.name, project_code: p.project_code, balance: p.balance }]}
          onSaved={() => void reload()} />
      )}
    </RecordDetailPage>
  );
}
