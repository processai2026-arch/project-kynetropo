import { useEffect, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Building2, FolderKanban, Mail, Phone, ShieldCheck, StickyNote, UserRound, UserCheck } from "lucide-react";
import { RecordFormPage, FormLayout, FormSectionCard, IconInput } from "@/components/RecordFormPage";
import { Field, NativeSelect } from "@/components/Field";
import { SavingButton } from "@/components/SavingButton";
import { PageHeader } from "@/components/PageHeader";
import { ActionBar, Loading, usePhoneApp } from "@/components/phone/PhoneKit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SalesLayout } from "@/components/sales/SalesLayout";
import { salesLeadsApi, type ConvertLeadBody } from "@/lib/api/sales";
import { AmcPlanFields, amcDraft, amcDraftBody, amcDraftProblem, yearAfter, type AmcDraft } from "@/pages/finance/components/AmcDialogs";
import type { SalesLead } from "@/types/sales";
import { CLIENT_STAGES as CLIENT_STAGE_NAMES } from "@/pages/crm/components/crm";

/**
 * Convert a lead into a customer (/sales/leads/:id/convert) — a page, not a
 * popup. The customer details are checked on the way in (a lead is captured in
 * a hurry, a customer record is kept for years), and opening the first project
 * here asks its AMC too: from the 2nd year, from the 1st year or none, why, the
 * price, and the storage the price includes.
 */

const CLIENT_STAGES = CLIENT_STAGE_NAMES.map((s) => ({ value: s, label: s }));
const HEALTH = [{ value: "green", label: "Green" }, { value: "yellow", label: "Yellow" }, { value: "red", label: "Red" }];
const PRIORITIES = ["low", "medium", "high", "critical"].map((p) => ({ value: p, label: p[0].toUpperCase() + p.slice(1) }));

function PhoneSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border bg-card p-4">
      <h2 className="text-sm font-semibold text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

