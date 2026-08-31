import { useState, useEffect } from "react";
import { toast } from "sonner";
import { BarChart3, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/StatCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { gstApi } from "@/lib/api/gst";
import { apiFetch } from "@/lib/api/client";
import type { GstSummary, HsnSummaryRow } from "@/types/gst";

const TABS = ["Overview", "Monthly Ledger", "B2B", "B2C", "HSN Summary", "Download Reports"] as const;
type Tab = typeof TABS[number];

export default function GstReturns() {
  const [tab, setTab] = useState<Tab>("Overview");
  const [year, setYear] = useState(new Date().getFullYear());
  const [summary, setSummary] = useState<GstSummary | null>(null);
  const [hsnRows, setHsnRows] = useState<HsnSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hsnLoading, setHsnLoading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  // Download period — default to current month
  const today = new Date();
  const [dlFrom, setDlFrom] = useState(`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-01`);
  const [dlTo, setDlTo] = useState(today.toISOString().slice(0,10));
  const [dlPeriod, setDlPeriod] = useState<"month"|"quarter"|"fy"|"custom">("month");

  const applyPeriod = (p: "month"|"quarter"|"fy"|"custom") => {
    setDlPeriod(p);
    const now = new Date();
    const y = now.getFullYear(); const m = now.getMonth()+1;
    const fyStart = m >= 4 ? `${y}-04-01` : `${y-1}-04-01`;
    if (p === "month") { setDlFrom(`${y}-${String(m).padStart(2,'0')}-01`); setDlTo(now.toISOString().slice(0,10)); }
    else if (p === "quarter") {
      const qStart = m<=6 ? (m<=3?1:4) : (m<=9?7:10);
      setDlFrom(`${y}-${String(qStart).padStart(2,'0')}-01`);
      setDlTo(now.toISOString().slice(0,10));
    }
    else if (p === "fy") { setDlFrom(fyStart); setDlTo(now.toISOString().slice(0,10)); }
  };

  const load = async () => {
    setLoading(true);
    try {
      const s = await gstApi.summary(year);
      setSummary(s);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load GST summary");
    } finally { setLoading(false); }
  };

  const loadHsn = async () => {
    setHsnLoading(true);
    try {
      const rows = await gstApi.hsnSummary();
      setHsnRows(rows);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load HSN summary");
    } finally { setHsnLoading(false); }
  };

  useEffect(() => { load(); }, [year]);
  useEffect(() => { if (tab === "HSN Summary") loadHsn(); }, [tab]);

  const handleDownload = async (type: string) => {
    setDownloading(type);
    try {
      const from = dlFrom;
      const to   = dlTo;
      const genRes = await apiFetch<{ data: { report_id: string } }>("/admin/reports/generate", {
        method: "POST",
        body: JSON.stringify({ type, from_date: from, to_date: to, format: "excel" }),
      });
      const reportId = genRes.data?.report_id;
      if (!reportId) { toast.error("Failed to generate report"); return; }
      toast.success("Downloading…");
      const raw = localStorage.getItem("erp_admin_auth");
      const token = raw ? JSON.parse(raw).token ?? "" : "";
      const dlRes = await fetch(`${import.meta.env.VITE_API_BASE_URL}/admin/reports/${reportId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!dlRes.ok) throw new Error("Download failed");
      const blob = await dlRes.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = `${type}_gst_report.xls`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed");
    } finally { setDownloading(null); }
  };

  const fyYears = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-foreground">GST Filing</h1>
        <select value={year} onChange={e => setYear(Number(e.target.value))} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
          {fyYears.map(y => <option key={y} value={y}>FY {y}-{String(y+1).slice(2)}</option>)}
        </select>
      </div>

      <div className="flex gap-0 border-b overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t as Tab)} className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {loading ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />) : (
              <>
                <StatCard title="Output Tax Collected" value={summary ? `₹${summary.output_tax.toLocaleString("en-IN")}` : "—"} subtitle={summary?.financial_year} icon={BarChart3} subtitleColor="muted" />
                <StatCard title="Input Tax Credit" value={summary ? `₹${summary.input_tax_credit.toLocaleString("en-IN")}` : "—"} subtitle="ITC claimable" icon={BarChart3} subtitleColor="primary" />
                <StatCard title="Net GST Payable" value={summary ? `₹${summary.net_payable.toLocaleString("en-IN")}` : "—"} icon={BarChart3} subtitleColor="muted" />
              </>
            )}
          </div>
          <div className="bg-card rounded-xl border shadow-sm">
            <div className="p-4 border-b"><h2 className="text-base font-semibold text-card-foreground">Quarterly Summary</h2></div>
            <div className="p-4 overflow-x-auto eco-float-scroll">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/50">{["Quarter","Output Tax","Input Credit","Net Payable"].map(h => <th key={h} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>)}</tr></thead>
                <tbody>
                  {loading && Array.from({ length: 5 }).map((_, i) => <tr key={i} className="border-b">{Array.from({ length: 5 }).map((_, j) => <td key={j} className="py-3 px-4"><Skeleton className="h-4 w-20" /></td>)}</tr>)}
                  {!loading && (summary?.quarterly ?? []).length === 0 && <tr><td colSpan={4} className="px-6 py-8 text-center text-muted-foreground text-sm">No GST data yet — approve some invoices to see quarterly breakdown</td></tr>}
                  {!loading && (summary?.quarterly ?? []).map(q => (
                    <tr key={q.quarter} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-medium text-card-foreground">{q.quarter}</td>
                      <td className="py-3 px-4 text-card-foreground">₹{q.output.toLocaleString("en-IN")}</td>
                      <td className="py-3 px-4 text-muted-foreground">₹{q.input.toLocaleString("en-IN")}</td>
                      <td className="py-3 px-4 font-semibold text-amber-600">₹{q.payable.toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === "Monthly Ledger" && (
        <div className="bg-card rounded-xl border shadow-sm">
          <div className="p-4 border-b"><h2 className="text-base font-semibold text-card-foreground">Monthly GST Ledger — FY {summary?.financial_year}</h2></div>
          <div className="p-4 overflow-x-auto eco-float-scroll">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50">{["Month","Taxable Value","CGST","SGST","IGST","Total Tax"].map(h => <th key={h} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>)}</tr></thead>
              <tbody>
                {loading && Array.from({ length: 5 }).map((_, i) => <tr key={i} className="border-b">{Array.from({ length: 5 }).map((_, j) => <td key={j} className="py-3 px-4"><Skeleton className="h-4 w-20" /></td>)}</tr>)}
                {!loading && (summary?.monthly ?? []).length === 0 && <tr><td colSpan={6} className="px-6 py-8 text-center text-muted-foreground text-sm">No GST records for this FY</td></tr>}
                {!loading && (summary?.monthly ?? []).map(m => (
                  <tr key={m.month_num} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-medium text-card-foreground">{m.month_name}</td>
                    <td className="py-3 px-4 text-card-foreground">₹{m.taxable_value.toLocaleString("en-IN")}</td>
                    <td className="py-3 px-4 text-card-foreground">₹{m.cgst.toLocaleString("en-IN")}</td>
                    <td className="py-3 px-4 text-card-foreground">₹{m.sgst.toLocaleString("en-IN")}</td>
                    <td className="py-3 px-4 text-card-foreground">₹{m.igst.toLocaleString("en-IN")}</td>
                    <td className="py-3 px-4 font-semibold text-amber-600">₹{m.total.toLocaleString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "B2B" && (
        <div className="bg-card rounded-xl border shadow-sm p-8 text-center">
          <p className="text-4xl mb-3">🏢</p>
          <p className="font-semibold text-card-foreground mb-1">B2B Transactions</p>
          <p className="text-sm text-muted-foreground">B2B GST report (where customer has a GSTIN) will appear here after approving B2B invoices.</p>
        </div>
      )}

      {tab === "B2C" && (
        <div className="bg-card rounded-xl border shadow-sm p-8 text-center">
          <p className="text-4xl mb-3">👤</p>
          <p className="font-semibold text-card-foreground mb-1">B2C Transactions</p>
          <p className="text-sm text-muted-foreground">B2C GST report (retail sales without GSTIN) will appear here after approving invoices.</p>
        </div>
      )}

      {tab === "HSN Summary" && (
        <div className="bg-card rounded-xl border shadow-sm">
          <div className="p-4 border-b"><h2 className="text-base font-semibold text-card-foreground">HSN-wise Summary</h2></div>
          <div className="p-4 overflow-x-auto eco-float-scroll">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50">{["HSN Code","Transactions","Taxable Value","Total Tax"].map(h => <th key={h} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>)}</tr></thead>
              <tbody>
                {hsnLoading && Array.from({ length: 5 }).map((_, i) => <tr key={i} className="border-b">{Array.from({ length: 5 }).map((_, j) => <td key={j} className="py-3 px-4"><Skeleton className="h-4 w-24" /></td>)}</tr>)}
                {!hsnLoading && hsnRows.length === 0 && <tr><td colSpan={4} className="px-6 py-8 text-center text-muted-foreground text-sm">No HSN records found</td></tr>}
                {!hsnLoading && hsnRows.map(r => (
                  <tr key={r.hsn_code} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-mono text-card-foreground">{r.hsn_code}</td>
                    <td className="py-3 px-4 text-muted-foreground">{r.txn_count}</td>
                    <td className="py-3 px-4 text-card-foreground">₹{r.taxable_value.toLocaleString("en-IN")}</td>
                    <td className="py-3 px-4 font-semibold text-card-foreground">₹{r.total_tax.toLocaleString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "Download Reports" && (
        <div className="space-y-5">
          {/* Period selector */}
          <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-card-foreground">Select Period</p>
            <div className="flex flex-wrap gap-2">
              {(["month","quarter","fy","custom"] as const).map(p => (
                <button key={p} onClick={() => applyPeriod(p)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${dlPeriod===p ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}>
                  {p==="month"?"This Month":p==="quarter"?"This Quarter":p==="fy"?"Full FY":"Custom"}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs">From</Label>
                <Input type="date" value={dlFrom} onChange={e => { setDlFrom(e.target.value); setDlPeriod("custom"); }} className="w-36 h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">To</Label>
                <Input type="date" value={dlTo} onChange={e => { setDlTo(e.target.value); setDlPeriod("custom"); }} className="w-36 h-8 text-xs" />
              </div>
              <p className="text-xs text-muted-foreground pb-1">Reports will cover invoices from {dlFrom} to {dlTo}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { type: "gst",       title: "GSTR-1 / GST Report",  desc: "All sales with customer & HSN details — taxable value, CGST, SGST, IGST per transaction" },
              { type: "gst",       title: "GSTR-3B Summary",       desc: "Summary return — total taxable value & tax payable for the selected period" },
              { type: "inventory", title: "HSN Summary",            desc: "HSN-wise consolidated report for selected period" },
            ].map((r, i) => (
              <div key={i} className="bg-card border rounded-xl p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-card-foreground mb-1">{r.title}</h3>
                <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{r.desc}</p>
                <Button variant="outline" size="sm" className="w-full" onClick={() => handleDownload(r.type)} disabled={downloading === r.type}>
                  {downloading === r.type ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1.5" />}
                  Download Excel
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
