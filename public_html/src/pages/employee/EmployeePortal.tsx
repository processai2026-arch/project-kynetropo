import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { employeePortalApi } from "@/lib/api/krish";
import type { AttendanceLog, Ticket } from "@/types/krish";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut, Cpu, MapPin, Loader2, Clock, ClipboardList, CheckCircle2, Circle } from "lucide-react";
import { toast } from "sonner";

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

interface EmployeeStats {
  assigned_tickets: number;
  resolved_today: number;
  today_tickets: Ticket[];
}

export default function EmployeePortal() {
  const navigate = useNavigate();
  const { userName, logout } = useAuth();
  const [attendance, setAttendance] = useState<AttendanceLog | null>(null);
  const [stats, setStats] = useState<EmployeeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [attRes, statsRes] = await Promise.all([
        employeePortalApi.attendanceToday().catch(() => ({ data: null })),
        employeePortalApi.stats().catch(() => ({ data: null })),
      ]);
      setAttendance((attRes as any).data ?? null);
      setStats((statsRes as any).data ?? null);
    } catch {
      toast.error("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const getCoords = (): Promise<{ latitude?: number; longitude?: number }> =>
    new Promise(resolve => {
      if (!navigator.geolocation) { resolve({}); return; }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => resolve({}),
        { timeout: 8000 }
      );
    });

  const handleCheckIn = async () => {
    setCheckingIn(true);
    try {
      const coords = await getCoords();
      await employeePortalApi.checkIn(coords);
      toast.success("Checked in successfully");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Check-in failed");
    } finally {
      setCheckingIn(false);
    }
  };

  const handleCheckOut = async () => {
    setCheckingOut(true);
    try {
      const coords = await getCoords();
      await employeePortalApi.checkOut(coords);
      toast.success("Checked out successfully");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Check-out failed");
    } finally {
      setCheckingOut(false);
    }
  };

  const handleLogout = () => { logout(); navigate("/login"); };

  const checkedIn  = !!attendance?.check_in_time;
  const checkedOut = !!attendance?.check_out_time;
  const hoursWorked = attendance?.hours_worked ? `${Number(attendance.hours_worked).toFixed(1)}h` : null;

  const fmtTime = (t: string | null) => {
    if (!t) return "—";
    const d = new Date(t);
    return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="bg-card border-b shadow-sm px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Cpu className="h-5 w-5 text-primary" />
          <span className="font-bold text-foreground text-base">Krish Agencies</span>
        </div>
        <div className="flex items-center gap-3">
          {userName && <span className="text-sm text-muted-foreground hidden sm:inline">{userName}</span>}
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-1" />Logout
          </Button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Today, {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</p>
        </div>

        {/* Attendance card */}
        <div className="bg-card rounded-xl border shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-card-foreground">Today's Attendance</h2>
          </div>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : checkedIn && checkedOut ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Day complete — {hoursWorked ?? "—"} worked</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-0.5">Check In</p>
                  <p className="font-semibold text-card-foreground">{fmtTime(attendance!.check_in_time)}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-0.5">Check Out</p>
                  <p className="font-semibold text-card-foreground">{fmtTime(attendance!.check_out_time)}</p>
                </div>
              </div>
            </div>
          ) : checkedIn ? (
            <div className="space-y-3">
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <p className="text-xs text-muted-foreground mb-0.5">Checked In At</p>
                <p className="font-semibold text-card-foreground">{fmtTime(attendance!.check_in_time)}</p>
              </div>
              <Button
                className="w-full h-12 text-base"
                variant="outline"
                onClick={handleCheckOut}
                disabled={checkingOut}
              >
                {checkingOut
                  ? <><Loader2 className="h-5 w-5 animate-spin mr-2" />Getting location…</>
                  : <><MapPin className="h-5 w-5 mr-2" />Check Out</>
                }
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Circle className="h-5 w-5" />
                <span className="text-sm">Not checked in yet</span>
              </div>
              <Button
                className="w-full h-12 text-base"
                onClick={handleCheckIn}
                disabled={checkingIn}
              >
                {checkingIn
                  ? <><Loader2 className="h-5 w-5 animate-spin mr-2" />Getting location…</>
                  : <><MapPin className="h-5 w-5 mr-2" />Check In</>
                }
              </Button>
            </div>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-card rounded-xl border shadow-sm p-4">
            <p className="text-xs text-muted-foreground">Assigned Tickets</p>
            {loading
              ? <Skeleton className="h-8 w-12 mt-1" />
              : <p className="text-2xl font-bold mt-1 text-card-foreground">{stats?.assigned_tickets ?? 0}</p>
            }
          </div>
          <div className="bg-card rounded-xl border shadow-sm p-4">
            <p className="text-xs text-muted-foreground">Resolved Today</p>
            {loading
              ? <Skeleton className="h-8 w-12 mt-1" />
              : <p className="text-2xl font-bold mt-1 text-card-foreground">{stats?.resolved_today ?? 0}</p>
            }
          </div>
        </div>

        {/* Today's tasks */}
        <div className="bg-card rounded-xl border shadow-sm">
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold text-card-foreground">Today's Tasks</h2>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/tasks")}>View All</Button>
          </div>
          <div className="divide-y">
            {loading && Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-4 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-32" />
              </div>
            ))}
            {!loading && (!stats?.today_tickets || stats.today_tickets.length === 0) && (
              <div className="p-6 text-center text-sm text-muted-foreground">No tasks assigned for today</div>
            )}
            {!loading && stats?.today_tickets?.map(t => (
              <div
                key={t.id}
                className="p-4 hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => navigate("/tasks")}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-card-foreground truncate">{t.ticket_number} — {t.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t.machine_code ?? "—"} · {(t as any).location_name ?? "—"}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Badge className={cn("border capitalize text-xs", priorityStyles[t.priority] ?? "bg-muted text-muted-foreground")}>
                      {t.priority}
                    </Badge>
                    <Badge className={cn("border capitalize text-xs", statusStyles[t.status] ?? "bg-muted text-muted-foreground")}>
                      {t.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
