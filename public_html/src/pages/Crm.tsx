/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  ClipboardList,
  Eye,
  Phone,
  Plus,
  RefreshCw,
  Repeat,
  Target,
  Trash2,
  TrendingUp,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CreatableCombobox } from "@/components/ui/creatable-combobox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ScrollableX } from "@/components/ui/scrollable-x";
import { StatCard } from "@/components/StatCard";
import {
  type ApiActivity,
  type ApiDeal,
  type ApiLead,
  type DealStage,
  type LeadStatus,
  changeDealStage,
  convertLead,
  createActivity,
  createDeal,
  createLead,
  deleteActivity,
  deleteDeal,
  deleteLead,
  fetchActivities,
  fetchDeals,
  fetchLeads,
  fetchPipeline,
  updateActivity,
  updateDeal,
  updateLead,
} from "@/lib/api/crm";

const inr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const LEAD_STATUSES: LeadStatus[] = ["new", "contacted", "qualified", "lost"];
const DEAL_STAGES: DealStage[] = ["qualification", "proposal", "negotiation", "won", "lost"];
const ACTIVITY_TYPES = ["call", "meeting", "task", "note"] as const;

const LEAD_STATUS_COLOR: Record<LeadStatus, string> = {
  new: "bg-blue-500/10 text-blue-600 border-blue-300",
  contacted: "bg-amber-500/10 text-amber-600 border-amber-300",
  qualified: "bg-emerald-500/10 text-emerald-600 border-emerald-300",
  lost: "bg-red-500/10 text-red-600 border-red-300",
};

