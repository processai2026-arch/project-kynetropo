/* eslint-disable react-refresh/only-export-components */
import { useEffect, useRef, useState } from "react";
import { Check, CheckCircle2, FileText, RotateCcw, Send, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SectionCard } from "@/components/SectionCard";
import { useConfirm } from "@/components/ConfirmDialog";
import { Avatar, List, Pill, Row, type Tone } from "@/components/phone/PhoneKit";
import { toast } from "sonner";
import { salesQuotationsApi } from "@/lib/api/sales";
import { formatDate } from "@/components/sales/SalesBits";
import { cn } from "@/lib/utils";
import type { SalesQuotation } from "@/types/sales";

/*
 * The quotation loop between the meeting and onboarding: a quotation is sent,
 * it is rejected (and why), a revised one is sent again, and so on until one is
 * accepted — which moves the lead to onboarding and its customer to "Quotation
 * Accepted". Each round is a line in the history, version by version.
 */

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

const STATUS: Record<SalesQuotation["status"], { label: string; tone: Tone }> = {
  sent: { label: "Waiting for answer", tone: "warning" },
  rejected: { label: "Rejected", tone: "danger" },
  accepted: { label: "Accepted", tone: "success" },
};

/** Where the loop stands, in one line — also the note under "Quotation Sent" on the pipeline. */
export function quotationSummary(rounds: SalesQuotation[] | undefined): string | null {
  const q = rounds?.[0];
  if (!q) return null;
  const v = `v${q.version}`;
  if (q.status === "accepted") return `${v} accepted`;
  if (q.status === "rejected") return `${v} rejected`;
  return q.version > 1 ? `${v} sent again` : `${v} sent`;
}

type Ask = { kind: "send" } | { kind: "answer"; answer: "rejected" | "accepted"; q: SalesQuotation } | null;

