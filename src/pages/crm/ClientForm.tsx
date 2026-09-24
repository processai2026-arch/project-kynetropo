import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Building2, Hash, List, Mail, Megaphone, Phone, StickyNote, UserRound, UserRoundPlus } from "lucide-react";
import { RecordFormPage, FormLayout, FormSectionCard, IconInput } from "@/components/RecordFormPage";
import { Field, NativeSelect } from "@/components/Field";
import { SavingButton } from "@/components/SavingButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { opsClientsApi, opsPitchesApi } from "@/lib/api/ops";
import { errorMessage } from "@/lib/api/errors";
import type { OpsPitch } from "@/types/ops";
import { HEALTH_OPTIONS } from "./components/crm";

const EMPTY = {
  client_code: "",
  name: "",
  phone: "",
  email: "",
  owner: "",
  health: "green" as "green" | "yellow" | "red",
  source: "",
  source_pitch_id: "",
  current_software: "",
  switch_reason: "",
  notes: "",
};

/** New client (/clients/new) and edit client (/clients/:id/edit). */
export default function ClientForm() {
  const { id } = useParams();
  const editing = id ? Number(id) : null;
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [pitches, setPitches] = useState<OpsPitch[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(!!editing);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    opsPitchesApi.list().then((r) => setPitches(r.data ?? [])).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!editing) return;
    opsClientsApi.get(editing).then((r) => {
      const c = r.data;
      setForm({
        client_code: c.client_code ?? "",
        name: c.name,
        phone: c.phone ?? "",
        email: c.email ?? "",
        owner: c.owner ?? "",
        health: c.health,
        source: c.source ?? "",
        source_pitch_id: c.source_pitch_id ? String(c.source_pitch_id) : "",
        current_software: c.current_software ?? "",
        switch_reason: c.switch_reason ?? "",
        notes: c.notes ?? "",
      });
    }).catch((e) => toast.error(errorMessage(e))).finally(() => setLoading(false));
  }, [editing]);

  const set = (k: keyof typeof EMPTY, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    const local: Record<string, string> = {};
    if (!form.name.trim()) local.name = "Name is required";
    if (editing && !form.client_code.trim()) local.client_code = "Client ID cannot be empty";
    setErrors(local);
    if (Object.keys(local).length) return;
    setSaving(true);
    try {
      const body = {
        ...form,
        client_code: form.client_code.trim() || undefined, // blank on a new client: the next number
        source_pitch_id: form.source_pitch_id ? Number(form.source_pitch_id) : null,
      };
      const res = editing ? await opsClientsApi.update(editing, body) : await opsClientsApi.create(body);
      toast.success(editing ? "Client updated" : `Client ${res.data.client_code ?? ""} added`);
      navigate(`/clients/${res.data.id}`, { replace: true });
    } catch (e) {
      const message = errorMessage(e);
      if (/Client ID/i.test(message)) setErrors({ client_code: message });
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <RecordFormPage
      icon={editing ? UserRound : UserRoundPlus}
      title={editing ? "Edit client" : "New client"}
      description={editing ? form.name || undefined : "A customer the team is working with"}
      backLabel="Clients"
      onBack={() => navigate(editing ? `/clients/${editing}` : "/clients")}
      actions={<Button variant="outline" onClick={() => navigate("/clients")}><List className="h-4 w-4" /> View clients</Button>}
      footer={<>
        <SavingButton type="button" saving={saving} onClick={() => void save()} disabled={loading} label={editing ? "Save changes" : "Add client"} />
        <Button variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
      </>}
    >
      <FormLayout
        main={<>
          <FormSectionCard icon={UserRound} title="Client" description="Who they are and how to reach them">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Client ID" htmlFor="client_code" error={errors.client_code}
                hint={editing ? "Must be unique" : "Leave blank for the next number"}>
                <IconInput icon={Hash}><Input id="client_code" className="font-mono uppercase" placeholder={editing ? "" : "Automatic"} value={form.client_code} onChange={(e) => set("client_code", e.target.value)} /></IconInput>
              </Field>
              <Field label="Client / company name" htmlFor="name" required error={errors.name}>
                <IconInput icon={Building2}><Input id="name" placeholder="e.g. Biomass ERP" value={form.name} onChange={(e) => set("name", e.target.value)} autoFocus={!editing} /></IconInput>
              </Field>
              <Field label="Phone" htmlFor="phone">
                <IconInput icon={Phone}><Input id="phone" placeholder="+91 98765 43210" value={form.phone} onChange={(e) => set("phone", e.target.value)} /></IconInput>
              </Field>
              <Field label="Email" htmlFor="email">
                <IconInput icon={Mail}><Input id="email" type="email" placeholder="email@company.com" value={form.email} onChange={(e) => set("email", e.target.value)} /></IconInput>
              </Field>
              <Field label="Owner" htmlFor="owner" hint="Who handles this client">
                <Input id="owner" value={form.owner} onChange={(e) => set("owner", e.target.value)} />
              </Field>
              <Field label="Health">
                <NativeSelect value={form.health} options={HEALTH_OPTIONS} onChange={(v) => set("health", v)} />
              </Field>
            </div>
          </FormSectionCard>
          <FormSectionCard icon={StickyNote} tone="violet" title="Why they came to us" description="Carried over from sales when a lead is converted">
            <div className="grid grid-cols-1 gap-4">
              <Field label="Software they use now" htmlFor="current_software">
                <Input id="current_software" placeholder="Tally, spreadsheets, nothing yet…" value={form.current_software} onChange={(e) => set("current_software", e.target.value)} />
              </Field>
              <Field label="Why they came to us" htmlFor="switch_reason">
                <Textarea id="switch_reason" rows={2} placeholder="What is not working for them today, or what they are trying to do" value={form.switch_reason} onChange={(e) => set("switch_reason", e.target.value)} />
              </Field>
              <Field label="Notes" htmlFor="notes">
                <Textarea id="notes" rows={3} placeholder="Any context" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
              </Field>
            </div>
          </FormSectionCard>
        </>}
        side={
          <FormSectionCard icon={Megaphone} tone="amber" title="Source" description="Where this client came from">
            <div className="grid grid-cols-1 gap-4">
              <Field label="Source" htmlFor="source">
                <Input id="source" placeholder="Referral, YES Meet…" value={form.source} onChange={(e) => set("source", e.target.value)} />
              </Field>
              <Field label="Source pitch">
                <NativeSelect value={form.source_pitch_id} placeholder="None" options={pitches.map((p) => ({ value: p.id, label: `${p.name} (${p.date})` }))} onChange={(v) => set("source_pitch_id", v)} />
              </Field>
            </div>
          </FormSectionCard>
        }
      />
    </RecordFormPage>
  );
}
