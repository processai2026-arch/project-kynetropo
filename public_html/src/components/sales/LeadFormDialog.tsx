import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { salesLeadsApi } from "@/lib/api/sales";
import { useSalesAccess } from "@/hooks/useSalesAccess";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { SourceSelect } from "@/components/sales/SalesBits";
import type { LeadStatus, LeadTemperature, SalesLead } from "@/types/sales";

/**
 * Add or edit a lead. One component for both, so the two forms cannot drift
 * into disagreeing about which fields a lead has.
 *
 * Status is editable, but only across the pipeline stages. Onboarding and
 * Converted are deliberately NOT offered: they are not column values, they
 * create the customer record and link the two systems together. Picking the
 * word from a dropdown would leave a lead claiming to be converted with
 * nothing behind it — the server refuses it too, for the same reason.
 */

const TEMPERATURES: LeadTemperature[] = ["hot", "warm", "cold"];

/** The stages a lead can simply be moved between. */
const PIPELINE_STATUSES: { value: LeadStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "meeting_scheduled", label: "Meeting scheduled" },
  { value: "proposal", label: "Proposal" },
  { value: "lost", label: "Lost" },
];

/** Stages reached through Start Onboarding / Convert, never through this form. */
const LIFECYCLE_STATUSES: LeadStatus[] = ["onboarding", "converted"];

const EMPTY = {
  name: "",
  company: "",
  contact_person: "",
  phone: "",
  email: "",
  source: "",
  temperature: "warm" as LeadTemperature,
  status: "new" as LeadStatus,
  notes: "",
  assigned_to: "",
};

export function LeadFormDialog({
  open,
  lead,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** null creates a new lead; a lead edits it. */
  lead: SalesLead | null;
  onClose: () => void;
  onSaved: (saved: SalesLead) => void;
}) {
  const { can } = useSalesAccess();
  const canAssign = can("sales.leads.assign");
  const people = useTeamMembers(open && canAssign);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const editing = lead !== null;
  // A lead already past the pipeline keeps its stage: the dropdown would only
  // offer values that are a step backwards, and there is a dedicated Undo for
  // that on the lead itself.
  const lockedStage = editing && LIFECYCLE_STATUSES.includes(lead.status);

  useEffect(() => {
    if (!open) return;
    setForm(
      lead
        ? {
            name: lead.name ?? "",
            company: lead.company ?? "",
            contact_person: lead.contact_person ?? "",
            phone: lead.phone ?? "",
            email: lead.email ?? "",
            source: lead.source ?? "",
            temperature: lead.temperature ?? "warm",
            status: lead.status ?? "new",
            notes: lead.notes ?? "",
            assigned_to: lead.assigned_to ? String(lead.assigned_to) : "",
          }
        : EMPTY,
    );
  }, [open, lead]);

  const set = (k: keyof typeof EMPTY, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.name.trim().length < 2) {
      toast.error("Lead name is required");
      return;
    }
    if (form.email.trim() !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      toast.error("That email address does not look right");
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
        temperature: form.temperature,
        notes: form.notes,
      };
      // Only sent when it is actually the user's to change: the server enforces
      // the same two rules, so a field that cannot move is simply not offered.
      if (editing && !lockedStage) body.status = form.status;
      if (canAssign) body.assigned_to = form.assigned_to ? Number(form.assigned_to) : null;

      const saved = editing
        ? await salesLeadsApi.update(lead.id, body)
        : await salesLeadsApi.create(body);

      toast.success(editing ? "Lead updated" : "Lead created");
      onSaved(saved);
      onClose();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : `Could not ${editing ? "update" : "create"} the lead`,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Lead" : "Add Lead"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="lead-name">Name *</Label>
            <Input id="lead-name" required value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="lead-company">Company</Label>
              <Input id="lead-company" value={form.company} onChange={(e) => set("company", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-contact">Contact person</Label>
              <Input
                id="lead-contact"
                value={form.contact_person}
                onChange={(e) => set("contact_person", e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="lead-phone">Phone</Label>
              <Input
                id="lead-phone"
                type="tel"
                inputMode="tel"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-email">Email</Label>
              <Input id="lead-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="lead-source">Source</Label>
              <SourceSelect id="lead-source" value={form.source} onChange={(v) => set("source", v)} />
            </div>
            <div className="space-y-1.5">
              <Label>Temperature</Label>
              <Select value={form.temperature} onValueChange={(v) => set("temperature", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPERATURES.map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {editing && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Stage</Label>
                {lockedStage ? (
                  <p className="rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-sm capitalize text-muted-foreground">
                    {lead.status}
                    <span className="ml-1 normal-case">— use Undo on the lead to step it back</span>
                  </p>
                ) : (
                  <Select value={form.status} onValueChange={(v) => set("status", v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PIPELINE_STATUSES.map((st) => (
                        <SelectItem key={st.value} value={st.value}>
                          {st.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {canAssign && (
                <div className="space-y-1.5">
                  <Label>Assigned to</Label>
                  <Select
                    value={form.assigned_to || "none"}
                    onValueChange={(v) => set("assigned_to", v === "none" ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Nobody" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nobody</SelectItem>
                      {people.map((p) => (
                        <SelectItem key={p.user_id} value={String(p.user_id)}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="lead-notes">Notes</Label>
            <Textarea
              id="lead-notes"
              rows={3}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Requirement, budget, timeline…"
            />
          </div>

          {editing && (
            <p className="text-[11px] text-muted-foreground">
              What you change is recorded on the lead timeline, so the team can see what moved.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Create Lead"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
