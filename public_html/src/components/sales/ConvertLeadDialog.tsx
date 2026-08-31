import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { salesLeadsApi } from "@/lib/api/sales";
import type { ConvertLeadBody } from "@/lib/api/sales";
import type { SalesLead } from "@/types/sales";

/**
 * Converting a lead into a customer, with the details confirmed on the way in.
 *
 * A lead is captured in a hurry — a half-typed company name, no email. The
 * customer record it becomes is kept for years and feeds projects and invoices,
 * so this asks the salesperson to check and complete it rather than copying the
 * lead across silently. The same dialog serves the phone and the desktop.
 *
 * Naming a project opens it against the new customer in the same step, which is
 * the mapping between the two: customer details here, project details there.
 */

const CLIENT_STAGES = [
  "First Meetup", "Onboarding", "Requirements", "Scope Freeze",
  "Advance Paid", "Development", "QA", "Delivery", "Full Payment", "Closed",
];

export function ConvertLeadDialog({
  lead,
  open,
  onOpenChange,
  onConverted,
}: {
  lead: SalesLead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConverted: () => void;
}) {
  const [form, setForm] = useState<ConvertLeadBody>({});
  const [withProject, setWithProject] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !lead) return;
    setForm({
      name: lead.company || lead.name,
      phone: lead.phone ?? "",
      email: lead.email ?? "",
      source: lead.source || "sales_lead",
      owner: lead.assigned_to_name ?? "",
      stage: "Onboarding",
      health: "green",
      notes: lead.notes ?? "",
      project_name: "",
      project_quoted: undefined,
      project_deadline: "",
      project_priority: "medium",
    });
    setWithProject(false);
  }, [open, lead]);

  const set = (k: keyof ConvertLeadBody, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead) return;
    if (!(form.name ?? "").trim()) {
      toast.error("A customer name is required");
      return;
    }
    setSaving(true);
    try {
      const body: ConvertLeadBody = { ...form };
      if (!withProject) {
        delete body.project_name;
        delete body.project_quoted;
        delete body.project_deadline;
        delete body.project_priority;
      }
      const res = await salesLeadsApi.convert(lead.id, body);
      toast.success(
        res.reused_existing_client
          ? "Linked to the customer that already existed"
          : res.project_id
            ? "Customer and project created"
            : "Customer created in the project system",
      );
      onOpenChange(false);
      onConverted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not convert the lead");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Convert to Customer
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Check these before converting — this becomes the customer record the project team
            works from. The sales history stays on the lead either way, and the conversion can be
            undone afterwards.
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="cv-name">Customer / company name *</Label>
            <Input
              id="cv-name"
              required
              value={form.name ?? ""}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cv-phone">Phone</Label>
              <Input id="cv-phone" value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cv-email">Email</Label>
              <Input
                id="cv-email"
                type="email"
                value={form.email ?? ""}
                onChange={(e) => set("email", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cv-owner">Account owner</Label>
              <Input
                id="cv-owner"
                value={form.owner ?? ""}
                onChange={(e) => set("owner", e.target.value)}
                placeholder="Who handles this customer"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cv-source">Source</Label>
              <Input id="cv-source" value={form.source ?? ""} onChange={(e) => set("source", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Stage</Label>
              <Select value={form.stage ?? "Onboarding"} onValueChange={(v) => set("stage", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLIENT_STAGES.map((st) => (
                    <SelectItem key={st} value={st}>
                      {st}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Health</Label>
              <Select value={form.health ?? "green"} onValueChange={(v) => set("health", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="green">Green</SelectItem>
                  <SelectItem value="yellow">Yellow</SelectItem>
                  <SelectItem value="red">Red</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cv-notes">Notes for the project team</Label>
            <Textarea
              id="cv-notes"
              rows={3}
              value={form.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>

          {/* Opening the first project here is the customer-to-project mapping. */}
          <div className="rounded-xl border p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={withProject}
                onChange={(e) => setWithProject(e.target.checked)}
              />
              Also open a project for this customer
            </label>

            {withProject && (
              <div className="mt-3 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cv-proj">Project name</Label>
                  <Input
                    id="cv-proj"
                    value={form.project_name ?? ""}
                    onChange={(e) => set("project_name", e.target.value)}
                    placeholder="e.g. Billing ERP Phase 1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="cv-quoted">Quoted (₹)</Label>
                    <Input
                      id="cv-quoted"
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={form.project_quoted ?? ""}
                      onChange={(e) =>
                        set("project_quoted", e.target.value === "" ? undefined : Number(e.target.value))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cv-deadline">Deadline</Label>
                    <Input
                      id="cv-deadline"
                      type="date"
                      value={form.project_deadline ?? ""}
                      onChange={(e) => set("project_deadline", e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Priority</Label>
                  <Select
                    value={form.project_priority ?? "medium"}
                    onValueChange={(v) => set("project_priority", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["low", "medium", "high", "critical"].map((pr) => (
                        <SelectItem key={pr} value={pr} className="capitalize">
                          {pr}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Converting…" : "Convert"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
