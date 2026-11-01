import { useEffect, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Building2, List, Mail, Megaphone, Phone, StickyNote, UserPlus, UserRound, Workflow } from "lucide-react";
import { RecordFormPage, FormLayout, FormSectionCard, IconInput } from "@/components/RecordFormPage";
import { Field } from "@/components/Field";
import { SavingButton } from "@/components/SavingButton";
import { PageHeader } from "@/components/PageHeader";
import { ActionBar, Loading, usePhoneApp } from "@/components/phone/PhoneKit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SalesLayout } from "@/components/sales/SalesLayout";
import { SourceSelect, humanise } from "@/components/sales/SalesBits";
import { salesLeadsApi } from "@/lib/api/sales";
import { useSalesAccess } from "@/hooks/useSalesAccess";
import { useTeamMembers, namesakeHint } from "@/hooks/useTeamMembers";
import type { LeadStatus, LeadTemperature, SalesLead } from "@/types/sales";

/**
 * Add a lead (/sales/leads/new) or edit one (/sales/leads/:id/edit) — a page,
 * not a popup, as in Eco Sudar and Diamond Fencing. Every field, on the phone
 * as on the computer: the phone gets the top bar and the save button pinned at
 * the bottom, the computer the section cards.
 *
 * Stage moves only between the pipeline stages: Onboarding and Converted
 * create the customer record, so they are reached from the lead, not set here.
 */

const TEMPERATURES: LeadTemperature[] = ["hot", "warm", "cold"];
const PIPELINE: LeadStatus[] = ["new", "contacted", "qualified", "meeting_scheduled", "proposal", "lost"];
const LIFECYCLE: LeadStatus[] = ["onboarding", "converted"];

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const EMPTY = {
  name: "",
  company: "",
  contact_person: "",
  phone: "",
  email: "",
  source: "",
  source_chapter: "",
  source_pitch_id: "",
  temperature: "warm" as LeadTemperature,
  status: "new" as LeadStatus,
  notes: "",
  assigned_to: "",
  acquired_on: "",
  current_software: "",
  switch_reason: "",
};

/** A white block of the phone form, with its heading. */
function PhoneSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border bg-card p-4">
      <h2 className="text-sm font-semibold text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