const STAGE_LABEL: Record<DealStage, string> = {
  qualification: "Qualification",
  proposal: "Proposal",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

const STAGE_COLOR: Record<DealStage, string> = {
  qualification: "border-t-blue-400",
  proposal: "border-t-amber-400",
  negotiation: "border-t-purple-400",
  won: "border-t-emerald-400",
  lost: "border-t-red-400",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

const emptyLead = { name: "", company_name: "", email: "", phone: "", source: "website", status: "new" as LeadStatus, notes: "" };
const emptyDeal = { title: "", customer_id: "", value: "", currency: "INR", stage: "qualification" as DealStage, expected_close_date: "", probability: "10", notes: "" };
const emptyActivity = { type: "task" as (typeof ACTIVITY_TYPES)[number], subject: "", notes: "", related_type: "lead" as "lead" | "deal" | "customer", related_id: "", due_at: "" };

export default function Crm() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("leads");

  // ── Sort state ────────────────────────────────────────────────────────
  const [leadSortKey, setLeadSortKey] = useState<string>("created_at");
  const [leadSortDir, setLeadSortDir] = useState<"asc" | "desc">("desc");
  const handleLeadSort = (key: string) => {
    if (leadSortKey === key) setLeadSortDir(d => d === "asc" ? "desc" : "asc");
    else { setLeadSortKey(key); setLeadSortDir("desc"); }
  };
  const resetLeadSort = () => { setLeadSortKey("created_at"); setLeadSortDir("desc"); };
  const LeadSortIcon = ({ col }: { col: string }) => {
    if (leadSortKey !== col) return <ArrowUpDown className="h-3 w-3 text-muted-foreground/40 ml-1 inline" />;
    return leadSortDir === "asc" ? <ArrowUp className="h-3 w-3 text-primary ml-1 inline" /> : <ArrowDown className="h-3 w-3 text-primary ml-1 inline" />;
  };

  const [actSortKey, setActSortKey] = useState<string>("created_at");
  const [actSortDir, setActSortDir] = useState<"asc" | "desc">("desc");
  const handleActSort = (key: string) => {
    if (actSortKey === key) setActSortDir(d => d === "asc" ? "desc" : "asc");
    else { setActSortKey(key); setActSortDir("desc"); }
  };
  const resetActSort = () => { setActSortKey("created_at"); setActSortDir("desc"); };
  const ActSortIcon = ({ col }: { col: string }) => {
    if (actSortKey !== col) return <ArrowUpDown className="h-3 w-3 text-muted-foreground/40 ml-1 inline" />;
    return actSortDir === "asc" ? <ArrowUp className="h-3 w-3 text-primary ml-1 inline" /> : <ArrowDown className="h-3 w-3 text-primary ml-1 inline" />;
  };

  // ── Leads state ──────────────────────────────────────────────────────
  const [leadStatusFilter, setLeadStatusFilter] = useState<LeadStatus | "all">("all");
  const [leadSearch, setLeadSearch] = useState("");
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);
  const [leadForm, setLeadForm] = useState(emptyLead);
  const [editingLead, setEditingLead] = useState<ApiLead | null>(null);
  const [convertTarget, setConvertTarget] = useState<ApiLead | null>(null);
  const [convertDealTitle, setConvertDealTitle] = useState("");
  const [convertDealValue, setConvertDealValue] = useState("");

  // ── Deals state ──────────────────────────────────────────────────────
  const [dealDialogOpen, setDealDialogOpen] = useState(false);
  const [dealForm, setDealForm] = useState(emptyDeal);
  const [editingDeal, setEditingDeal] = useState<ApiDeal | null>(null);

  // ── Activities state ─────────────────────────────────────────────────
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [activityForm, setActivityForm] = useState(emptyActivity);
  const [activityDoneFilter, setActivityDoneFilter] = useState<"all" | "pending" | "done">("pending");

  // ── Queries ───────────────────────────────────────────────────────────
  const leadsQuery = useQuery({
    queryKey: ["crm", "leads", leadStatusFilter, leadSearch],
    queryFn: () => fetchLeads({ status: leadStatusFilter === "all" ? "" : leadStatusFilter, search: leadSearch, limit: 100 }),
  });

  const pipelineQuery = useQuery({
    queryKey: ["crm", "pipeline"],
    queryFn: () => fetchPipeline(),
  });

  const dealsQuery = useQuery({
    queryKey: ["crm", "deals"],
    queryFn: () => fetchDeals({ limit: 100 }),
  });

  const activitiesQuery = useQuery({
    queryKey: ["crm", "activities", activityDoneFilter],
    queryFn: () =>
      fetchActivities({
        limit: 100,
        done: activityDoneFilter === "all" ? "" : activityDoneFilter === "done",
      }),
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["crm"] });
  };

  // ── Lead mutations ───────────────────────────────────────────────────
  const saveLead = useMutation({
    mutationFn: async () => {
      const payload = { ...leadForm };
      if (editingLead) return updateLead(editingLead.lead_id, payload);
      return createLead(payload);
    },
    onSuccess: () => {
      toast.success(editingLead ? "Lead updated" : "Lead created");
      setLeadDialogOpen(false);
      setEditingLead(null);
      setLeadForm(emptyLead);
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeLead = useMutation({
    mutationFn: (id: number) => deleteLead(id),
    onSuccess: () => { toast.success("Lead deleted"); invalidateAll(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const convertLeadMutation = useMutation({
    mutationFn: async () => {
      if (!convertTarget) return;
      return convertLead(convertTarget.lead_id, {
        create_deal: true,
        deal_title: convertDealTitle || undefined,
        deal_value: convertDealValue ? Number(convertDealValue) : undefined,
      });
    },
    onSuccess: () => {
      toast.success("Lead converted to customer + deal");
      setConvertTarget(null);
      setConvertDealTitle("");
      setConvertDealValue("");
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Deal mutations ───────────────────────────────────────────────────
  const saveDeal = useMutation({
    mutationFn: async () => {
      const payload = {
        ...dealForm,
        value: Number(dealForm.value || 0),
        probability: Number(dealForm.probability || 0),
        customer_id: dealForm.customer_id ? Number(dealForm.customer_id) : undefined,
        expected_close_date: dealForm.expected_close_date || undefined,
      };
      if (editingDeal) return updateDeal(editingDeal.deal_id, payload as any);
      return createDeal(payload as any);
    },
    onSuccess: () => {
      toast.success(editingDeal ? "Deal updated" : "Deal created");
      setDealDialogOpen(false);
      setEditingDeal(null);
      setDealForm(emptyDeal);
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeDeal = useMutation({
    mutationFn: (id: number) => deleteDeal(id),
    onSuccess: () => { toast.success("Deal deleted"); invalidateAll(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const moveStage = useMutation({
    mutationFn: ({ id, stage }: { id: number; stage: DealStage }) => changeDealStage(id, stage),
    onSuccess: () => { toast.success("Stage updated"); invalidateAll(); },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Activity mutations ───────────────────────────────────────────────
  const saveActivity = useMutation({
    mutationFn: async () => {
      const payload = { ...activityForm, related_id: Number(activityForm.related_id || 0) };
      return createActivity(payload as any);
    },
    onSuccess: () => {
      toast.success("Activity logged");
      setActivityDialogOpen(false);
      setActivityForm(emptyActivity);
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleDone = useMutation({
    mutationFn: ({ activity, done }: { activity: ApiActivity; done: boolean }) =>
      updateActivity(activity.activity_id, { done }),
    onSuccess: () => invalidateAll(),
    onError: (e: Error) => toast.error(e.message),
  });

  const removeActivity = useMutation({
    mutationFn: (id: number) => deleteActivity(id),
    onSuccess: () => { toast.success("Activity removed"); invalidateAll(); },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Derived ───────────────────────────────────────────────────────────
  const leads = useMemo(() => {
    const arr = leadsQuery.data?.data ?? [];
    return [...arr].sort((a, b) => {
      const av = (a as any)[leadSortKey] ?? "";
      const bv = (b as any)[leadSortKey] ?? "";
      const cmp = String(av).localeCompare(String(bv));
      return leadSortDir === "asc" ? cmp : -cmp;
    });
  }, [leadsQuery.data, leadSortKey, leadSortDir]);

  const deals = dealsQuery.data?.data ?? [];

  const activities = useMemo(() => {
    const arr = activitiesQuery.data?.data ?? [];
    return [...arr].sort((a, b) => {
      const av = (a as any)[actSortKey] ?? "";
      const bv = (b as any)[actSortKey] ?? "";
      const cmp = String(av).localeCompare(String(bv));
      return actSortDir === "asc" ? cmp : -cmp;
    });
  }, [activitiesQuery.data, actSortKey, actSortDir]);
  const pipeline = pipelineQuery.data;

  const stats = useMemo(() => {
    const openLeads = leads.filter((l) => l.status !== "lost" && !l.converted_customer_id).length;
    const totalPipelineValue = deals
      .filter((d) => d.stage !== "won" && d.stage !== "lost")
      .reduce((sum, d) => sum + Number(d.value || 0), 0);
    const wonValue = deals.filter((d) => d.stage === "won").reduce((sum, d) => sum + Number(d.value || 0), 0);
    const pendingActivities = activities.filter((a) => !a.done).length;
    return { openLeads, totalPipelineValue, wonValue, pendingActivities };
  }, [leads, deals, activities]);

  const openLeadDialog = (lead?: ApiLead) => {
    if (lead) {
      setEditingLead(lead);
      setLeadForm({
        name: lead.name,
        company_name: lead.company_name ?? "",
        email: lead.email ?? "",
        phone: lead.phone ?? "",
        source: lead.source ?? "website",
        status: lead.status,
        notes: lead.notes ?? "",
      });
    } else {
      setEditingLead(null);
      setLeadForm(emptyLead);
    }
    setLeadDialogOpen(true);
  };

  const openDealDialog = (deal?: ApiDeal) => {
    if (deal) {
      setEditingDeal(deal);
      setDealForm({
        title: deal.title,
        customer_id: deal.customer_id ? String(deal.customer_id) : "",
        value: String(deal.value ?? ""),
        currency: deal.currency,
        stage: deal.stage,
        expected_close_date: deal.expected_close_date ?? "",
        probability: String(deal.probability ?? "10"),
        notes: deal.notes ?? "",
      });
    } else {
      setEditingDeal(null);
      setDealForm(emptyDeal);
    }
    setDealDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">CRM</h1>
          <p className="text-muted-foreground">Leads, pipeline, and activity timeline for sales follow-up.</p>
        </div>
        <Button variant="outline" onClick={invalidateAll}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Open Leads" value={String(stats.openLeads)} subtitle="not lost or converted" icon={Users} />
        <StatCard title="Pipeline Value" value={inr(stats.totalPipelineValue)} subtitle="open deals" icon={TrendingUp} />
        <StatCard title="Won Value" value={inr(stats.wonValue)} subtitle="closed-won deals" icon={Target} />
        <StatCard title="Pending Activities" value={String(stats.pendingActivities)} subtitle="calls / meetings / tasks" icon={ClipboardList} />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="activities">Activities</TabsTrigger>
        </TabsList>

        {/* ════════════════════ LEADS ════════════════════ */}
        <TabsContent value="leads" className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <Input
                placeholder="Search leads..."
                value={leadSearch}
                onChange={(e) => setLeadSearch(e.target.value)}
                className="w-56"
              />
              <Select value={leadStatusFilter} onValueChange={(v) => setLeadStatusFilter(v as LeadStatus | "all")}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {LEAD_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              {(leadSortKey !== "created_at" || leadSortDir !== "desc") && (
                <Button variant="outline" size="sm" onClick={resetLeadSort} className="text-xs">
                  <RefreshCw className="h-3 w-3 mr-1" />Reset Sort
                </Button>
              )}
            </div>
            <Button onClick={() => openLeadDialog()}><Plus className="h-4 w-4" /> New Lead</Button>
          </div>

          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <ScrollableX>
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium cursor-pointer hover:text-foreground select-none" onClick={() => handleLeadSort("name")}>Name<LeadSortIcon col="name" /></th>
                    <th className="text-left px-4 py-3 font-medium cursor-pointer hover:text-foreground select-none" onClick={() => handleLeadSort("company_name")}>Company<LeadSortIcon col="company_name" /></th>
                    <th className="text-left px-4 py-3 font-medium cursor-pointer hover:text-foreground select-none" onClick={() => handleLeadSort("email")}>Contact<LeadSortIcon col="email" /></th>
                    <th className="text-left px-4 py-3 font-medium cursor-pointer hover:text-foreground select-none" onClick={() => handleLeadSort("source")}>Source<LeadSortIcon col="source" /></th>
                    <th className="text-left px-4 py-3 font-medium cursor-pointer hover:text-foreground select-none" onClick={() => handleLeadSort("status")}>Status<LeadSortIcon col="status" /></th>
                    <th className="text-right px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leadsQuery.isLoading && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading leads...</td></tr>
                  )}
                  {!leadsQuery.isLoading && leads.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No leads found</td></tr>
                  )}
                  {leads.map((l) => (
                    <tr key={l.lead_id} className="border-t hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium text-card-foreground">{l.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{l.company_name || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <div>{l.email || "—"}</div>
                        <div className="text-xs">{l.phone || ""}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{l.source || "—"}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={LEAD_STATUS_COLOR[l.status]}>{l.status}</Badge>
                        {l.converted_customer_id && <Badge className="ml-1 bg-emerald-500">Converted</Badge>}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Button size="sm" variant="ghost" onClick={() => openLeadDialog(l)}><Eye className="h-4 w-4" /></Button>
                        {!l.converted_customer_id && (
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Convert to customer + deal"
                            onClick={() => { setConvertTarget(l); setConvertDealTitle(l.company_name || l.name); }}
                          >
                            <Repeat className="h-4 w-4" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => removeLead.mutate(l.lead_id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollableX>
          </div>
        </TabsContent>

        {/* ════════════════════ PIPELINE ════════════════════ */}
        <TabsContent value="pipeline" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => openDealDialog()}><Plus className="h-4 w-4" /> New Deal</Button>
          </div>

          {pipelineQuery.isLoading ? (
            <div className="text-center text-muted-foreground py-8">Loading pipeline...</div>
          ) : (
            <ScrollableX>
              <div className="flex gap-4 min-w-max pb-2">
                {DEAL_STAGES.map((stage) => {
                  const stageDeals = pipeline?.[stage] ?? [];
                  const stageValue = stageDeals.reduce((sum, d) => sum + Number(d.value || 0), 0);
                  return (
                    <div key={stage} className={`w-72 shrink-0 rounded-xl border-t-4 bg-card border shadow-sm ${STAGE_COLOR[stage]}`}>
                      <div className="p-3 border-b">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-sm">{STAGE_LABEL[stage]}</h3>
                          <Badge variant="outline">{stageDeals.length}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{inr(stageValue)}</p>
                      </div>
                      <div className="p-2 space-y-2 max-h-[60vh] overflow-y-auto">
                        {stageDeals.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-4">No deals</p>
                        )}
                        {stageDeals.map((d) => (
                          <div key={d.deal_id} className="rounded-lg border bg-background p-3 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-medium leading-tight cursor-pointer" onClick={() => openDealDialog(d)}>{d.title}</p>
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => removeDeal.mutate(d.deal_id)}>
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </div>
                            {d.customer_name && <p className="text-xs text-muted-foreground">{d.customer_name}</p>}
                            <p className="text-sm font-semibold text-primary">{inr(d.value)}</p>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs text-muted-foreground">{d.probability}%</span>
                              {d.expected_close_date && (
                                <span className="text-xs text-muted-foreground">{d.expected_close_date}</span>
                              )}
                            </div>
                            <Select
                              value={d.stage}
                              onValueChange={(v) => moveStage.mutate({ id: d.deal_id, stage: v as DealStage })}
                            >
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {DEAL_STAGES.map((s) => (
                                  <SelectItem key={s} value={s} className="text-xs">Move to {STAGE_LABEL[s]}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollableX>
          )}
        </TabsContent>

        {/* ════════════════════ ACTIVITIES ════════════════════ */}
        <TabsContent value="activities" className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <Select value={activityDoneFilter} onValueChange={(v) => setActivityDoneFilter(v as any)}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
              {(actSortKey !== "created_at" || actSortDir !== "desc") && (
                <Button variant="outline" size="sm" onClick={resetActSort} className="text-xs">
                  <RefreshCw className="h-3 w-3 mr-1" />Reset Sort
                </Button>
              )}
            </div>
            <Button onClick={() => setActivityDialogOpen(true)}><Plus className="h-4 w-4" /> Log Activity</Button>
          </div>

          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <ScrollableX>
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium cursor-pointer hover:text-foreground select-none" onClick={() => handleActSort("type")}>Type<ActSortIcon col="type" /></th>
                    <th className="text-left px-4 py-3 font-medium cursor-pointer hover:text-foreground select-none" onClick={() => handleActSort("subject")}>Subject<ActSortIcon col="subject" /></th>
                    <th className="text-left px-4 py-3 font-medium cursor-pointer hover:text-foreground select-none" onClick={() => handleActSort("related_type")}>Related To<ActSortIcon col="related_type" /></th>
                    <th className="text-left px-4 py-3 font-medium cursor-pointer hover:text-foreground select-none" onClick={() => handleActSort("due_at")}>Due<ActSortIcon col="due_at" /></th>
                    <th className="text-left px-4 py-3 font-medium cursor-pointer hover:text-foreground select-none" onClick={() => handleActSort("done")}>Status<ActSortIcon col="done" /></th>
                    <th className="text-right px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activitiesQuery.isLoading && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading activities...</td></tr>
                  )}
                  {!activitiesQuery.isLoading && activities.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No activities found</td></tr>
                  )}
                  {activities.map((a) => (
                    <tr key={a.activity_id} className="border-t hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="capitalize">
                          {a.type === "call" && <Phone className="h-3 w-3 mr-1" />}
                          {a.type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-card-foreground">{a.subject}</div>
                        {a.notes && <div className="text-xs text-muted-foreground max-w-xs truncate">{a.notes}</div>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground capitalize">{a.related_type} #{a.related_id}</td>
                      <td className="px-4 py-3 text-muted-foreground">{a.due_at ? a.due_at.slice(0, 16).replace("T", " ") : "—"}</td>
                      <td className="px-4 py-3">
                        {a.done
                          ? <Badge className="bg-emerald-500"><CheckCircle2 className="h-3 w-3 mr-1" /> Done</Badge>
                          : <Badge variant="outline">Pending</Badge>}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleDone.mutate({ activity: a, done: !a.done })}
                        >
                          {a.done ? "Reopen" : "Mark done"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => removeActivity.mutate(a.activity_id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollableX>
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Lead create/edit dialog ──────────────────────────────────── */}
      <Dialog open={leadDialogOpen} onOpenChange={setLeadDialogOpen}>
        <DialogContent className="max-w-lg" onInteractOutside={e => e.preventDefault()}>
          <DialogHeader><DialogTitle>{editingLead ? "Edit Lead" : "New Lead"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name"><Input value={leadForm.name} onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })} /></Field>
            <Field label="Company"><Input value={leadForm.company_name} onChange={(e) => setLeadForm({ ...leadForm, company_name: e.target.value })} /></Field>
            <Field label="Email"><Input type="email" value={leadForm.email} onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })} /></Field>
            <Field label="Phone"><Input value={leadForm.phone} onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })} /></Field>
            <Field label="Source">
              <CreatableCombobox optionsKey="crm_lead_source" value={leadForm.source ?? ""} onChange={v => setLeadForm({ ...leadForm, source: v })} placeholder="Select lead source…" />
            </Field>
            <Field label="Status">
              <Select value={leadForm.status} onValueChange={(v) => setLeadForm({ ...leadForm, status: v as LeadStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEAD_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Notes"><Textarea value={leadForm.notes} onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })} /></Field>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button
              onClick={() => {
                if (!leadForm.name.trim()) return toast.error("Lead name is required");
                saveLead.mutate();
              }}
            >
              Save Lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Convert lead dialog ──────────────────────────────────────── */}
      <Dialog open={!!convertTarget} onOpenChange={(open) => !open && setConvertTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Convert Lead to Customer</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            This creates a customer record from <span className="font-medium">{convertTarget?.name}</span> and an
            initial deal in the Qualification stage.
          </p>
          <Field label="Deal title"><Input value={convertDealTitle} onChange={(e) => setConvertDealTitle(e.target.value)} /></Field>
          <Field label="Deal value"><Input type="number" value={convertDealValue} onChange={(e) => setConvertDealValue(e.target.value)} /></Field>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={() => convertLeadMutation.mutate()}>Convert</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Deal create/edit dialog ──────────────────────────────────── */}
      <Dialog open={dealDialogOpen} onOpenChange={setDealDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingDeal ? "Edit Deal" : "New Deal"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Title"><Input value={dealForm.title} onChange={(e) => setDealForm({ ...dealForm, title: e.target.value })} /></Field>
            <Field label="Customer ID"><Input type="number" value={dealForm.customer_id} onChange={(e) => setDealForm({ ...dealForm, customer_id: e.target.value })} /></Field>
            <Field label="Value"><Input type="number" value={dealForm.value} onChange={(e) => setDealForm({ ...dealForm, value: e.target.value })} /></Field>
            <Field label="Currency"><Input value={dealForm.currency} onChange={(e) => setDealForm({ ...dealForm, currency: e.target.value })} /></Field>
            <Field label="Stage">
              <Select value={dealForm.stage} onValueChange={(v) => setDealForm({ ...dealForm, stage: v as DealStage })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEAL_STAGES.map((s) => <SelectItem key={s} value={s}>{STAGE_LABEL[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Probability %"><Input type="number" value={dealForm.probability} onChange={(e) => setDealForm({ ...dealForm, probability: e.target.value })} /></Field>
            <Field label="Expected close date"><Input type="date" value={dealForm.expected_close_date} onChange={(e) => setDealForm({ ...dealForm, expected_close_date: e.target.value })} /></Field>
          </div>
          <Field label="Notes"><Textarea value={dealForm.notes} onChange={(e) => setDealForm({ ...dealForm, notes: e.target.value })} /></Field>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button
              onClick={() => {
                if (!dealForm.title.trim()) return toast.error("Deal title is required");
                saveDeal.mutate();
              }}
            >
              Save Deal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Activity create dialog ──────────────────────────────────── */}
      <Dialog open={activityDialogOpen} onOpenChange={setActivityDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Log Activity</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <Select value={activityForm.type} onValueChange={(v) => setActivityForm({ ...activityForm, type: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACTIVITY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Related to">
              <Select value={activityForm.related_type} onValueChange={(v) => setActivityForm({ ...activityForm, related_type: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="deal">Deal</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Related record ID"><Input type="number" value={activityForm.related_id} onChange={(e) => setActivityForm({ ...activityForm, related_id: e.target.value })} /></Field>
            <Field label="Due"><Input type="datetime-local" value={activityForm.due_at} onChange={(e) => setActivityForm({ ...activityForm, due_at: e.target.value })} /></Field>
          </div>
          <Field label="Subject"><Input value={activityForm.subject} onChange={(e) => setActivityForm({ ...activityForm, subject: e.target.value })} /></Field>
          <Field label="Notes"><Textarea value={activityForm.notes} onChange={(e) => setActivityForm({ ...activityForm, notes: e.target.value })} /></Field>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button
              onClick={() => {
                if (!activityForm.subject.trim()) return toast.error("Subject is required");
                if (!activityForm.related_id) return toast.error("Related record ID is required");
                saveActivity.mutate();
              }}
            >
              Save Activity
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
