import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen, Check, CircleDollarSign, Eye, Landmark, Pencil,
  Plus, RefreshCw, Scale, Send, Trash2, X,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ScrollableX } from "@/components/ui/scrollable-x";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  accountingApi, type AccountPayload, type AccountType, type JournalEntry,
  type LedgerAccount, type ReportAccount,
} from "@/lib/api/accounting";

const ACCOUNT_TYPES: AccountType[] = ["asset", "liability", "equity", "income", "expense"];
const today = () => new Date().toISOString().slice(0, 10);
const yearStart = () => `${new Date().getFullYear()}-01-01`;
const money = (value: number) => `₹${Number(value || 0).toLocaleString("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;

type AccountForm = AccountPayload & { is_active: boolean };
type DraftLine = { account_id: number; description: string; debit: string; credit: string };
type JournalForm = {
  entry_date: string;
  reference: string;
  description: string;
  lines: DraftLine[];
};

const emptyAccount = (): AccountForm => ({
  code: "",
  name: "",
  type: "asset",
  description: "",
  is_active: true,
});
const emptyLine = (): DraftLine => ({ account_id: 0, description: "", debit: "", credit: "" });
const emptyJournal = (): JournalForm => ({
  entry_date: today(),
  reference: "",
  description: "",
  lines: [emptyLine(), emptyLine()],
});

function DataTable({
  headings,
  children,
  empty,
}: {
  headings: string[];
  children: ReactNode;
  empty?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <ScrollableX>
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              {headings.map((heading) => (
                <th key={heading} className="px-4 py-3 text-left font-medium whitespace-nowrap">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {empty ? (
              <tr><td colSpan={headings.length} className="px-4 py-10 text-center text-muted-foreground">No records found.</td></tr>
            ) : children}
          </tbody>
        </table>
      </ScrollableX>
    </div>
  );
}

function ReportRows({ rows }: { rows: ReportAccount[] }) {
  return (
    <>
      {rows.map((row) => (
        <tr key={row.account_id} className="border-t">
          <td className="px-4 py-3 font-mono text-xs">{row.code}</td>
          <td className="px-4 py-3">{row.name}</td>
          <td className="px-4 py-3 text-right tabular-nums">{money(row.amount)}</td>
        </tr>
      ))}
    </>
  );
}

export default function Accounting() {
  const queryClient = useQueryClient();
  const [accountOpen, setAccountOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<LedgerAccount | null>(null);
  const [accountForm, setAccountForm] = useState<AccountForm>(emptyAccount());
  const [deleteAccount, setDeleteAccount] = useState<LedgerAccount | null>(null);
  const [journalOpen, setJournalOpen] = useState(false);
  const [journalForm, setJournalForm] = useState<JournalForm>(emptyJournal());
  const [selectedJournal, setSelectedJournal] = useState<JournalEntry | null>(null);
  const [asOf, setAsOf] = useState(today());
  const [from, setFrom] = useState(yearStart());
  const [to, setTo] = useState(today());

  const accounts = useQuery({
    queryKey: ["accounting", "accounts"],
    queryFn: () => accountingApi.accounts(true),
  });
  const journals = useQuery({
    queryKey: ["accounting", "journals"],
    queryFn: () => accountingApi.journals(),
  });
  const journalDetail = useQuery({
    queryKey: ["accounting", "journal", selectedJournal?.journal_entry_id],
    queryFn: () => accountingApi.journal(selectedJournal!.journal_entry_id),
    enabled: Boolean(selectedJournal),
  });
  const trialBalance = useQuery({
    queryKey: ["accounting", "trial-balance", asOf],
    queryFn: () => accountingApi.trialBalance(asOf),
  });
  const profitLoss = useQuery({
    queryKey: ["accounting", "profit-loss", from, to],
    queryFn: () => accountingApi.profitLoss(from, to),
  });
  const balanceSheet = useQuery({
    queryKey: ["accounting", "balance-sheet", asOf],
    queryFn: () => accountingApi.balanceSheet(asOf),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["accounting"] });
  const accountMutation = useMutation({
    mutationFn: async () => editingAccount
      ? accountingApi.updateAccount(editingAccount.account_id, accountForm)
      : accountingApi.createAccount(accountForm),
    onSuccess: () => {
      toast.success(editingAccount ? "Account updated" : "Account created");
      setAccountOpen(false);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => accountingApi.deleteAccount(id),
    onSuccess: () => {
      toast.success("Account deleted");
      setDeleteAccount(null);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const journalMutation = useMutation({
    mutationFn: (post: boolean) => accountingApi.createJournal({
      entry_date: journalForm.entry_date,
      reference: journalForm.reference,
      description: journalForm.description,
      post,
      lines: journalForm.lines.map((line) => ({
        account_id: line.account_id,
        description: line.description,
        debit: Number(line.debit || 0),
        credit: Number(line.credit || 0),
      })),
    }),
    onSuccess: (entry) => {
      toast.success(entry.status === "posted" ? "Journal created and posted" : "Journal draft created");
      setJournalOpen(false);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const postMutation = useMutation({
    mutationFn: (id: number) => accountingApi.postJournal(id),
    onSuccess: () => {
      toast.success("Journal posted");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const activeAccounts = useMemo(
    () => (accounts.data ?? []).filter((account) => account.is_active),
    [accounts.data],
  );
  const journalTotals = useMemo(() => journalForm.lines.reduce(
    (totals, line) => ({
      debit: totals.debit + Number(line.debit || 0),
      credit: totals.credit + Number(line.credit || 0),
    }),
    { debit: 0, credit: 0 },
  ), [journalForm.lines]);
  const journalBalanced = journalTotals.debit > 0
    && Math.abs(journalTotals.debit - journalTotals.credit) < 0.005;

  const openCreateAccount = () => {
    setEditingAccount(null);
    setAccountForm(emptyAccount());
    setAccountOpen(true);
  };
  const openEditAccount = (account: LedgerAccount) => {
    setEditingAccount(account);
    setAccountForm({
      code: account.code,
      name: account.name,
      type: account.type,
      description: account.description ?? "",
      is_active: account.is_active,
    });
    setAccountOpen(true);
  };
  const openJournal = () => {
    setJournalForm(emptyJournal());
    setJournalOpen(true);
  };
  const updateLine = (index: number, patch: Partial<DraftLine>) => {
    setJournalForm((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line),
    }));
  };
  const removeLine = (index: number) => {
    if (journalForm.lines.length <= 2) return;
    setJournalForm((current) => ({
      ...current,
      lines: current.lines.filter((_, lineIndex) => lineIndex !== index),
    }));
  };
  const submitAccount = () => {
    if (!accountForm.code.trim() || !accountForm.name.trim()) {
      toast.error("Account code and name are required");
      return;
    }
    accountMutation.mutate();
  };
  const submitJournal = (post: boolean) => {
    if (!journalForm.description.trim()) {
      toast.error("Journal description is required");
      return;
    }
    if (!journalForm.lines.every((line) => line.account_id > 0)) {
      toast.error("Select an account for every line");
      return;
    }
    if (!journalBalanced) {
      toast.error("Total debit must equal total credit");
      return;
    }
    journalMutation.mutate(post);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Accounting</h1>
          <p className="text-muted-foreground">Double-entry ledger, chart of accounts, journals, and financial statements.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" title="Refresh accounting data" onClick={invalidate}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={openJournal}><Plus className="h-4 w-4" /> Journal entry</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Landmark className="h-4 w-4" /> Accounts</div>
          <div className="mt-2 text-2xl font-semibold">{accounts.data?.length ?? 0}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><BookOpen className="h-4 w-4" /> Journals</div>
          <div className="mt-2 text-2xl font-semibold">{journals.data?.length ?? 0}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Send className="h-4 w-4" /> Posted</div>
          <div className="mt-2 text-2xl font-semibold">{journals.data?.filter((entry) => entry.status === "posted").length ?? 0}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><CircleDollarSign className="h-4 w-4" /> Net profit</div>
          <div className="mt-2 text-xl font-semibold">{money(profitLoss.data?.net_profit ?? 0)}</div>
        </div>
      </div>

      <Tabs defaultValue="accounts" className="space-y-4">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="accounts">Chart of accounts</TabsTrigger>
          <TabsTrigger value="journals">Journal entries</TabsTrigger>
          <TabsTrigger value="trial">Trial balance</TabsTrigger>
          <TabsTrigger value="pnl">Profit & loss</TabsTrigger>
          <TabsTrigger value="balance">Balance sheet</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openCreateAccount}><Plus className="h-4 w-4" /> Account</Button>
          </div>
          <DataTable headings={["Code", "Account", "Type", "Status", "Description", "Actions"]} empty={!accounts.data?.length}>
            {accounts.data?.map((account) => (
              <tr key={account.account_id} className="border-t hover:bg-muted/30">
                <td className="px-4 py-3 font-mono text-xs">{account.code}</td>
                <td className="px-4 py-3 font-medium">{account.name}</td>
                <td className="px-4 py-3 capitalize">{account.type}</td>
                <td className="px-4 py-3">
                  <Badge variant={account.is_active ? "default" : "outline"}>{account.is_active ? "Active" : "Inactive"}</Badge>
                </td>
                <td className="max-w-64 truncate px-4 py-3 text-muted-foreground">{account.description || "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" title="Edit account" onClick={() => openEditAccount(account)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" title="Delete account" onClick={() => setDeleteAccount(account)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        </TabsContent>

        <TabsContent value="journals" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openJournal}><Plus className="h-4 w-4" /> Journal entry</Button>
          </div>
          <DataTable headings={["Number", "Date", "Description", "Reference", "Debit", "Status", "Actions"]} empty={!journals.data?.length}>
            {journals.data?.map((entry) => (
              <tr key={entry.journal_entry_id} className="border-t hover:bg-muted/30">
                <td className="px-4 py-3 font-mono text-xs">{entry.entry_number}</td>
                <td className="px-4 py-3">{entry.entry_date}</td>
                <td className="px-4 py-3 font-medium">{entry.description}</td>
                <td className="px-4 py-3 text-muted-foreground">{entry.reference || "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums">{money(entry.total_debit)}</td>
                <td className="px-4 py-3">
                  <Badge variant={entry.status === "posted" ? "default" : "outline"}>{entry.status}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" title="View journal" onClick={() => setSelectedJournal(entry)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    {entry.status === "draft" && (
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Post journal"
                        disabled={postMutation.isPending}
                        onClick={() => postMutation.mutate(entry.journal_entry_id)}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        </TabsContent>

        <TabsContent value="trial" className="space-y-4">
          <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
            <div className="space-y-1">
              <Label htmlFor="trial-as-of">As of</Label>
              <Input id="trial-as-of" type="date" value={asOf} onChange={(event) => setAsOf(event.target.value)} />
            </div>
            <Badge variant={trialBalance.data?.balanced ? "default" : "destructive"}>
              {trialBalance.data?.balanced ? <Check className="mr-1 h-3 w-3" /> : <X className="mr-1 h-3 w-3" />}
              {trialBalance.data?.balanced ? "Balanced" : "Out of balance"}
            </Badge>
          </div>
          <DataTable headings={["Code", "Account", "Type", "Closing debit", "Closing credit"]} empty={!trialBalance.data?.accounts.length}>
            {trialBalance.data?.accounts.map((account) => (
              <tr key={account.account_id} className="border-t">
                <td className="px-4 py-3 font-mono text-xs">{account.code}</td>
                <td className="px-4 py-3">{account.name}</td>
                <td className="px-4 py-3 capitalize">{account.type}</td>
                <td className="px-4 py-3 text-right tabular-nums">{money(account.closing_debit)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{money(account.closing_credit)}</td>
              </tr>
            ))}
            {trialBalance.data && (
              <tr className="border-t bg-muted/40 font-semibold">
                <td colSpan={3} className="px-4 py-3">Total</td>
                <td className="px-4 py-3 text-right">{money(trialBalance.data.total_debit)}</td>
                <td className="px-4 py-3 text-right">{money(trialBalance.data.total_credit)}</td>
              </tr>
            )}
          </DataTable>
        </TabsContent>

        <TabsContent value="pnl" className="space-y-4">
          <div className="flex flex-wrap gap-3 rounded-lg border bg-card p-4">
            <div className="space-y-1"><Label htmlFor="pnl-from">From</Label><Input id="pnl-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="pnl-to">To</Label><Input id="pnl-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <DataTable headings={["Code", "Income account", "Amount"]} empty={!profitLoss.data?.income.length}>
              <ReportRows rows={profitLoss.data?.income ?? []} />
              {profitLoss.data && <tr className="border-t bg-muted/40 font-semibold"><td colSpan={2} className="px-4 py-3">Total income</td><td className="px-4 py-3 text-right">{money(profitLoss.data.total_income)}</td></tr>}
            </DataTable>
            <DataTable headings={["Code", "Expense account", "Amount"]} empty={!profitLoss.data?.expenses.length}>
              <ReportRows rows={profitLoss.data?.expenses ?? []} />
              {profitLoss.data && <tr className="border-t bg-muted/40 font-semibold"><td colSpan={2} className="px-4 py-3">Total expenses</td><td className="px-4 py-3 text-right">{money(profitLoss.data.total_expenses)}</td></tr>}
            </DataTable>
          </div>
          <div className="flex items-center justify-between rounded-lg border bg-card p-5">
            <span className="font-medium">Net profit / (loss)</span>
            <span className="text-xl font-semibold">{money(profitLoss.data?.net_profit ?? 0)}</span>
          </div>
        </TabsContent>

        <TabsContent value="balance" className="space-y-4">
          <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
            <div className="space-y-1">
              <Label htmlFor="balance-as-of">As of</Label>
              <Input id="balance-as-of" type="date" value={asOf} onChange={(event) => setAsOf(event.target.value)} />
            </div>
            <Badge variant={balanceSheet.data?.balanced ? "default" : "destructive"}>
              <Scale className="mr-1 h-3 w-3" /> {balanceSheet.data?.balanced ? "Balanced" : "Out of balance"}
            </Badge>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <DataTable headings={["Code", "Assets", "Amount"]} empty={!balanceSheet.data?.assets.length}>
              <ReportRows rows={balanceSheet.data?.assets ?? []} />
              {balanceSheet.data && <tr className="border-t bg-muted/40 font-semibold"><td colSpan={2} className="px-4 py-3">Total assets</td><td className="px-4 py-3 text-right">{money(balanceSheet.data.total_assets)}</td></tr>}
            </DataTable>
            <DataTable headings={["Code", "Liabilities and equity", "Amount"]}>
              <ReportRows rows={balanceSheet.data?.liabilities ?? []} />
              <ReportRows rows={balanceSheet.data?.equity ?? []} />
              {balanceSheet.data && (
                <>
                  <tr className="border-t"><td className="px-4 py-3 font-mono text-xs">RE</td><td className="px-4 py-3">Retained earnings</td><td className="px-4 py-3 text-right">{money(balanceSheet.data.retained_earnings)}</td></tr>
                  <tr className="border-t bg-muted/40 font-semibold"><td colSpan={2} className="px-4 py-3">Total liabilities and equity</td><td className="px-4 py-3 text-right">{money(balanceSheet.data.total_liabilities_and_equity)}</td></tr>
                </>
              )}
            </DataTable>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingAccount ? "Edit account" : "Create account"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label htmlFor="account-code">Code</Label><Input id="account-code" value={accountForm.code} onChange={(event) => setAccountForm({ ...accountForm, code: event.target.value })} /></div>
              <div className="space-y-1">
                <Label>Type</Label>
                <Select value={accountForm.type} onValueChange={(value) => setAccountForm({ ...accountForm, type: value as AccountType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ACCOUNT_TYPES.map((type) => <SelectItem key={type} value={type} className="capitalize">{type}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1"><Label htmlFor="account-name">Name</Label><Input id="account-name" value={accountForm.name} onChange={(event) => setAccountForm({ ...accountForm, name: event.target.value })} /></div>
            <div className="space-y-1"><Label htmlFor="account-description">Description</Label><Textarea id="account-description" value={accountForm.description} onChange={(event) => setAccountForm({ ...accountForm, description: event.target.value })} /></div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={accountForm.is_active ? "active" : "inactive"} onValueChange={(value) => setAccountForm({ ...accountForm, is_active: value === "active" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={submitAccount} disabled={accountMutation.isPending}>{editingAccount ? "Save changes" : "Create account"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={journalOpen} onOpenChange={setJournalOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader><DialogTitle>Manual journal entry</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1"><Label htmlFor="entry-date">Entry date</Label><Input id="entry-date" type="date" value={journalForm.entry_date} onChange={(event) => setJournalForm({ ...journalForm, entry_date: event.target.value })} /></div>
              <div className="space-y-1"><Label htmlFor="reference">Reference</Label><Input id="reference" value={journalForm.reference} onChange={(event) => setJournalForm({ ...journalForm, reference: event.target.value })} /></div>
              <div className="space-y-1"><Label htmlFor="journal-description">Description</Label><Input id="journal-description" value={journalForm.description} onChange={(event) => setJournalForm({ ...journalForm, description: event.target.value })} /></div>
            </div>
            <ScrollableX>
              <table className="w-full min-w-[820px] text-sm">
                <thead className="bg-muted/50 text-muted-foreground"><tr><th className="px-3 py-2 text-left">Account</th><th className="px-3 py-2 text-left">Line description</th><th className="px-3 py-2 text-right">Debit</th><th className="px-3 py-2 text-right">Credit</th><th className="w-10" /></tr></thead>
                <tbody>
                  {journalForm.lines.map((line, index) => (
                    <tr key={index} className="border-t">
                      <td className="px-2 py-2">
                        <Select value={line.account_id ? String(line.account_id) : ""} onValueChange={(value) => updateLine(index, { account_id: Number(value) })}>
                          <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                          <SelectContent>{activeAccounts.map((account) => <SelectItem key={account.account_id} value={String(account.account_id)}>{account.code} · {account.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-2"><Input value={line.description} onChange={(event) => updateLine(index, { description: event.target.value })} /></td>
                      <td className="px-2 py-2"><Input className="text-right" type="number" min="0" step="0.01" value={line.debit} onChange={(event) => updateLine(index, { debit: event.target.value, credit: event.target.value ? "" : line.credit })} /></td>
                      <td className="px-2 py-2"><Input className="text-right" type="number" min="0" step="0.01" value={line.credit} onChange={(event) => updateLine(index, { credit: event.target.value, debit: event.target.value ? "" : line.debit })} /></td>
                      <td className="px-2 py-2"><Button size="icon" variant="ghost" title="Remove line" disabled={journalForm.lines.length <= 2} onClick={() => removeLine(index)}><Trash2 className="h-4 w-4" /></Button></td>
                    </tr>
                  ))}
                  <tr className="border-t bg-muted/30 font-semibold">
                    <td className="px-3 py-3"><Button size="sm" variant="outline" onClick={() => setJournalForm((current) => ({ ...current, lines: [...current.lines, emptyLine()] }))}><Plus className="h-4 w-4" /> Line</Button></td>
                    <td className="px-3 py-3 text-right">Totals</td>
                    <td className="px-3 py-3 text-right">{money(journalTotals.debit)}</td>
                    <td className="px-3 py-3 text-right">{money(journalTotals.credit)}</td>
                    <td className="px-3 py-3">{journalBalanced ? <Check className="h-4 w-4 text-emerald-600" /> : <X className="h-4 w-4 text-destructive" />}</td>
                  </tr>
                </tbody>
              </table>
            </ScrollableX>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={journalMutation.isPending} onClick={() => submitJournal(false)}>Save draft</Button>
            <Button disabled={journalMutation.isPending || !journalBalanced} onClick={() => submitJournal(true)}><Send className="h-4 w-4" /> Save and post</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedJournal)} onOpenChange={(open) => !open && setSelectedJournal(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>{selectedJournal?.entry_number ?? "Journal entry"}</DialogTitle></DialogHeader>
          <div className="flex flex-wrap gap-4 text-sm">
            <span>{journalDetail.data?.entry_date}</span>
            <Badge variant={journalDetail.data?.status === "posted" ? "default" : "outline"}>{journalDetail.data?.status}</Badge>
            <span className="text-muted-foreground">{journalDetail.data?.description}</span>
          </div>
          <DataTable headings={["Account", "Description", "Debit", "Credit"]} empty={!journalDetail.data?.lines?.length}>
            {journalDetail.data?.lines?.map((line) => (
              <tr key={line.journal_line_id} className="border-t">
                <td className="px-4 py-3">{line.account_code} · {line.account_name}</td>
                <td className="px-4 py-3 text-muted-foreground">{line.description || "—"}</td>
                <td className="px-4 py-3 text-right">{money(line.debit)}</td>
                <td className="px-4 py-3 text-right">{money(line.credit)}</td>
              </tr>
            ))}
          </DataTable>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteAccount)} onOpenChange={(open) => !open && setDeleteAccount(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete account?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteAccount?.code} · {deleteAccount?.name}. Accounts with journal activity cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteAccount && deleteMutation.mutate(deleteAccount.account_id)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
