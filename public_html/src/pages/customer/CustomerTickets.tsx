import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { customerPortalApi } from "@/lib/api/krish";
import type { Ticket, Machine } from "@/types/krish";
import { ArrowLeft, Plus, Loader2, Cpu } from "lucide-react";
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

const EMPTY_FORM = { machine_id: "", title: "", description: "", priority: "medium" };

export default function CustomerTickets() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await customerPortalApi.tickets();
      setTickets((res as any).data ?? []);
    } catch {
      toast.error("Failed to load tickets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    customerPortalApi.machines()
      .then(r => setMachines((r as any).data ?? []))
      .catch(() => {});
  }, []);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.machine_id) { toast.error("Please select a machine"); return; }
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    setSaving(true);
    try {
      await customerPortalApi.raiseTicket({
        machine_id: parseInt(form.machine_id),
        title: form.title,
        description: form.description || undefined,
        priority: form.priority,
      });
      toast.success("Ticket raised successfully");
      setFormOpen(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to raise ticket");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => { logout(); navigate("/login"); };

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

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4 mr-1" />Back
            </Button>
            <h1 className="text-2xl font-bold text-foreground">My Tickets</h1>
          </div>
          <Button onClick={() => { setForm(EMPTY_FORM); setFormOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" />Raise Ticket
          </Button>
        </div>

        <div className="bg-card rounded-xl border shadow-sm">
          <div className="p-4">
            <div className="overflow-x-auto eco-float-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {["Ticket #", "Machine", "Title", "Priority", "Status", "Date"].map(h => (
                      <th key={h} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="py-3 px-4"><Skeleton className="h-4 w-20" /></td>
                      ))}
                    </tr>
                  ))}
                  {!loading && tickets.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No tickets yet — raise your first ticket</td>
                    </tr>
                  )}
                  {!loading && tickets.map(t => (
                    <tr key={t.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-medium text-card-foreground">{t.ticket_number}</td>
                      <td className="py-3 px-4 text-card-foreground">{t.machine_code ?? "—"}</td>
                      <td className="py-3 px-4 text-card-foreground">{t.title}</td>
                      <td className="py-3 px-4">
                        <Badge className={cn("border capitalize", priorityStyles[t.priority] ?? "bg-muted text-muted-foreground")}>
                          {t.priority}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={cn("border capitalize", statusStyles[t.status] ?? "bg-muted text-muted-foreground")}>
                          {t.status.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{new Date(t.created_at).toLocaleDateString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      <Dialog open={formOpen} onOpenChange={v => { if (!saving) setFormOpen(v); }}>
        <DialogContent className="max-w-md" onInteractOutside={e => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Raise a Ticket</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Machine *</Label>
              <Select value={form.machine_id} onValueChange={v => set("machine_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select your machine" /></SelectTrigger>
                <SelectContent>
                  {machines.map(m => (
                    <SelectItem key={m.id} value={String(m.id)}>
                      {m.machine_id} — {m.model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input value={form.title} onChange={e => set("title", e.target.value)} placeholder="Brief description of the issue" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={e => set("description", e.target.value)}
                placeholder="Describe the problem in detail…"
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={v => set("priority", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Submitting…</> : "Submit Ticket"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