export default function SalesLeadConvert() {
  const { id } = useParams();
  const leadId = Number(id);
  const navigate = useNavigate();
  const phone = usePhoneApp();
  const [lead, setLead] = useState<SalesLead | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ConvertLeadBody>({});
  const [withProject, setWithProject] = useState(true);
  const [amc, setAmc] = useState<AmcDraft>(() => amcDraft(null));
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    salesLeadsApi.get(leadId).then((l) => {
      setLead(l);
      setForm({
        name: l.contact_person || l.name || l.company,
        company: l.company ?? "",
        phone: l.phone ?? "",
        email: l.email ?? "",
        // A YES lead tells the client record which chapter it came through.
        source: l.source === "yes" ? `YES${l.source_chapter ? ` — ${l.source_chapter}` : ""}` : l.source || "sales_lead",
        owner: l.assigned_to_name ?? "",
        stage: "Onboarding",
        health: "green",
        notes: l.notes ?? "",
        current_software: l.current_software ?? "",
        switch_reason: l.switch_reason ?? "",
        project_name: "",
        project_quoted: undefined,
        project_deadline: "",
        project_priority: "medium",
      });
    }).catch((e) => toast.error(e instanceof Error ? e.message : "Could not load the lead"))
      .finally(() => setLoading(false));
  }, [leadId]);

  // The leading icons come with the computer's form styles; the phone keeps plain boxes.
  const withIcon = (icon: LucideIcon, input: ReactNode) => (phone ? input : <IconInput icon={icon}>{input}</IconInput>);
  const set = (k: keyof ConvertLeadBody, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const back = () => navigate(`/sales/leads/${leadId}`);
  const converted = lead?.status === "converted";

  // The AMC usually starts at delivery: take the deadline when the plan is first chosen.
  const changeAmc = (next: AmcDraft) => {
    if (amc.plan === null && next.plan && next.plan !== "none" && form.project_deadline && next.start_date === amc.start_date) {
      next = { ...next, start_date: form.project_deadline, renewal_date: next.renewalTouched ? next.renewal_date : yearAfter(form.project_deadline) };
    }
    setAmc(next);
    setErrors((e) => ({ ...e, amc: "" }));
  };

  const save = async () => {
    const local: Record<string, string> = {};
    if (!(form.name ?? "").trim()) local.name = "A customer name is required";
    if (withProject && !(form.project_name ?? "").trim()) local.project_name = "Name the project, or untick it";
    const amcProblem = withProject ? amcDraftProblem(amc) : null;
    if (amcProblem) local.amc = amcProblem;
    setErrors(local);
    if (Object.keys(local).length) {
      toast.error(Object.values(local)[0]);
      return;
    }
    setSaving(true);
    try {
      const body: ConvertLeadBody = { ...form };
      if (withProject) body.amc = amcDraftBody(amc);
      else {
        delete body.project_name;
        delete body.project_quoted;
        delete body.project_deadline;
        delete body.project_priority;
      }
      const res = await salesLeadsApi.convert(leadId, body);
      toast.success(res.reused_existing_client ? "Linked to the customer that already existed"
        : res.project_id ? "Customer and project created" : "Customer created");
      navigate(`/sales/leads/${leadId}`, { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not convert the lead");
    } finally {
      setSaving(false);
    }
  };

  // ── The fields ──
  const customer = (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Client name" htmlFor="cv-name" required error={errors.name} hint="The person you deal with">
        {withIcon(UserRound, <Input id="cv-name" value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} />)}
      </Field>
      <Field label="Company" htmlFor="cv-company">
        {withIcon(Building2, <Input id="cv-company" value={form.company ?? ""} onChange={(e) => set("company", e.target.value)} />)}
      </Field>
      <Field label="Phone" htmlFor="cv-phone">
        {withIcon(Phone, <Input id="cv-phone" type="tel" inputMode="tel" value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />)}
      </Field>
      <Field label="Email" htmlFor="cv-email">
        {withIcon(Mail, <Input id="cv-email" type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} />)}
      </Field>
      <Field label="Handled by" htmlFor="cv-owner">
        <Input id="cv-owner" value={form.owner ?? ""} onChange={(e) => set("owner", e.target.value)} />
      </Field>
      <Field label="Source" htmlFor="cv-source">
        <Input id="cv-source" value={form.source ?? ""} onChange={(e) => set("source", e.target.value)} />
      </Field>
      <Field label="Stage">
        <NativeSelect value={form.stage ?? "Onboarding"} options={CLIENT_STAGES} onChange={(v) => set("stage", v)} />
      </Field>
      <Field label="Health">
        <NativeSelect value={form.health ?? "green"} options={HEALTH} onChange={(v) => set("health", v)} />
      </Field>
    </div>
  );

  const why = (
    <div className="grid grid-cols-1 gap-4">
      <Field label="Software they use now" htmlFor="cv-software">
        <Input id="cv-software" placeholder="Tally, spreadsheets, nothing yet…" value={form.current_software ?? ""} onChange={(e) => set("current_software", e.target.value)} />
      </Field>
      <Field label="Why they came to us" htmlFor="cv-reason">
        <Textarea id="cv-reason" rows={2} value={form.switch_reason ?? ""} onChange={(e) => set("switch_reason", e.target.value)} />
      </Field>
      <Field label="Notes for the project team" htmlFor="cv-notes">
        <Textarea id="cv-notes" rows={3} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
      </Field>
    </div>
  );

  const project = (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" className="h-4 w-4" checked={withProject} onChange={(e) => setWithProject(e.target.checked)} />
        Open a project for this customer
      </label>
      {withProject ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Project name" htmlFor="cv-proj" required error={errors.project_name} className="sm:col-span-2">
            <Input id="cv-proj" placeholder="e.g. Billing ERP Phase 1" value={form.project_name ?? ""} onChange={(e) => set("project_name", e.target.value)} />
          </Field>
          <Field label="Quoted (₹)" htmlFor="cv-quoted">
            <Input id="cv-quoted" inputMode="numeric" value={form.project_quoted ?? ""}
              onChange={(e) => set("project_quoted", e.target.value === "" ? undefined : Number(e.target.value.replace(/[^\d]/g, "")))} />
          </Field>
          <Field label="Deadline" htmlFor="cv-deadline">
            <Input id="cv-deadline" type="date" value={form.project_deadline ?? ""} onChange={(e) => set("project_deadline", e.target.value)} />
          </Field>
          <Field label="Priority">
            <NativeSelect value={form.project_priority ?? "medium"} options={PRIORITIES} onChange={(v) => set("project_priority", v)} />
          </Field>
        </div>
      ) : (
        <p className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">The AMC is asked with the project — open one here, or add it later from the client.</p>
      )}
    </div>
  );

  const amcFields = withProject ? (
    <div className="space-y-2">
      <AmcPlanFields draft={amc} onChange={changeAmc} idPrefix="cv-amc" />
      {errors.amc && <p className="text-sm text-destructive">{errors.amc}</p>}
    </div>
  ) : null;

  const title = "Convert to client";
  const description = lead ? [lead.lead_code, lead.company || lead.name].filter(Boolean).join(" · ") : undefined;
  const done = converted ? <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">This lead is already a customer.</p> : null;

  if (phone) {
    return (
      <SalesLayout>
        <div className="space-y-3">
          <PageHeader title={title} subtitle={description} />
          {loading ? <Loading /> : done ?? (
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void save(); }}>
              <PhoneSection title="Customer">{customer}</PhoneSection>
              <PhoneSection title="Why they came to us">{why}</PhoneSection>
              <PhoneSection title="Project">{project}</PhoneSection>
              {amcFields && <PhoneSection title="AMC">{amcFields}</PhoneSection>}
              <ActionBar>
                <SavingButton type="submit" saving={saving} label="Convert to client" savingLabel="Converting…" className="min-h-14 w-full text-base" />
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
        icon={UserCheck}
        title={title}
        description={description}
        backLabel="Lead"
        onBack={back}
        footer={done ? undefined : <>
          <SavingButton type="button" saving={saving} onClick={() => void save()} disabled={loading} label="Convert to client" savingLabel="Converting…" />
          <Button variant="outline" onClick={back}>Cancel</Button>
        </>}
      >
        {loading ? <Loading /> : done ?? (
          <FormLayout
            main={<>
              <FormSectionCard icon={UserRound} title="Customer" description="Check these — this becomes the record the project team works from">{customer}</FormSectionCard>
              <FormSectionCard icon={FolderKanban} tone="cyan" title="Project" description="Opening the first project maps the customer to it">{project}</FormSectionCard>
              {amcFields && <FormSectionCard icon={ShieldCheck} tone="green" title="AMC" description="From the 2nd year, from the 1st year or none — and why">{amcFields}</FormSectionCard>}
            </>}
            side={<FormSectionCard icon={StickyNote} tone="violet" title="Why they came to us" description="Carried over from the lead">{why}</FormSectionCard>}
          />
        )}
      </RecordFormPage>
    </SalesLayout>
  );
}
