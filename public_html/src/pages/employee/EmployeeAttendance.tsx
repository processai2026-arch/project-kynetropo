import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { employeePortalApi } from "@/lib/api/krish";
import type { AttendanceLog } from "@/types/krish";
import { ArrowLeft, Cpu, MapPin, Loader2, Clock, CheckCircle2, Circle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const statusStyles: Record<string, string> = {
  present:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  absent:   "bg-red-50 text-red-600 border-red-200",
  half_day: "bg-amber-50 text-amber-600 border-amber-200",
  leave:    "bg-purple-50 text-purple-600 border-purple-200",
};

const methodStyles: Record<string, string> = {
  gps_auto: "bg-blue-50 text-blue-600 border-blue-200",
  manual:   "bg-gray-100 text-gray-500 border-gray-200",
};

export default function EmployeeAttendance() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [attendance, setAttendance] = useState<AttendanceLog | null>(null);
  const [records, setRecords] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthFilter, setMonthFilter] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);

  const loadAttendance = async () => {
    setLoading(true);
    try {
      const [todayRes, listRes] = await Promise.all([
        employeePortalApi.attendanceToday().catch(() => ({ data: null })),
        employeePortalApi.attendance({ month: monthFilter }),
      ]);
      setAttendance((todayRes as any).data ?? null);
      setRecords((listRes as any).data ?? []);
    } catch {
      toast.error("Failed to load attendance");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAttendance(); }, [monthFilter]);

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
      loadAttendance();
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
      loadAttendance();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Check-out failed");
    } finally {
      setCheckingOut(false);
    }
  };

  const handleLogout = () => { logout(); navigate("/login"); };

  const fmtTime = (t: string | null) => {
    if (!t) return "—";
    const d = new Date(t);
    return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", weekday: "short" });

  const checkedIn  = !!attendance?.check_in_time;
  const checkedOut = !!attendance?.check_out_time;
  const hoursWorked = attendance?.hours_worked ? `${Number(attendance.hours_worked).toFixed(1)}h` : null;

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

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-1" />Back
          </Button>
          <h1 className="text-2xl font-bold text-foreground">My Attendance</h1>
        </div>

        {/* Today's card */}
        <div className="bg-card rounded-xl border shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-card-foreground">Today</h2>
            <span className="text-xs text-muted-foreground ml-auto">
              {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
            </span>
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
              <Button className="w-full h-11" variant="outline" onClick={handleCheckOut} disabled={checkingOut}>
                {checkingOut
                  ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Getting location…</>
                  : <><MapPin className="h-4 w-4 mr-2" />Check Out</>
                }
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Circle className="h-5 w-5" />
                <span className="text-sm">Not checked in yet</span>
              </div>
              <Button className="w-full h-11" onClick={handleCheckIn} disabled={checkingIn}>
                {checkingIn
                  ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Getting location…</>
                  : <><MapPin className="h-4 w-4 mr-2" />Check In</>
                }
              </Button>
            </div>
          )}
        </div>

        {/* Month filter */}
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-card-foreground">Month</label>
          <Input
            type="month"
            value={monthFilter}
            onChange={e => setMonthFilter(e.target.value)}
            className="w-44"
          />
        </div>

        {/* Attendance history table */}
        <div className="bg-card rounded-xl border shadow-sm">
          <div className="p-4 border-b">
            <h2 className="text-base font-semibold text-card-foreground">Attendance History</h2>
          </div>
          <div className="p-4">
            <div className="overflow-x-auto eco-float-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {["Date", "Check In", "Check Out", "Hours", "Method", "Status"].map(h => (
                      <th key={h} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="py-3 px-4"><Skeleton className="h-4 w-16" /></td>
                      ))}
                    </tr>
                  ))}
                  {!loading && records.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No attendance records for this month</td>
                    </tr>
                  )}
                  {!loading && records.map(r => (
                    <tr key={r.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 text-card-foreground whitespace-nowrap">{fmtDate(r.date)}</td>
                      <td className="py-3 px-4 text-card-foreground">{fmtTime(r.check_in_time)}</td>
                      <td className="py-3 px-4 text-card-foreground">{fmtTime(r.check_out_time)}</td>
                      <td className="py-3 px-4 text-card-foreground">
                        {r.hours_worked ? `${Number(r.hours_worked).toFixed(1)}h` : "—"}
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={cn("border capitalize", methodStyles[r.method] ?? "bg-muted text-muted-foreground")}>
                          {r.method === "gps_auto" ? "GPS" : "Manual"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={cn("border capitalize", statusStyles[r.status] ?? "bg-muted text-muted-foreground")}>
                          {r.status.replace(/_/g, " ")}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
