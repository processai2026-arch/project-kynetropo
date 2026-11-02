/* eslint-disable react-refresh/only-export-components */
import { useEffect, useMemo, useState } from "react";
import { FileUp } from "lucide-react";
import { ActionDialog } from "@/components/ActionDialog";
import { opsFinanceApi, type ExpenseImportRow } from "@/lib/api/ops";
import { categoryLabel, monthLabel } from "./ExpenseBits";

/*
 * Import expenses from a Money Manager export (JSON): each row's date,
 * category, remark and amount. Only "Expenses" rows are imported — the
 * income in the file is client payments, which are recorded under Income.
 */

const rupees = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const num = (v: unknown) => Number(String(v ?? "").replace(/[^\d.]/g, "")) || 0;

export interface ParsedFile { expenses: ExpenseImportRow[]; incomeCount: number; incomeTotal: number; unreadable: number }

/** Reads Money Manager's JSON: [{category, remark, amount: "1,013", type: "Expenses" | "Income", date: "2026-10-29"}]. */
export function parseMoneyManager(text: string): ParsedFile {
  const data: unknown = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error("This is not a Money Manager export (expected a list of entries)");
  const out: ParsedFile = { expenses: [], incomeCount: 0, incomeTotal: 0, unreadable: 0 };
  for (const raw of data) {
    if (!raw || typeof raw !== "object") { out.unreadable++; continue; }
    const r = raw as Record<string, unknown>;
    const type = String(r.type ?? "").toLowerCase();
    const amount = num(r.amount);
    const date = String(r.date ?? "").slice(0, 10);
    if (type.startsWith("income")) { out.incomeCount++; out.incomeTotal += amount; continue; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !(amount > 0)) { out.unreadable++; continue; }
    const time = String(r.date ?? "").slice(11, 16);
    const category = String(r.category ?? "").trim();
    out.expenses.push({
      date,
      time: /^\d{2}:\d{2}$/.test(time) ? time : null,
      // "Others" and "other" are the one category.
      category: /^others?$/i.test(category) ? "other" : category || "other",
      amount,
      description: String(r.remark ?? r.note ?? "").trim(),
    });
  }
  return out;
}

/** Choose the file, see it month by month, then import; repeats are skipped. */
export function ImportExpensesDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void }) {
  const [file, setFile] = useState<ParsedFile | null>(null);
  const [name, setName] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [check, setCheck] = useState<{ added: number; added_amount: number; skipped: number } | null>(null);

  useEffect(() => { if (open) { setFile(null); setName(""); setProblem(null); setCheck(null); } }, [open]);

  const months = useMemo(() => {
    const m = new Map<string, { n: number; total: number }>();
    for (const e of file?.expenses ?? []) {
      const k = e.date.slice(0, 7);
      const v = m.get(k) ?? { n: 0, total: 0 };
      m.set(k, { n: v.n + 1, total: v.total + e.amount });
    }
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [file]);
  const categories = useMemo(() => new Set((file?.expenses ?? []).map((e) => categoryLabel(e.category))).size, [file]);

  const read = async (f: File | undefined) => {
    setFile(null); setProblem(null); setCheck(null);
    if (!f) return;
    setName(f.name);
    try {
      const parsed = parseMoneyManager(await f.text());
      if (parsed.expenses.length === 0) { setProblem("No expenses found in this file"); return; }
      setFile(parsed);
      // Ask the server what is new, so the count shown is what will really be added.
      const r = await opsFinanceApi.importExpenses(parsed.expenses, true);
      setCheck({ added: r.data.added, added_amount: r.data.added_amount, skipped: r.data.skipped.length });
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "Could not read the file");
    }
  };

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      wide
      title="Import expenses"
      description="From a Money Manager export (.json). Each expense keeps its date, category, remark and amount."
      confirmLabel={check ? `Import ${check.added} expense${check.added === 1 ? "" : "s"}` : "Import"}
      disabled={!file || !check || check.added === 0}
      successMessage={check ? `Imported ${check.added} expenses · ${rupees(check.added_amount)}` : "Imported"}
      onConfirm={async () => {
        if (!file) return;
        await opsFinanceApi.importExpenses(file.expenses);
        onDone();
      }}
    >
      <div className="space-y-4 text-sm">
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed p-4 hover:bg-muted/40">
          <FileUp className="h-6 w-6 text-primary" />
          <span className="min-w-0 flex-1">
            <span className="block font-medium text-card-foreground">{name || "Choose the file"}</span>
            <span className="block text-xs text-muted-foreground">MoneyManager_…json</span>
          </span>
          <input type="file" accept=".json,application/json" className="sr-only" onChange={(e) => void read(e.target.files?.[0])} />
        </label>

        {problem && <p className="text-destructive">{problem}</p>}

        {file && (
          <>
            <p>
              <b>{file.expenses.length}</b> expenses in {months.length} month{months.length === 1 ? "" : "s"}, {categories} categories,{" "}
              <b>{rupees(file.expenses.reduce((s, e) => s + e.amount, 0))}</b> in all.
            </p>
            {check && (
              <p className={check.added === 0 ? "text-muted-foreground" : "text-emerald-700"}>
                {check.added === 0
                  ? "All of them are already in Expenses — nothing new to add."
                  : <>{check.added} new ({rupees(check.added_amount)}) will be added{check.skipped ? `; ${check.skipped} already there will be skipped` : ""}.</>}
              </p>
            )}
            <div className="max-h-60 overflow-y-auto rounded-md border">
              <table className="w-full text-sm">
                <thead><tr className="bg-muted/50"><th className="px-3 py-2 text-left">Month</th><th className="px-3 py-2 text-right">Expenses</th><th className="px-3 py-2 text-right">Amount</th></tr></thead>
                <tbody>
                  {months.map(([m, v]) => (
                    <tr key={m} className="border-t"><td className="px-3 py-1.5">{monthLabel(m)}</td><td className="px-3 py-1.5 text-right">{v.n}</td><td className="px-3 py-1.5 text-right tabular-nums">{rupees(v.total)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            {file.incomeCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {file.incomeCount} income entries ({rupees(file.incomeTotal)}) in the file are not imported — client payments are recorded under Income.
              </p>
            )}
            {file.unreadable > 0 && <p className="text-xs text-muted-foreground">{file.unreadable} entries had no date or amount and are left out.</p>}
          </>
        )}
      </div>
    </ActionDialog>
  );
}
