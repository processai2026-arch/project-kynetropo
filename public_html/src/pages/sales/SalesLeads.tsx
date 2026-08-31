import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CalendarClock, Plus, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { salesLeadsApi } from "@/lib/api/sales";
import { useSalesAccess } from "@/hooks/useSalesAccess";
import { SalesLayout } from "@/components/sales/SalesLayout";
import { LeadStatusBadge, SourceSelect, TemperatureBadge, formatDate, formatTime } from "@/components/sales/SalesBits";
import type { SalesLead } from "@/types/sales";

const TEMPERATURES = ["hot", "warm", "cold"] as const;
const STATUSES = [
  "new", "contacted", "qualified", "meeting_scheduled",
  "proposal", "onboarding", "converted", "lost",
] as const;

const EMPTY_FORM = {
  name: "",
  company: "",
  contact_person: "",
  phone: "",
  email: "",
  source: "",
  temperature: "warm",
  notes: "",
};

function LeadCard({ lead }: { lead: SalesLead }) {
  return (
    <Link
      to={`/sales/leads/${lead.id}`}
      className="block rounded-2xl border bg-card p-4 shadow-sm transition-colors hover:bg-muted/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-card-foreground">{lead.company || lead.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {lead.contact_person || lead.name}
            {lead.phone ? ` · ${lead.phone}` : ""}
          </p>
        </div>
        <TemperatureBadge value={lead.temperature} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <LeadStatusBadge value={lead.status} />
        {lead.lead_code && <span className="text-[11px] text-muted-foreground">{lead.lead_code}</span>}
      </div>

      {(lead.next_followup_at || lead.next_meeting_at) && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {lead.next_followup_at && (
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="h-3.5 w-3.5" />
              Follow-up {formatDate(lead.next_followup_at.slice(0, 10))}
              {lead.next_followup_at.slice(11, 16) !== "00:00"
                ? ` · ${formatTime(lead.next_followup_at.slice(11))}`
                : ""}
            </span>
          )}
          {lead.next_meeting_at && <span>Meeting {formatDate(lead.next_meeting_at.slice(0, 10))}</span>}
        </div>
      )}

      {lead.assigned_to_name && (
        <p className="mt-2 text-[11px] text-muted-foreground">Owner: {lead.assigned_to_name}</p>
      )}
    </Link>
  );
}

export default function SalesLeads() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { can } = useSalesAccess();

  const [items, setItems] = useState<SalesLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [temperature, setTemperature] = useState(searchParams.get("temperature") ?? "all");
  const [status, setStatus] = useState(searchParams.get("status") ?? "all");

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await salesLeadsApi.list({
        search: search || undefined,
        temperature: temperature !== "all" ? temperature : undefined,
        status: status !== "all" ? status : undefined,
        limit: 200,
      });
      setItems(res.data ?? []);
      setError(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not load leads";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [search, temperature, status]);

  useEffect(() => {
    void load();
  }, [load]);

  // Keep the filters shareable/bookmarkable.
  useEffect(() => {
    const next = new URLSearchParams();
    if (search) next.set("search", search);
    if (temperature !== "all") next.set("temperature", temperature);
    if (status !== "all") next.set("status", status);
    setSearchParams(next, { replace: true });
  }, [search, temperature, status, setSearchParams]);

  const set = (k: keyof typeof EMPTY_FORM, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.name.trim().length < 2) {
      toast.error("Lead name is required");
      return;
    }
    setSaving(true);
    try {
      await salesLeadsApi.create({
        name: form.name.trim(),
        company: form.company.trim(),
        contact_person: form.contact_person.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        source: form.source,
        temperature: form.temperature as SalesLead["temperature"],
        notes: form.notes || null,
      });
      toast.success("Lead created");
      setFormOpen(false);
      setForm(EMPTY_FORM);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the lead");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SalesLayout>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground">Leads</h1>
        {can("sales.leads.create") && (
          <Button onClick={() => setFormOpen(true)} size="sm" className="h-9">
            <Plus className="mr-1.5 h-4 w-4" />
            Add Lead
          </Button>
        )}
      </div>

      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, company, phone…"
            className="h-11 pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select value={temperature} onValueChange={setTemperature}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Temperature" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All temperatures</SelectItem>
              {TEMPERATURES.map((t) => (
                <SelectItem key={t} value={t} className="capitalize">
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
          {error}
          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Try again
            </Button>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card/50 p-10 text-center">
          <Users className="mx-auto h-7 w-7 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            {search || temperature !== "all" || status !== "all"
              ? "No leads match these filters."
              : "No leads yet."}
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{items.length} lead{items.length === 1 ? "" : "s"}</p>
          <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0 xl:grid-cols-3">
            {items.map((lead) => (
              <LeadCard key={lead.id} lead={lead} />
            ))}
          </div>
        </>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Lead</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="lead-name">Name *</Label>
              <Input id="lead-name" value={form.name} onChange={(e) => set("name", e.target.value)} required />
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
                <Input
                  id="lead-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                />
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
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Create Lead"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </SalesLayout>
  );
}
