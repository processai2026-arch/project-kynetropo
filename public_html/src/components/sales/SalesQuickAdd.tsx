import { useEffect, useState } from "react";
import { CalendarClock, CalendarPlus, Phone, Plus, Search, Trophy, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  salesCallsApi,
  salesChallengesApi,
  salesDashboardApi,
  salesFollowupsApi,
  salesLeadsApi,
  salesMeetingsApi,
} from "@/lib/api/sales";
import { useSalesAccess } from "@/hooks/useSalesAccess";
import { SourceSelect } from "@/components/sales/SalesBits";
import type { SalesLead } from "@/types/sales";
import { cn } from "@/lib/utils";

/**
 * The quick-add surface for the mobile sales app: one button that reaches every
 * "create" action without hunting for the right screen first.
 *
 * Log Call / Follow-Up / Meeting all need a lead, so each starts with a lead
 * picker. Every action is permission-gated — the entries are hidden when the
 * user lacks the permission, and the server refuses them regardless.
 */

type Action = "menu" | "lead" | "call" | "followup" | "meeting" | "challenge" | null;

const CALL_OUTCOMES = [
  "interested", "follow_up_required", "meeting_required", "proposal_required",
  "not_interested", "no_response", "call_back_later", "converted", "other",
] as const;

const today = () => new Date().toISOString().slice(0, 10);
const humanise = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** Searchable lead list — a plain filtered list beats a combobox on a phone. */
function LeadPicker({
  value,
  onChange,
}: {
  value: SalesLead | null;
  onChange: (lead: SalesLead | null) => void;
}) {
  const [leads, setLeads] = useState<SalesLead[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    salesLeadsApi
      .list({ limit: 200 })
      .then((r) => !cancelled && setLeads(r.data ?? []))
      .catch(() => !cancelled && toast.error("Could not load leads"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl border bg-muted/40 px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{value.company || value.name}</p>
          <p className="truncate text-xs text-muted-foreground">{value.contact_person || value.name}</p>
        </div>
        <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0" onClick={() => onChange(null)}>
          Change
        </Button>
      </div>
    );
  }

  const filtered = query
    ? leads.filter((l) =>
        `${l.name} ${l.company} ${l.contact_person} ${l.phone}`.toLowerCase().includes(query.toLowerCase()),
      )
    : leads;

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-11 pl-9"
          placeholder="Search leads…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border p-1">
        {loading ? (
          <p className="p-3 text-sm text-muted-foreground">Loading leads…</p>
        ) : filtered.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">
            {leads.length === 0 ? "No leads yet — create one first." : "No leads match that search."}
          </p>
        ) : (
          filtered.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => onChange(l)}
              className="block w-full rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted"
            >
              <p className="truncate text-sm font-medium">{l.company || l.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {l.contact_person || l.name}
                {l.phone ? ` · ${l.phone}` : ""}
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export function SalesQuickAdd({ onCreated }: { onCreated?: () => void }) {
  const { can } = useSalesAccess();
  const [action, setAction] = useState<Action>(null);
  const [saving, setSaving] = useState(false);
  const [lead, setLead] = useState<SalesLead | null>(null);

  const [leadForm, setLeadForm] = useState({ name: "", company: "", phone: "", source: "", temperature: "warm" });
  const [callForm, setCallForm] = useState({
    call_date: today(), call_time: "", duration_minutes: "", outcome: "interested",
    notes: "", temperature_after: "", next_followup_date: "",
  });
  const [fupForm, setFupForm] = useState({ due_date: today(), due_time: "", purpose: "" });
  const [meetForm, setMeetForm] = useState({
    title: "", meeting_type: "virtual", meeting_date: today(),
    meeting_time: "10:30", place: "", meeting_link: "",
  });
  const [chForm, setChForm] = useState({ title: "", description: "", deadline: "", priority: "normal" });
  const [assignees, setAssignees] = useState<number[]>([]);
  const [people, setPeople] = useState<{ user_id: number; name: string }[]>([]);

  // Who a challenge can be offered to.
  useEffect(() => {
    if (action !== "challenge" || people.length) return;
    salesDashboardApi
      .assignableUsers()
      .then(setPeople)
      .catch(() => {
        /* Not fatal — an unassigned challenge is offered to everyone. */
      });
  }, [action, people.length]);

  const close = () => {
    setAction(null);
    setLead(null);
  };

  const done = (message: string) => {
    toast.success(message);
    close();
    onCreated?.();
  };

  const guard = async (fn: () => Promise<void>, failure: string) => {
    setSaving(true);
    try {
      await fn();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : failure);
    } finally {
      setSaving(false);
    }
  };

  const items = [
    { key: "lead" as const, label: "New Lead", icon: UserPlus, show: can("sales.leads.create") },
    { key: "call" as const, label: "Log Call", icon: Phone, show: can("sales.calls.create") },
    { key: "followup" as const, label: "Add Follow-Up", icon: CalendarClock, show: can("sales.followups.create") },
    { key: "meeting" as const, label: "Schedule Meeting", icon: CalendarPlus, show: can("sales.meetings.create") },
    { key: "challenge" as const, label: "New Challenge", icon: Trophy, show: can("sales.challenges.create") },
  ].filter((i) => i.show);

  if (items.length === 0) return null;

  return (
    <>
      {/* Sits above the bottom tabs, clear of the home indicator. */}
      <button
        type="button"
        aria-label="Quick add"
        onClick={() => setAction("menu")}
        className="fixed right-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95 md:hidden"
        style={{ bottom: "calc(4.5rem + env(safe-area-inset-bottom))" }}
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Action menu */}
      <Dialog open={action === "menu"} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            {items.map((i) => (
              <Button
                key={i.key}
                variant="outline"
                className="h-14 justify-start text-base"
                onClick={() => setAction(i.key)}
              >
                <i.icon className="mr-3 h-5 w-5 text-primary" />
                {i.label}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── New Lead ──────────────────────────────────────────────────────── */}
      <Dialog open={action === "lead"} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Lead</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void guard(async () => {
                await salesLeadsApi.create({
                  name: leadForm.name.trim(),
                  company: leadForm.company.trim(),
                  phone: leadForm.phone.trim(),
                  source: leadForm.source.trim(),
                  temperature: leadForm.temperature as SalesLead["temperature"],
                });
                setLeadForm({ name: "", company: "", phone: "", source: "", temperature: "warm" });
                done("Lead created");
              }, "Could not create the lead");
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="q-lead-name">Name *</Label>
              <Input id="q-lead-name" value={leadForm.name} required
                onChange={(e) => setLeadForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="q-lead-company">Company</Label>
              <Input id="q-lead-company" value={leadForm.company}
                onChange={(e) => setLeadForm((f) => ({ ...f, company: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="q-lead-phone">Phone</Label>
              <Input id="q-lead-phone" type="tel" inputMode="tel" value={leadForm.phone}
                onChange={(e) => setLeadForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="q-lead-source">Source</Label>
              <SourceSelect
                id="q-lead-source"
                value={leadForm.source}
                onChange={(v) => setLeadForm((f) => ({ ...f, source: v }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Temperature</Label>
              <Select value={leadForm.temperature} onValueChange={(v) => setLeadForm((f) => ({ ...f, temperature: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hot">Hot</SelectItem>
                  <SelectItem value="warm">Warm</SelectItem>
                  <SelectItem value="cold">Cold</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={close}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Create"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Log Call ──────────────────────────────────────────────────────── */}
      <Dialog open={action === "call"} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Log Call</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!lead) { toast.error("Choose a lead first"); return; }
              void guard(async () => {
                await salesCallsApi.log({
                  lead_id: lead.id,
                  call_date: callForm.call_date,
                  call_time: callForm.call_time || undefined,
                  duration_minutes: callForm.duration_minutes ? Number(callForm.duration_minutes) : 0,
                  outcome: callForm.outcome,
                  notes: callForm.notes || undefined,
                  temperature_after: callForm.temperature_after || undefined,
                  next_followup_date: callForm.next_followup_date || undefined,
                });
                setCallForm((f) => ({ ...f, notes: "", duration_minutes: "", next_followup_date: "" }));
                done("Call logged");
              }, "Could not log the call");
            }}
          >
            <div className="space-y-1.5">
              <Label>Lead *</Label>
              <LeadPicker value={lead} onChange={setLead} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="q-c-date">Date</Label>
                <Input id="q-c-date" type="date" value={callForm.call_date} required
                  onChange={(e) => setCallForm((f) => ({ ...f, call_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="q-c-dur">Duration (min)</Label>
                <Input id="q-c-dur" type="number" min={0} max={1440} inputMode="numeric"
                  value={callForm.duration_minutes}
                  onChange={(e) => setCallForm((f) => ({ ...f, duration_minutes: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Outcome</Label>
              <Select value={callForm.outcome} onValueChange={(v) => setCallForm((f) => ({ ...f, outcome: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CALL_OUTCOMES.map((o) => <SelectItem key={o} value={o}>{humanise(o)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="q-c-notes">Notes</Label>
              <Textarea id="q-c-notes" rows={3} placeholder="Requirement, budget, timeline, next action…"
                value={callForm.notes}
                onChange={(e) => setCallForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-muted/50 p-3">
              <div className="space-y-1.5">
                <Label htmlFor="q-c-next">Next follow-up</Label>
                <Input id="q-c-next" type="date" min={today()} value={callForm.next_followup_date}
                  onChange={(e) => setCallForm((f) => ({ ...f, next_followup_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Temperature</Label>
                <Select value={callForm.temperature_after || "unchanged"}
                  onValueChange={(v) => setCallForm((f) => ({ ...f, temperature_after: v === "unchanged" ? "" : v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unchanged">Unchanged</SelectItem>
                    <SelectItem value="hot">Hot</SelectItem>
                    <SelectItem value="warm">Warm</SelectItem>
                    <SelectItem value="cold">Cold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={close}>Cancel</Button>
              <Button type="submit" disabled={saving || !lead}>{saving ? "Saving…" : "Save Call"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Add Follow-Up ─────────────────────────────────────────────────── */}
      <Dialog open={action === "followup"} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Follow-Up</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!lead) { toast.error("Choose a lead first"); return; }
              void guard(async () => {
                await salesFollowupsApi.create({
                  lead_id: lead.id,
                  due_date: fupForm.due_date,
                  due_time: fupForm.due_time || undefined,
                  purpose: fupForm.purpose || undefined,
                });
                setFupForm({ due_date: today(), due_time: "", purpose: "" });
                done("Follow-up added");
              }, "Could not add the follow-up");
            }}
          >
            <div className="space-y-1.5">
              <Label>Lead *</Label>
              <LeadPicker value={lead} onChange={setLead} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="q-f-date">Date *</Label>
                <Input id="q-f-date" type="date" value={fupForm.due_date} required
                  onChange={(e) => setFupForm((f) => ({ ...f, due_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="q-f-time">Time</Label>
                <Input id="q-f-time" type="time" value={fupForm.due_time}
                  onChange={(e) => setFupForm((f) => ({ ...f, due_time: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="q-f-purpose">Purpose</Label>
              <Input id="q-f-purpose" placeholder="Send proposal, confirm requirement…"
                value={fupForm.purpose}
                onChange={(e) => setFupForm((f) => ({ ...f, purpose: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={close}>Cancel</Button>
              <Button type="submit" disabled={saving || !lead}>{saving ? "Saving…" : "Add"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Schedule Meeting ──────────────────────────────────────────────── */}
      <Dialog open={action === "meeting"} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule Meeting</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!lead) { toast.error("Choose a lead first"); return; }
              void guard(async () => {
                await salesMeetingsApi.create({
                  lead_id: lead.id,
                  title: meetForm.title.trim() || `Meeting with ${lead.company || lead.name}`,
                  meeting_type: meetForm.meeting_type,
                  meeting_date: meetForm.meeting_date,
                  meeting_time: meetForm.meeting_time || undefined,
                  place: meetForm.meeting_type === "physical" ? meetForm.place : undefined,
                  meeting_link: meetForm.meeting_type === "virtual" ? meetForm.meeting_link : undefined,
                });
                setMeetForm((f) => ({ ...f, title: "", place: "", meeting_link: "" }));
                done("Meeting scheduled");
              }, "Could not schedule the meeting");
            }}
          >
            <div className="space-y-1.5">
              <Label>Lead *</Label>
              <LeadPicker value={lead} onChange={setLead} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="q-m-title">Title</Label>
              <Input id="q-m-title" value={meetForm.title}
                placeholder={lead ? `Meeting with ${lead.company || lead.name}` : "Meeting title"}
                onChange={(e) => setMeetForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={meetForm.meeting_type} onValueChange={(v) => setMeetForm((f) => ({ ...f, meeting_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="virtual">Virtual</SelectItem>
                  <SelectItem value="physical">Physical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="q-m-date">Date *</Label>
                <Input id="q-m-date" type="date" value={meetForm.meeting_date} required
                  onChange={(e) => setMeetForm((f) => ({ ...f, meeting_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="q-m-time">Time</Label>
                <Input id="q-m-time" type="time" value={meetForm.meeting_time}
                  onChange={(e) => setMeetForm((f) => ({ ...f, meeting_time: e.target.value }))} />
              </div>
            </div>
            {meetForm.meeting_type === "physical" ? (
              <div className="space-y-1.5">
                <Label htmlFor="q-m-place">Meeting place *</Label>
                <Input id="q-m-place" value={meetForm.place} required
                  onChange={(e) => setMeetForm((f) => ({ ...f, place: e.target.value }))} />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="q-m-link">Meeting link *</Label>
                <Input id="q-m-link" type="url" placeholder="https://meet.google.com/…"
                  value={meetForm.meeting_link} required
                  onChange={(e) => setMeetForm((f) => ({ ...f, meeting_link: e.target.value }))} />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={close}>Cancel</Button>
              <Button type="submit" disabled={saving || !lead}>{saving ? "Saving…" : "Schedule"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── New Challenge ─────────────────────────────────────────────────── */}
      <Dialog open={action === "challenge"} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Challenge</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void guard(async () => {
                await salesChallengesApi.create({
                  title: chForm.title.trim(),
                  description: chForm.description || undefined,
                  deadline: chForm.deadline,
                  priority: chForm.priority,
                  assignees,
                });
                setChForm({ title: "", description: "", deadline: "", priority: "normal" });
                setAssignees([]);
                done("Challenge created");
              }, "Could not create the challenge");
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="q-ch-title">Title *</Label>
              <Input id="q-ch-title" value={chForm.title} required
                placeholder="Get requirement confirmation from ABC"
                onChange={(e) => setChForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="q-ch-desc">Description</Label>
              <Textarea id="q-ch-desc" rows={2} value={chForm.description}
                onChange={(e) => setChForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="q-ch-deadline">Deadline *</Label>
                <Input id="q-ch-deadline" type="datetime-local" value={chForm.deadline} required
                  onChange={(e) => setChForm((f) => ({ ...f, deadline: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={chForm.priority} onValueChange={(v) => setChForm((f) => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Challenging who */}
            <div className="space-y-2">
              <Label>Challenging who?</Label>
              {people.length === 0 ? (
                <p className="text-xs text-muted-foreground">Loading people…</p>
              ) : (
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border p-2">
                  {people.map((p) => (
                    <label
                      key={p.user_id}
                      className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted"
                    >
                      <Checkbox
                        checked={assignees.includes(p.user_id)}
                        onCheckedChange={() =>
                          setAssignees((a) =>
                            a.includes(p.user_id) ? a.filter((x) => x !== p.user_id) : [...a, p.user_id],
                          )
                        }
                      />
                      <span className="text-sm">{p.name}</span>
                    </label>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                {assignees.length === 0
                  ? "Nobody selected — the challenge is offered to the whole sales team, and the first to accept takes it."
                  : `Offered to ${assignees.length} ${assignees.length === 1 ? "person" : "people"}. The first to accept takes it.`}
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={close}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Create"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default SalesQuickAdd;
