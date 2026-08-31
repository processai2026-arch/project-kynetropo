import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { employeePortalApi } from "@/lib/api/krish";
import type { Ticket } from "@/types/krish";
import { ArrowLeft, Cpu, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const priorityStyles: Record<string, string> = {
  low:    "bg-gray-100 text-gray-500 border-gray-200",
  medium: "bg-amber-50 text-amber-600 border-amber-200",
  high:   "bg-orange-50 text-orange-600 border-orange-200",
  urgent: "bg-red-50 text-red-600 border-red-200",
};

const statusStyles: Record<string, string> = {
  open:        "bg-blue-50 text-blue-600 border-blue-200",
  assigned:    "bg-amber-50 text-amber-600 border-amber-200",
  in_progress: "bg-purple-50 text-purple-600 border-purple-200",
  resolved:    "bg-emerald-50 text-emerald-700 border-emerald-200",
  closed:      "bg-gray-100 text-gray-500 border-gray-200",
};

type StatusFilter = "all" | "assigned" | "in_progress" | "resolved";

interface TicketEditState {
  status: string;
  work_notes: string;
  resolution_notes: string;
}

export default function EmployeeTasks() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [edits, setEdits] = useState<Record<number, TicketEditState>>({});
  const [saving, setSaving] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== "all") params.status = statusFilter;
      const res = await employeePortalApi.tickets(params);
      setTickets((res as any).data ?? []);
    } catch {
      toast.error("Failed to load tickets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [statusFilter]);

  const toggleExpand = (id: number, ticket: Ticket) => {
    if (expanded === id) {
      setExpanded(null);
    } else {
      setExpanded(id);
      if (!edits[id]) {
        setEdits(prev => ({
          ...prev,
          [id]: {
            status: ticket.status,
            work_notes: ticket.work_notes ?? "",
            resolution_notes: ticket.resolution_notes ?? "",
          },
        }));
      }
    }
  };

  const setEditField = (id: number, k: keyof TicketEditState, v: string) => {
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], [k]: v } }));
  };

  const handleUpdate = async (id: number) => {
    const edit = edits[id];
    if (!edit) return;
    setSaving(id);
    try {
      await employeePortalApi.updateTicket(id, {
        status: edit.status,
        work_notes: edit.work_notes || undefined,
        resolution_notes: edit.resolution_notes || undefined,
      });
      toast.success("Ticket updated");
      setExpanded(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(null);
    }
  };

  const handleLogout = () => { logout(); navigate("/login"); };

  const filterOptions: { value: StatusFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "assigned", label: "Assigned" },
    { value: "in_progress", label: "In Progress" },
    { value: "resolved", label: "Resolved" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="bg-card border-b shadow-sm px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Cpu className="h-5 w-5 text-primary" />
          <span className="font-bold text-foreground text-base">Krish Agencies</span>
        </div>
        <Button variant="outline" size="sm" onClick={handleLogout}>Logout</Button>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-1" />Back to Home
          </Button>
        </div>

        <h1 className="text-2xl font-bold text-foreground">My Tasks</h1>

        {/* Status filter pills */}
        <div className="flex gap-2 flex-wrap">
          {filterOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
                statusFilter === opt.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:bg-muted"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Ticket cards */}
        <div className="space-y-3">
          {loading && Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-card rounded-xl border shadow-sm p-4 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-20" />
              </div>
            </div>
          ))}
          {!loading && tickets.length === 0 && (
            <div className="bg-card rounded-xl border shadow-sm p-8 text-center text-sm text-muted-foreground">
              No tickets found
            </div>
          )}
          {!loading && tickets.map(t => {
            const isOpen = expanded === t.id;
            const edit = edits[t.id];
            const isSaving = saving === t.id;

            return (
              <div key={t.id} className="bg-card rounded-xl border shadow-sm overflow-hidden">
                {/* Card header — always visible */}
                <button
                  className="w-full text-left p-4 hover:bg-muted/30 transition-colors"
                  onClick={() => toggleExpand(t.id, t)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-semibold text-primary">{t.ticket_number}</span>
                        <Badge className={cn("border capitalize text-xs", priorityStyles[t.priority] ?? "bg-muted text-muted-foreground")}>
                          {t.priority}
                        </Badge>
                        <Badge className={cn("border capitalize text-xs", statusStyles[t.status] ?? "bg-muted text-muted-foreground")}>
                          {t.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium text-card-foreground leading-tight">{t.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t.machine_code ?? "—"}{t.machine_model ? ` · ${t.machine_model}` : ""}
                        {t.customer_name ? ` · ${t.customer_name}` : ""}
                      </p>
                      {(t as any).location_name && (
                        <p className="text-xs text-muted-foreground">{(t as any).location_name}</p>
                      )}
                    </div>
                    <div className="shrink-0 text-muted-foreground mt-0.5">
                      {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </div>
                </button>

                {/* Expanded section */}
                {isOpen && edit && (
                  <div className="border-t bg-muted/20 p-4 space-y-4">
                    {t.description && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Description</p>
                        <p className="text-sm text-card-foreground">{t.description}</p>
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <Label>Update Status</Label>
                      <Select
                        value={edit.status}
                        onValueChange={v => setEditField(t.id, "status", v)}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Work Notes</Label>
                      <Textarea
                        value={edit.work_notes}
                        onChange={e => setEditField(t.id, "work_notes", e.target.value)}
                        placeholder="Describe what work was done…"
                        rows={3}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Resolution Notes</Label>
                      <Textarea
                        value={edit.resolution_notes}
                        onChange={e => setEditField(t.id, "resolution_notes", e.target.value)}
                        placeholder="How was the issue resolved?"
                        rows={2}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setExpanded(null)}>Cancel</Button>
                      <Button size="sm" disabled={isSaving} onClick={() => handleUpdate(t.id)}>
                        {isSaving ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Saving…</> : "Update"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
