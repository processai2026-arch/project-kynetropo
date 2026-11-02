import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { FolderKanban, List, ShieldCheck } from "lucide-react";
import { RecordFormPage, FormLayout, FormSectionCard } from "@/components/RecordFormPage";
import { Field, NativeSelect } from "@/components/Field";
import { SavingButton } from "@/components/SavingButton";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { opsAmcApi, opsClientsApi, opsProjectsApi } from "@/lib/api/ops";
import { errorMessage } from "@/lib/api/errors";
import { rupees } from "@/pages/crm/components/crm";
import type { OpsAmcRecord, OpsClient, OpsProject } from "@/types/ops";
import { AmcPlanFields, amcDraft, amcDraftBody, amcDraftProblem, draftBreakdown, type AmcDraft } from "./components/AmcDialogs";

/**
 * Add an AMC (/amc/new, ?project_id= for a project's) or edit one
 * (/amc/:id/edit) as a page, so the whole form scrolls with the page.
 * ?back= is where to go after saving (a project's AMC tab, say).
 */
export default function AmcForm() {
  const { id } = useParams();
  const editingId = id ? Number(id) : null;
  const [params] = useSearchParams();
  const back = params.get("back");
  const navigate = useNavigate();
  const { userName } = useAuth();

  const [amc, setAmc] = useState<OpsAmcRecord | null>(null);
  const [draft, setDraft] = useState<AmcDraft>(() => amcDraft(null));
  const [clients, setClients] = useState<OpsClient[]>([]);
  const [projects, setProjects] = useState<OpsProject[]>([]);
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState(params.get("project_id") ?? "");
  const [loading, setLoading] = useState(!!editingId);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingId) return;
    opsClientsApi.list().then((r) => setClients(r.data ?? [])).catch(() => undefined);
    opsProjectsApi.list().then((r) => {
      const list = r.data ?? [];
      setProjects(list);
      const p = list.find((x) => String(x.id) === projectId);
      if (p) setClientId(String(p.client_id));
    }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId]);

  useEffect(() => {
    if (!editingId) return;
    opsAmcApi.get(editingId).then((r) => {
      setAmc(r.data);
      setDraft(amcDraft(r.data));
      setClientId(String(r.data.client_id));
      setProjectId(String(r.data.project_id));
    }).catch((e) => toast.error(errorMessage(e))).finally(() => setLoading(false));
  }, [editingId]);

  const removing = !!editingId && draft.plan === "none";
  const problem = amcDraftProblem(draft) ?? (!projectId ? "Choose the project" : null);
  const clientProjects = clientId ? projects.filter((p) => String(p.client_id) === clientId) : projects;
  const fixedProject = amc ? { name: amc.project_name ?? "", code: amc.project_code, client: amc.client_name } : null;
  const total = draft.plan && draft.plan !== "none" ? draftBreakdown(draft).total : 0;
  const leave = (savedId?: number) => navigate(back || (savedId ? `/amc/${savedId}` : "/amc"), { replace: true });

  const save = async () => {
    if (problem) { toast.error(problem); return; }
    setSaving(true);
    try {
      const body = { ...amcDraftBody(draft), recorded_by: userName ?? "" };
      if (editingId) {
        await opsAmcApi.update(editingId, body);
        toast.success(removing ? "AMC removed" : `AMC saved · ${rupees(total)} a year`);
        leave(removing ? undefined : editingId);
      } else {
        const res = await opsAmcApi.create({ ...body, client_id: Number(clientId), project_id: Number(projectId) });
        toast.success(`AMC added · ${rupees(total)} a year`);
        leave(res.data.id);
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <RecordFormPage
      icon={ShieldCheck}
      title={editingId ? "Edit AMC" : "New AMC"}
      description={fixedProject ? `${fixedProject.client ?? ""} · ${fixedProject.code ? `${fixedProject.code} · ` : ""}${fixedProject.name}` : "Yearly maintenance for a project — separate from its quoted amount"}
      backLabel={back ? "Back" : "AMC"}
      onBack={() => navigate(back || (editingId ? `/amc/${editingId}` : "/amc"))}
      actions={<Button variant="outline" onClick={() => navigate("/amc")}><List className="h-4 w-4" /> View AMCs</Button>}
      footer={<>
        <SavingButton type="button" saving={saving} onClick={() => void save()} disabled={loading || problem !== null}
          label={removing ? "Remove AMC" : editingId ? "Save AMC" : "Add AMC"} />
        <Button variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
        {problem && !loading && <span className="text-sm text-muted-foreground">{problem}</span>}
      </>}
    >
      <FormLayout
        main={
          <FormSectionCard icon={ShieldCheck} title="AMC" description="The plan, the price a year, users and storage">
            {loading ? <p className="text-sm text-muted-foreground">Loading…</p>
              : <AmcPlanFields draft={draft} onChange={setDraft} original={amc} allowNone={!!editingId} showNotes idPrefix="amc-page" />}
          </FormSectionCard>
        }
        side={
          <FormSectionCard icon={FolderKanban} tone="amber" title="Project" description="Which client and project the AMC is for">
            {fixedProject ? (
              <dl className="space-y-2 text-sm">
                <div><dt className="text-muted-foreground">Client</dt><dd className="font-medium">{fixedProject.client ?? "—"}</dd></div>
                <div><dt className="text-muted-foreground">Project</dt><dd className="font-medium">{fixedProject.code ? `${fixedProject.code} · ` : ""}{fixedProject.name}</dd></div>
              </dl>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                <Field label="Client" required>
                  <NativeSelect value={clientId} placeholder="Choose client"
                    onChange={(v) => { setClientId(v); setProjectId(""); }}
                    options={clients.map((c) => ({ value: c.id, label: c.company ? `${c.name} · ${c.company}` : c.name }))} />
                </Field>
                <Field label="Project" required>
                  <NativeSelect value={projectId} placeholder="Choose project"
                    onChange={(v) => {
                      const p = projects.find((x) => String(x.id) === v);
                      setProjectId(v);
                      if (p) setClientId(String(p.client_id));
                    }}
                    options={clientProjects.map((p) => ({ value: p.id, label: `${p.project_code ? `${p.project_code} · ` : ""}${p.name}` }))} />
                </Field>
              </div>
            )}
            {total > 0 && <p className="mt-4 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm font-medium">AMC a year: {rupees(total)}</p>}
          </FormSectionCard>
        }
      />
    </RecordFormPage>
  );
}