/** The buttons for the next move, and the two small forms they open. */
function useQuotationActions(leadId: number, rounds: SalesQuotation[], changed: (rounds: SalesQuotation[]) => void) {
  // Every call answers with all the rounds; anything else keeps what is shown.
  const onChanged = (next: unknown) => changed(Array.isArray(next) ? next as SalesQuotation[] : rounds);
  const [ask, setAsk] = useState<Ask>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const confirm = useConfirm();
  const latest = rounds[0] ?? null;

  const open = (next: Ask) => {
    // A resend starts from the last price, the thing most often changed.
    setAmount(next?.kind === "send" && latest?.amount != null ? String(latest.amount) : "");
    setDate(today());
    setNotes("");
    setAsk(next);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ask) return;
    setSaving(true);
    try {
      if (ask.kind === "send") {
        const value = amount.trim() === "" ? null : Number(amount);
        if (value !== null && (!Number.isFinite(value) || value < 0)) throw new Error("Amount must be a number");
        onChanged(await salesQuotationsApi.send(leadId, { amount: value, sent_on: date, notes: notes.trim() }));
        toast.success(latest ? `Quotation v${latest.version + 1} sent again` : "Quotation sent");
      } else {
        if (ask.answer === "rejected" && !notes.trim()) throw new Error("Say why it was rejected");
        onChanged(await salesQuotationsApi.answer(ask.q.id, { answer: ask.answer, note: notes.trim(), answered_on: date }));
        toast.success(ask.answer === "accepted" ? "Accepted — moved to onboarding" : "Marked rejected — send a revised one when ready");
      }
      setAsk(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (q: SalesQuotation) => {
    const ok = await confirm({
      title: `Remove quotation v${q.version}?`,
      description: "Only for one entered by mistake. The lead's stage is not moved back.",
      confirmLabel: "Remove",
      destructive: true,
    });
    if (!ok) return;
    try {
      onChanged(await salesQuotationsApi.remove(q.id));
      toast.success("Quotation removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove it");
    }
  };

  const title = ask?.kind === "send"
    ? (latest ? `Send quotation v${latest.version + 1}` : "Send quotation")
    : ask?.answer === "accepted" ? `Quotation v${ask.q.version} accepted` : ask ? `Quotation v${ask.q.version} rejected` : "";

  const dialog = (
    <Dialog open={ask !== null} onOpenChange={(o) => !o && setAsk(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {ask?.kind === "send"
              ? latest ? `v${latest.version} was rejected${latest.answer_note ? `: ${latest.answer_note}` : ""}` : "The first quotation for this lead."
              : ask?.answer === "accepted" ? "The lead moves to onboarding, and its customer to Quotation Accepted." : "Say why, so the next quotation can answer it."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {ask?.kind === "send" && (
            <div className="space-y-1.5">
              <Label htmlFor="q-amount">Amount (₹)</Label>
              <Input id="q-amount" type="number" inputMode="decimal" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 45000" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="q-date">{ask?.kind === "send" ? "Sent on" : "Answered on"}</Label>
            <Input id="q-date" type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="q-notes">
              {ask?.kind === "send" ? (latest ? "What changed from the last one?" : "What is in it? (optional)")
                : ask?.answer === "rejected" ? "Why was it rejected?" : "Anything they said? (optional)"}
            </Label>
            <Textarea id="q-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder={ask?.kind === "answer" && ask.answer === "rejected" ? "Price too high, scope, timing…" : ""} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setAsk(null)}>Back</Button>
            <Button type="submit" disabled={saving} variant={ask?.kind === "answer" && ask.answer === "rejected" ? "destructive" : "default"}>
              {saving ? "Saving…" : ask?.kind === "send" ? "Send" : ask?.answer === "accepted" ? "Accepted" : "Rejected"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );

  return { latest, open, remove, dialog };
}

/** What the next move is, as buttons: send / send again, or rejected / accepted. */
function NextMove({ latest, open, phone }: { latest: SalesQuotation | null; open: (a: Ask) => void; phone?: boolean }) {
  const h = phone ? "h-12 text-base" : "h-10";
  if (!latest || latest.status === "rejected") {
    return (
      <Button className={cn(h, "w-full")} onClick={() => open({ kind: "send" })}>
        {latest ? <RotateCcw className="mr-1.5 h-4 w-4" /> : <Send className="mr-1.5 h-4 w-4" />}
        {latest ? `Send again (v${latest.version + 1})` : "Send quotation"}
      </Button>
    );
  }
  if (latest.status === "sent") {
    return (
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" className={cn(h, "border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive")}
          onClick={() => open({ kind: "answer", answer: "rejected", q: latest })}>
          <XCircle className="mr-1.5 h-4 w-4" />Rejected
        </Button>
        <Button className={cn(h, "bg-emerald-600 hover:bg-emerald-700")} onClick={() => open({ kind: "answer", answer: "accepted", q: latest })}>
          <CheckCircle2 className="mr-1.5 h-4 w-4" />Accepted
        </Button>
      </div>
    );
  }
  return null;
}

/** The loop as four steps: sent, rejected, sent again, accepted — lit as far as it has gone. */
function LoopSteps({ rounds }: { rounds: SalesQuotation[] }) {
  const latest = rounds[0];
  const rejected = rounds.filter((q) => q.status === "rejected").length;
  const steps = [
    { label: "Sent", on: rounds.length > 0 },
    { label: rejected > 1 ? `Rejected ×${rejected}` : "Rejected", on: rejected > 0 },
    { label: "Sent again", on: rounds.length > 1 },
    { label: "Accepted", on: latest?.status === "accepted" },
  ];
  return (
    <ol className="flex items-start">
      {steps.map((st, i) => (
        <li key={st.label} className="flex flex-1 flex-col items-center gap-1 text-center">
          <div className="flex w-full items-center">
            <span className={cn("h-0.5 flex-1", i === 0 ? "bg-transparent" : st.on ? "bg-primary/60" : "bg-border")} />
            <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full border-2",
              st.on ? (i === 1 ? "border-destructive/60 bg-destructive/10 text-destructive" : "border-primary bg-primary text-primary-foreground") : "border-border text-muted-foreground")}>
              {st.on ? (i === 1 ? <XCircle className="h-4 w-4" /> : <Check className="h-4 w-4" />) : null}
            </span>
            <span className={cn("h-0.5 flex-1", i === steps.length - 1 ? "bg-transparent" : steps[i + 1].on ? "bg-primary/60" : "bg-border")} />
          </div>
          <span className={cn("text-[11px] leading-tight", st.on ? "font-medium text-foreground" : "text-muted-foreground")}>{st.label}</span>
        </li>
      ))}
    </ol>
  );
}

function RoundBody({ q }: { q: SalesQuotation }) {
  return (
    <>
      {q.notes && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">{q.notes}</p>}
      {q.status !== "sent" && (
        <p className={cn("mt-1 whitespace-pre-wrap break-words text-sm", q.status === "rejected" ? "text-destructive" : "text-emerald-700 dark:text-emerald-400")}>
          {q.status === "rejected" ? "Rejected" : "Accepted"} {formatDate(q.answered_on)}{q.answer_note ? ` — ${q.answer_note}` : ""}
        </p>
      )}
    </>
  );
}

/** The quotation card on a computer: the lead's page and the client's page. */
export function QuotationCard({ leadId, rounds: initial, canEdit, onChanged }: {
  leadId: number; rounds: SalesQuotation[] | undefined; canEdit: boolean; onChanged?: () => void;
}) {
  const [rounds, setRounds] = useState<SalesQuotation[]>(initial ?? []);
  useEffect(() => setRounds(initial ?? []), [initial]);
  const { latest, open, remove, dialog } = useQuotationActions(leadId, rounds, (r) => { setRounds(r); onChanged?.(); });

  return (
    <SectionCard icon={FileText} title="Quotation" subtitle={quotationSummary(rounds) ?? "Not sent yet"}>
      <div className="space-y-4">
        <LoopSteps rounds={rounds} />
        {canEdit && <div className="max-w-md"><NextMove latest={latest} open={open} /></div>}
        {rounds.length > 0 && (
          <ul className="divide-y rounded-xl border">
            {rounds.map((q) => (
              <li key={q.id} className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">v{q.version}</span>
                    {q.amount != null && <span className="font-medium tabular-nums">{inr(q.amount)}</span>}
                    <span className="text-xs text-muted-foreground">sent {formatDate(q.sent_on)}{q.created_by_name ? ` by ${q.created_by_name}` : ""}</span>
                    <Pill tone={STATUS[q.status].tone}>{STATUS[q.status].label}</Pill>
                  </div>
                  <RoundBody q={q} />
                </div>
                {canEdit && q.id === latest?.id && (
                  <Button size="sm" variant="ghost" className="h-8 px-2 text-muted-foreground hover:text-destructive" aria-label="Remove this quotation" title="Remove — entered by mistake" onClick={() => void remove(q)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      {dialog}
    </SectionCard>
  );
}

/** The same in the phone app: the four steps, a big button for the next move, and the rounds as rows. */
export function PhoneQuotation({ leadId, rounds: initial, canEdit, onChanged }: {
  leadId: number; rounds: SalesQuotation[] | undefined; canEdit: boolean; onChanged?: () => void;
}) {
  const [rounds, setRounds] = useState<SalesQuotation[]>(initial ?? []);
  useEffect(() => setRounds(initial ?? []), [initial]);
  const { latest, open, remove, dialog } = useQuotationActions(leadId, rounds, (r) => { setRounds(r); onChanged?.(); });

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 px-1 pt-1">
        <h2 className="flex-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quotation</h2>
        <span className="text-xs text-muted-foreground">{quotationSummary(rounds) ?? "Not sent yet"}</span>
      </div>
      <div className="space-y-4 rounded-2xl border bg-card p-4">
        <LoopSteps rounds={rounds} />
        {canEdit && <NextMove latest={latest} open={open} phone />}
      </div>
      {rounds.length > 0 && (
        <List>
          {rounds.map((q) => (
            <div key={q.id} className="flex items-start">
              <div className="min-w-0 flex-1">
                <Row avatar={<Avatar name={`v ${q.version}`} tone={STATUS[q.status].tone} />}
                  title={q.amount != null ? <span className="tabular-nums">{inr(q.amount)}</span> : `Quotation v${q.version}`}
                  meta={formatDate(q.sent_on)}
                  sub={<span className="block whitespace-normal"><Pill tone={STATUS[q.status].tone}>{STATUS[q.status].label}</Pill><RoundBody q={q} /></span>} />
              </div>
              {canEdit && q.id === latest?.id && (
                <button type="button" aria-label="Remove this quotation" onClick={() => void remove(q)}
                  className="mr-3 mt-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground active:bg-muted/70">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </List>
      )}
      {dialog}
    </section>
  );
}

/**
 * A pipeline for the phone: the steps in a line that scrolls sideways, done
 * ones ticked, the current one filled and brought into view, with a small note
 * under a step when there is one (the quotation's state under "Quotation").
 */
export function PhonePipeline({ steps, current, notes }: { steps: readonly string[]; current: string; notes?: Record<string, string | null | undefined> }) {
  const strip = useRef<HTMLOListElement>(null);
  const at = steps.indexOf(current);
  useEffect(() => {
    const el = strip.current;
    const now = el?.querySelector<HTMLElement>('[data-now="true"]');
    if (el && now) el.scrollLeft = now.offsetLeft - el.clientWidth / 2 + now.clientWidth / 2;
  }, [current]);
  return (
    <section className="rounded-2xl border bg-card py-3">
      <div className="flex items-baseline justify-between px-4">
        <h2 className="text-sm font-semibold text-muted-foreground">Pipeline</h2>
        {at >= 0 && <span className="text-xs text-muted-foreground">Step {at + 1} of {steps.length}</span>}
      </div>
      <ol ref={strip} className="eco-noscrollbar mt-3 flex overflow-x-auto px-2">
        {steps.map((step, i) => {
          const done = at >= 0 && i < at;
          const now = i === at;
          return (
            <li key={step} data-now={now} className="flex w-[5.25rem] shrink-0 flex-col items-center gap-1 text-center">
              <div className="flex w-full items-center">
                <span className={cn("h-0.5 flex-1", i === 0 ? "bg-transparent" : done || now ? "bg-primary/60" : "bg-border")} />
                <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full border-2",
                  now ? "border-primary bg-primary text-primary-foreground" : done ? "border-primary/60 bg-primary/10 text-primary" : "border-border")}>
                  {now ? <span className="h-2.5 w-2.5 rounded-full bg-primary-foreground" /> : done ? <Check className="h-4 w-4" /> : null}
                </span>
                <span className={cn("h-0.5 flex-1", i === steps.length - 1 ? "bg-transparent" : done ? "bg-primary/60" : "bg-border")} />
              </div>
              <span className={cn("px-0.5 text-[11px] leading-tight", now ? "font-semibold text-foreground" : "text-muted-foreground")}>{step}</span>
              {notes?.[step] ? <span className="px-0.5 text-[10px] font-medium leading-tight text-primary">{notes[step]}</span> : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
