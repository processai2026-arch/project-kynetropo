import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { CalendarDays, FolderKanban, FolderPlus, Hash, IndianRupee, List, Wallet } from "lucide-react";
import { RecordFormPage, FormLayout, FormSectionCard, IconInput } from "@/components/RecordFormPage";
import { Field, NativeSelect } from "@/components/Field";
import { SavingButton } from "@/components/SavingButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { opsClientsApi, opsProjectsApi } from "@/lib/api/ops";
import { errorMessage } from "@/lib/api/errors";
import type { OpsClient } from "@/types/ops";
import { HEALTH_OPTIONS, PRIORITY_OPTIONS } from "./components/crm";

const EMPTY = {
  project_code: "",
  name: "",
  client_id: "",
  owner: "",
  quoted: "",
  start_date: "",
  deadline: "",
  health: "green",
  priority: "medium",
  next_collection_trigger: "",
  collection_target_date: "",
};

/** New project (/projects/new, optionally ?client=ID) and edit project (/projects/:id/edit). */
export default function ProjectForm() {
  const { id } = useParams();
  const editing = id ? Number(id) : null;
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ ...EMPTY, client_id: params.get("client") ?? "" });
  const [clients, setClients] = useState<OpsClient[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(!!editing);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    opsClientsApi.list().then((r) => setClients(r.data ?? [])).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!editing) return;
    opsProjectsApi.get(editing).then((r) => {
      const p = r.data;
      setForm({
        project_code: p.project_code ?? "",
        name: p.name,
        client_id: String(p.client_id),
        owner: p.owner ?? "",
        quoted: String(p.quoted ?? ""),
        start_date: p.start_date ?? "",
        deadline: p.deadline ?? "",
        health: p.health,
        priority: p.priority,
        next_collection_trigger: p.next_collection_trigger ?? "",
        collection_target_date: p.collection_target_date ?? "",
      });
    }).catch((e) => toast.error(errorMessage(e))).finally(() => setLoading(false));
  }, [editing]);

  const set = (k: keyof typeof EMPTY, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    const local: Record<string, string> = {};
    if (!form.name.trim()) local.name = "Project name is required";
    if (!form.client_id) local.client_id = "Choose the client";
    if (editing && !form.project_code.trim()) local.project_code = "Project ID cannot be empty";
    setErrors(local);
    if (Object.keys(local).length) return;
    setSaving(true);
    try {
      const body = {
        ...form,
        project_code: form.project_code.trim() || undefined, // blank on a new project: the next number
        client_id: Number(form.client_id),
        quoted: Number(form.quoted || 0),
        health: form.health as "green" | "yellow" | "red",
        priority: form.priority as "low" | "medium" | "high" | "critical",
      };
      const res = editing ? await opsProjectsApi.update(editing, body) : await opsProjectsApi.create(body);
      toast.success(editing ? "Project updated" : `Project ${res.data.project_code ?? ""} created`);
      navigate(`/projects/${res.data.id}`, { replace: true });
    } catch (e) {
      const message = errorMessage(e);
      if (/Project ID/i.test(message)) setErrors({ project_code: message });
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const clientOptions = clients.map((c) => ({ value: c.id, label: c.client_code ? `${c.client_code} · ${c.name}` : c.name }));

  return (
    <RecordFormPage
      icon={editing ? FolderKanban : FolderPlus}
      title={editing ? "Edit project" : "New project"}
      description={editing ? form.name || undefined : "Work quoted for a client"}
      backLabel="Projects"
      onBack={() => navigate(editing ? `/projects/${editing}` : "/projects")}
      actions={<Button variant="outline" onClick={() => navigate("/projects")}><List className="h-4 w-4" /> View projects</Button>}
      footer={<>
        <SavingButton type="button" saving={saving} onClick={() => void save()} disabled={loading} label={editing ? "Save changes" : "Create project"} />
        <Button variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
      </>}
    >
      <FormLayout
        main={<>
          <FormSectionCard icon={FolderKanban} title="Project" description="What is being built, and for whom">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Project ID" htmlFor="project_code" error={errors.project_code}
                hint={editing ? "Must be unique" : "Leave blank for the next number"}>
                <IconInput icon={Hash}><Input id="project_code" className="font-mono uppercase" placeholder={editing ? "" : "Automatic"} value={form.project_code} onChange={(e) => set("project_code", e.target.value)} /></IconInput>
              </Field>
              <Field label="Project name" htmlFor="name" required error={errors.name}>
                <IconInput icon={FolderKanban}><Input id="name" placeholder="e.g. Cable TV CRM Phase 2" value={form.name} onChange={(e) => set("name", e.target.value)} autoFocus={!editing} /></IconInput>
              </Field>
              <Field label="Client" required error={errors.client_id} className="sm:col-span-2"
                hint={editing ? "Moving the project moves its payments to the new client" : undefined}>
                <NativeSelect value={form.client_id} placeholder="Choose client" options={clientOptions} onChange={(v) => set("client_id", v)} />
              </Field>
              <Field label="Owner" htmlFor="owner">
                <Input id="owner" value={form.owner} onChange={(e) => set("owner", e.target.value)} />
              </Field>
              <Field label="Health">
                <NativeSelect value={form.health} options={HEALTH_OPTIONS} onChange={(v) => set("health", v)} />
              </Field>
              <Field label="Priority">
                <NativeSelect value={form.priority} options={PRIORITY_OPTIONS} onChange={(v) => set("priority", v)} />
              </Field>
            </div>
          </FormSectionCard>
          <FormSectionCard icon={CalendarDays} tone="violet" title="Dates">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Start date" htmlFor="start_date"><Input id="start_date" type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} /></Field>
              <Field label="Deadline" htmlFor="deadline"><Input id="deadline" type="date" value={form.deadline} onChange={(e) => set("deadline", e.target.value)} /></Field>
            </div>
          </FormSectionCard>
        </>}
        side={
          <FormSectionCard icon={Wallet} tone="green" title="Money" description="Payments are recorded on the project page">
            <div className="grid grid-cols-1 gap-4">
              <Field label="Quoted amount (₹)" htmlFor="quoted">
                <IconInput icon={IndianRupee}><Input id="quoted" inputMode="decimal" value={form.quoted} onChange={(e) => set("quoted", e.target.value.replace(/[^\d.]/g, ""))} /></IconInput>
              </Field>
              <Field label="Next collection trigger" htmlFor="trigger">
                <Input id="trigger" placeholder="e.g. After delivery" value={form.next_collection_trigger} onChange={(e) => set("next_collection_trigger", e.target.value)} />
              </Field>
              <Field label="Collection target date" htmlFor="target">
                <Input id="target" type="date" value={form.collection_target_date} onChange={(e) => set("collection_target_date", e.target.value)} />
              </Field>
            </div>
          </FormSectionCard>
        }
      />
    </RecordFormPage>
  );
}
