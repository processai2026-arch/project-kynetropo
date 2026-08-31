import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { attendanceApi, employeesApi } from "@/lib/api/krish";
import type { AttendanceLog, Employee } from "@/types/krish";
import { CalendarDays, Plus, Pencil, Search } from "lucide-react";
import { toast } from "sonner";

const statusStyles: Record<string, string> = {
  present:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  absent:   "bg-red-50 text-red-600 border-red-200",
  half_day: "bg-amber-50 text-amber-600 border-amber-200",
};

const methodStyles: Record<string, string> = {
  gps_auto: "bg-emerald-50 text-emerald-700 border-emerald-200",
  manual:   "bg-gray-100 text-gray-500 border-gray-200",
};

const EMPTY_MANUAL = {
  employee_id: 0,
  date: new Date().toISOString().slice(0, 10),
  check_in_time: "",
  check_out_time: "",
  status: "present" as const,
  notes: "",
};

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  const match = iso.match(/[T ](\d{2}):(\d{2})/);
  if (!match) return "—";
  let h = parseInt(match[1], 10);
  const m = match[2];
  const period = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${String(h).padStart(2, "0")}:${m} ${period}`;
}

export default function Attendance() {
  const [items, setItems]               = useState<AttendanceLog[]>([]);
  const [employees, setEmployees]       = useState<Employee[]>([]);
  const [loading, setLoading]           = useState(true);
  const [empFilter, setEmpFilter]       = useState("all");
  const [dateFilter, setDateFilter]     = useState("");
  const [monthFilter, setMonthFilter]   = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [manualOpen, setManualOpen]     = useState(false);
  const [form, setForm]                 = useState(EMPTY_MANUAL);
  const [saving, setSaving]             = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (empFilter !== "all") params.employee_id = empFilter;
      if (dateFilter)          params.date         = dateFilter;
      if (monthFilter)         params.month        = monthFilter;
      if (statusFilter !== "all") params.status    = statusFilter;
      const res = await attendanceApi.list(params);
      setItems((res as any).data ?? []);
    } catch {
      toast.error("Failed to load attendance logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [empFilter, statusFilter]);

  useEffect(() => {
    employeesApi.list({ status: "active" })
      .then(r => setEmployees((r as any).data ?? []))
      .catch(() => {});
  }, []);

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const openManual = () => { setForm(EMPTY_MANUAL); setManualOpen(true); };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.employee_id) { toast.error("Employee is required"); return; }
    if (!form.date)        { toast.error("Date is required"); return; }
    setSaving(true);
    try {
      await attendanceApi.manual(form);
      toast.success("Attendance entry saved");
      setManualOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Attendance</h1>
        <Button onClick={openManual}><Plus className="h-4 w-4 mr-2" />Manual Entry</Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={empFilter} onValueChange={setEmpFilter}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="All employees" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Employees</SelectItem>
            {employees.map(e => (
              <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex flex-col gap-1">
          <Input
            type="date"
            className="w-[160px]"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            placeholder="Filter by date"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Input
            type="month"
            className="w-[160px]"
            value={monthFilter}
            onChange={e => setMonthFilter(e.target.value)}
            placeholder="Filter by month"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="present">Present</SelectItem>
            <SelectItem value="absent">Absent</SelectItem>
            <SelectItem value="half_day">Half Day</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={load}>
          <Search className="h-4 w-4 mr-2" />Search
        </Button>
      </div>

      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-4 border-b flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold text-card-foreground">Attendance Logs ({items.length})</h2>
        </div>
        <div className="p-4">
          <div className="overflow-x-auto eco-float-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  {["Employee", "Date", "Check In", "Check Out", "Hours", "Location", "Method", "Status", "Actions"].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="py-3 px-4"><Skeleton className="h-4 w-20" /></td>
                    ))}
                  </tr>
                ))}
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center text-muted-foreground text-sm">No attendance records found</td>
                  </tr>
                )}
                {!loading && items.map(log => (
                  <tr key={log.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-medium text-card-foreground">
                      {log.employee_name ?? `Employee #${log.employee_id}`}
                    </td>
                    <td className="py-3 px-4 text-card-foreground">{log.date}</td>
                    <td className="py-3 px-4 text-card-foreground">{fmtTime(log.check_in_time)}</td>
                    <td className="py-3 px-4 text-card-foreground">{fmtTime(log.check_out_time)}</td>
                    <td className="py-3 px-4 text-card-foreground">
                      {log.hours_worked != null ? `${Number(log.hours_worked).toFixed(1)}h` : "—"}
                    </td>
                    <td className="py-3 px-4 text-card-foreground">{log.location_name ?? "—"}</td>
                    <td className="py-3 px-4">
                      <Badge className={cn("border capitalize", methodStyles[log.method] ?? "bg-muted text-muted-foreground")}>
                        {log.method.replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Badge className={cn("border capitalize", statusStyles[log.status] ?? "bg-muted text-muted-foreground")}>
                        {log.status.replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setForm({
                            employee_id: log.employee_id,
                            date: log.date,
                            check_in_time: log.check_in_time
                              ? log.check_in_time.slice(0, 16)
                              : "",
                            check_out_time: log.check_out_time
                              ? log.check_out_time.slice(0, 16)
                              : "",
                            status: log.status,
                            notes: log.notes ?? "",
                          });
                          setManualOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Dialog open={manualOpen} onOpenChange={v => { if (!saving) setManualOpen(v); }}>
        <DialogContent className="max-w-lg" onInteractOutside={e => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Manual Attendance Entry</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Employee *</Label>
              <Select
                value={form.employee_id ? String(form.employee_id) : ""}
                onValueChange={v => set("employee_id", parseInt(v))}
              >
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {employees.map(e => (
                    <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={form.date} onChange={e => set("date", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Check In Time</Label>
                <Input
                  type="datetime-local"
                  value={form.check_in_time}
                  onChange={e => set("check_in_time", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Check Out Time</Label>
                <Input
                  type="datetime-local"
                  value={form.check_out_time}
                  onChange={e => set("check_out_time", e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                  <SelectItem value="half_day">Half Day</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={e => set("notes", e.target.value)}
                rows={2}
                placeholder="Reason or notes..."
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setManualOpen(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Entry"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