export default function SalesLeadForm() {
  const { id } = useParams();
  const editingId = id ? Number(id) : null;
  const navigate = useNavigate();
  const phone = usePhoneApp();
  const { can } = useSalesAccess();
  const canAssign = can("sales.leads.assign");
  const people = useTeamMembers(canAssign);
  const [lead, setLead] = useState<SalesLead | null>(null);
  const [form, setForm] = useState(() => ({ ...EMPTY, acquired_on: today() }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(!!editingId);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editingId) return;
    salesLeadsApi.get(editingId).then((l) => {
      setLead(l);
      setForm({
        name: l.name ?? "",
        company: l.company ?? "",
        contact_person: l.contact_person ?? "",
        phone: l.phone ?? "",
        email: l.email ?? "",
        source: l.source ?? "",
        source_chapter: l.source_chapter ?? "",
        source_pitch_id: l.source_pitch_id ? String(l.source_pitch_id) : "",
        temperature: l.temperature ?? "warm",
        status: l.status ?? "new",
        notes: l.notes ?? "",
        assigned_to: l.assigned_to ? String(l.assigned_to) : "",
        acquired_on: l.acquired_on ?? "",
        current_software: l.current_software ?? "",
        switch_reason: l.switch_reason ?? "",
      });
    }).catch((e) => toast.error(e instanceof Error ? e.message : "Could not load the lead"))
      .finally(() => setLoading(false));
  }, [editingId]);

  // The leading icons come with the computer's form styles; the phone keeps plain boxes.
  const withIcon = (icon: LucideIcon, input: ReactNode) => (phone ? input : <IconInput icon={icon}>{input}</IconInput>);
  const set = (k: keyof typeof EMPTY, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const lockedStage = !!lead && LIFECYCLE.includes(lead.status);
  const back = () => navigate(editingId ? `/sales/leads/${editingId}` : "/sales/leads");

  const save = async () => {
    const local: Record<string, string> = {};
    if (form.name.trim().length < 2) local.name = "Lead name is required";
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) local.email = "That email address does not look right";
    if (form.source === "yes" && !form.source_chapter.trim()) local.source = "Which YES chapter did this lead come from?";
    setErrors(local);
    if (Object.keys(local).length) {
      toast.error(Object.values(local)[0]);
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        company: form.company.trim(),
        contact_person: form.contact_person.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        source: form.source,
        source_chapter: form.source === "yes" ? form.source_chapter.trim() : "",
        source_pitch_id: form.source_pitch_id ? Number(form.source_pitch_id) : 0,
        temperature: form.temperature,
        notes: form.notes,
        acquired_on: form.acquired_on,
        current_software: form.current_software.trim(),
        switch_reason: form.switch_reason,
      };
      // Only what is the user's to change: the server enforces the same rules.
      if (editingId && !lockedStage) body.status = form.status;
      if (canAssign && (editingId || form.assigned_to)) body.assigned_to = form.assigned_to ? Number(form.assigned_to) : null;
      const saved = editingId ? await salesLeadsApi.update(editingId, body) : await salesLeadsApi.create(body);
      toast.success(editingId ? "Lead updated" : `Lead ${saved.lead_code ?? ""} added`);
      navigate(`/sales/leads/${saved.id}`, { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Could not ${editingId ? "update" : "add"} the lead`);
    } finally {
      setSaving(false);
    }
  };

  // ── The fields, grouped as the page shows them ──
  const who = (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Name" htmlFor="lead-name" required error={errors.name} className="sm:col-span-2">
        {withIcon(UserRound, <Input id="lead-name" value={form.name} autoFocus={!editingId && !phone} onChange={(e) => set("name", e.target.value)} />)}
      </Field>
      <Field label="Company" htmlFor="lead-company">
        {withIcon(Building2, <Input id="lead-company" value={form.company} onChange={(e) => set("company", e.target.value)} />)}
      </Field>
      <Field label="Contact person" htmlFor="lead-contact">
        <Input id="lead-contact" value={form.contact_person} onChange={(e) => set("contact_person", e.target.value)} />
      </Field>
      <Field label="Phone" htmlFor="lead-phone">
        {withIcon(Phone, <Input id="lead-phone" type="tel" inputMode="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} />)}
      </Field>
      <Field label="Email" htmlFor="lead-email" error={errors.email}>
        {withIcon(Mail, <Input id="lead-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />)}
      </Field>
    </div>
  );

  const source = (
    <div className="grid grid-cols-1 gap-4">
      <Field label="Source" htmlFor="lead-source" error={errors.source}>
        <SourceSelect id="lead-source" value={form.source} onChange={(v) => set("source", v)}
          chapter={form.source_chapter} onChapter={(v) => set("source_chapter", v)}
          pitchId={form.source_pitch_id ? Number(form.source_pitch_id) : null}
          onPitch={(p) => set("source_pitch_id", p ? String(p.id) : "")} />
      </Field>
      <Field label="Client came in on" htmlFor="lead-acquired" hint="The day you actually got them — not the day you are typing this">
        <Input id="lead-acquired" type="date" max={today()} value={form.acquired_on} onChange={(e) => set("acquired_on", e.target.value)} />
      </Field>
      <Field label="Temperature">
        <Select value={form.temperature} onValueChange={(v) => set("temperature", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{TEMPERATURES.map((t) => <SelectItem key={t} value={t}>{humanise(t)}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
    </div>
  );

  const pipeline = (editingId || canAssign) ? (
    <div className="grid grid-cols-1 gap-4">
      {editingId && (
        <Field label="Stage" hint={lockedStage ? "Use Undo on the lead to step it back" : undefined}>
          {lockedStage ? (
            <p className="rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-sm text-muted-foreground">{humanise(lead!.status)}</p>
          ) : (
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PIPELINE.map((st) => <SelectItem key={st} value={st}>{humanise(st)}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </Field>
      )}
      {canAssign && (
        <Field label="Assigned to" hint={editingId ? undefined : "Leave as yourself, or hand it to someone"}>
          <Select value={form.assigned_to || "none"} onValueChange={(v) => set("assigned_to", v === "none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder={editingId ? "Nobody" : "Me"} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{editingId ? "Nobody" : "Me"}</SelectItem>
              {people.map((p) => (
                <SelectItem key={p.user_id} value={String(p.user_id)}>
                  {p.name}{namesakeHint(p) && <span className="ml-1.5 text-xs text-muted-foreground">{namesakeHint(p)}</span>}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
    </div>
  ) : null;

  // Both optional: a lead is often captured mid-conversation.
  const why = (
    <div className="grid grid-cols-1 gap-4">
      <Field label="Software they use now" htmlFor="lead-software">
        <Input id="lead-software" placeholder="Tally, spreadsheets, nothing yet…" value={form.current_software} onChange={(e) => set("current_software", e.target.value)} />
      </Field>
      <Field label="Why they came to us" htmlFor="lead-reason">
        <Textarea id="lead-reason" rows={2} placeholder="What is not working for them today, or what they are trying to do" value={form.switch_reason} onChange={(e) => set("switch_reason", e.target.value)} />
      </Field>
      <Field label="Notes" htmlFor="lead-notes" hint={editingId ? "What you change is recorded on the lead's timeline" : undefined}>
        <Textarea id="lead-notes" rows={3} placeholder="Requirement, budget, timeline…" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
      </Field>
    </div>
  );

  const title = editingId ? "Edit lead" : "New lead";
  const label = editingId ? "Save changes" : "Add lead";

  if (phone) {
    return (
      <SalesLayout>
        <div className="space-y-3">
          <PageHeader title={title} subtitle={editingId ? lead?.lead_code ?? undefined : "Someone who may become a customer"} />
          {loading ? <Loading /> : (
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void save(); }}>
              <PhoneSection title="Who">{who}</PhoneSection>
              <PhoneSection title="Where they came from">{source}</PhoneSection>
              {pipeline && <PhoneSection title="Pipeline">{pipeline}</PhoneSection>}
              <PhoneSection title="Why they came to us">{why}</PhoneSection>
              <ActionBar>
                <SavingButton type="submit" saving={saving} label={label} className="min-h-14 w-full text-base" />
              </ActionBar>
            </form>
          )}
        </div>
      </SalesLayout>
    );
  }

  return (
    <SalesLayout>
      <RecordFormPage
        icon={editingId ? UserRound : UserPlus}
        title={title}
        description={editingId ? [lead?.lead_code, form.company || form.name].filter(Boolean).join(" · ") || undefined : "Someone who may become a customer"}
        backLabel={editingId ? "Lead" : "Leads"}
        onBack={back}
        actions={<Button variant="outline" onClick={() => navigate("/sales/leads")}><List className="h-4 w-4" /> View leads</Button>}
        footer={<>
          <SavingButton type="button" saving={saving} onClick={() => void save()} disabled={loading} label={label} />
          <Button variant="outline" onClick={back}>Cancel</Button>
        </>}
      >
        <FormLayout
          main={<>
            <FormSectionCard icon={UserRound} title="Lead" description="Who they are and how to reach them">{who}</FormSectionCard>
            <FormSectionCard icon={StickyNote} tone="violet" title="Why they came to us" description="Carried over to the client when the lead is converted">{why}</FormSectionCard>
          </>}
          side={<>
            <FormSectionCard icon={Megaphone} tone="amber" title="Source" description="Where this lead came from">{source}</FormSectionCard>
            {pipeline && <FormSectionCard icon={Workflow} tone="cyan" title="Pipeline" description="Stage and who is handling it">{pipeline}</FormSectionCard>}
          </>}
        />
      </RecordFormPage>
    </SalesLayout>
  );
}
