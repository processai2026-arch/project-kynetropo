import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { CalendarDays, FolderKanban, IndianRupee, List, Receipt, StickyNote, UserRound } from "lucide-react";
import { RecordFormPage, FormLayout, FormSectionCard, IconInput } from "@/components/RecordFormPage";
import { Field, NativeSelect } from "@/components/Field";
import { SavingButton } from "@/components/SavingButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { opsFinanceApi, opsProjectsApi } from "@/lib/api/ops";
import { errorMessage } from "@/lib/api/errors";
import { todayIso } from "@/lib/format";
import type { OpsProject } from "@/types/ops";
import { CategorySelect } from "./components/ExpenseBits";

const EMPTY = { amount: "", date: todayIso(), category: "", description: "", notes: "", project_id: "", added_by: "" };

/** New expense (/finance/expenses/new, ?project_id= to book it to a project) and edit (/finance/expenses/:id/edit). */
export default function ExpenseForm() {
  const { id } = useParams();
  const editing = id ? Number(id) : null;
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { userName } = useAuth();
  const [form, setForm] = useState(() => ({ ...EMPTY, project_id: params.get("project_id") ?? "", added_by: userName ?? "" }));
  const [projects, setProjects] = useState<OpsProject[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(!!editing);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    opsProjectsApi.list().then((r) => setProjects(r.data ?? [])).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!editing) return;
    opsFinanceApi.expense(editing).then((r) => {
      const e = r.data;
      setForm({
        amount: String(e.amount), date: e.date, category: e.category, description: e.description ?? "",
        notes: e.notes ?? "", project_id: e.project_id ? String(e.project_id) : "", added_by: e.added_by ?? "",
      });
    }).catch((e) => toast.error(errorMessage(e))).finally(() => setLoading(false));
  }, [editing]);

  const set = (k: keyof typeof EMPTY, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    const local: Record<string, string> = {};
    if (!(Number(form.amount) > 0)) local.amount = "Enter the amount";
    if (!form.date) local.date = "Enter the date";
    if (!form.category.trim()) local.category = "Choose or add a category";
    setErrors(local);
    if (Object.keys(local).length) { toast.error(Object.values(local)[0]); return; }
    setSaving(true);
    try {
      const body = {
        amount: Number(form.amount), date: form.date, category: form.category.trim(),
        description: form.description.trim(), notes: form.notes.trim(),
        project_id: form.project_id ? Number(form.project_id) : null, added_by: form.added_by.trim(),
      };
      const res = editing ? await opsFinanceApi.updateExpense(editing, body) : await opsFinanceApi.addExpense(body);
      toast.success(editing ? "Expense updated" : "Expense added");
      navigate(`/finance/expenses/${res.data.id}`, { replace: true });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <RecordFormPage
      icon={Receipt}
      title={editing ? "Edit expense" : "New expense"}
      description={editing ? form.description || undefined : "Money spent — it comes off this month's profit in Finance"}
      backLabel="Finance"
      onBack={() => navigate(editing ? `/finance/expenses/${editing}` : "/finance?tab=expenses")}
      actions={<Button variant="outline" onClick={() => navigate("/finance?tab=expenses")}><List className="h-4 w-4" /> View expenses</Button>}
      footer={<>
        <SavingButton type="button" saving={saving} onClick={() => void save()} disabled={loading} label={editing ? "Save changes" : "Add expense"} />
        <Button variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
      </>}
    >
      <FormLayout
        main={<>
          <FormSectionCard icon={IndianRupee} title="Expense" description="How much, when, and what for">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Amount (₹)" htmlFor="exp-amount" required error={errors.amount}>
                <IconInput icon={IndianRupee}>
                  <Input id="exp-amount" inputMode="decimal" autoFocus={!editing} value={form.amount}
                    onChange={(e) => set("amount", e.target.value.replace(/[^\d.]/g, ""))} />
                </IconInput>
              </Field>
              <Field label="Date" htmlFor="exp-date" required error={errors.date}>
                <IconInput icon={CalendarDays}><Input id="exp-date" type="date" max={todayIso()} value={form.date} onChange={(e) => set("date", e.target.value)} /></IconInput>
              </Field>
              <Field label="Category" htmlFor="exp-category" required error={errors.category}
                hint="Not in the list? Choose “+ New category…” and type it — it will be there next time">
                <CategorySelect id="exp-category" value={form.category} onChange={(v) => set("category", v)} />
              </Field>
              <Field label="What for" htmlFor="exp-desc">
                <Input id="exp-desc" placeholder="e.g. AWS bill for October" value={form.description} onChange={(e) => set("description", e.target.value)} />
              </Field>
            </div>
          </FormSectionCard>
          <FormSectionCard icon={StickyNote} tone="violet" title="Notes" description="Anything more: bill number, who it was paid to, why">
            <Textarea id="exp-notes" rows={4} placeholder="Notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </FormSectionCard>
        </>}
        side={
          <FormSectionCard icon={FolderKanban} tone="amber" title="Linked to" description="Book it to a project to see it in that project's money">
            <div className="grid grid-cols-1 gap-4">
              <Field label="Project" hint="Optional">
                <NativeSelect value={form.project_id} placeholder="No project"
                  options={projects.map((p) => ({ value: p.id, label: `${p.project_code ? `${p.project_code} · ` : ""}${p.name}` }))}
                  onChange={(v) => set("project_id", v)} />
              </Field>
              <Field label="Added by" htmlFor="exp-by">
                <IconInput icon={UserRound}><Input id="exp-by" value={form.added_by} onChange={(e) => set("added_by", e.target.value)} /></IconInput>
              </Field>
            </div>
          </FormSectionCard>
        }
      />
    </RecordFormPage>
  );
}
