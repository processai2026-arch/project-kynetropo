import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { customerPortalApi } from "@/lib/api/krish";
import { useAuth } from "@/contexts/AuthContext";
import { Ticket, ShoppingCart, Cpu, LogOut, Plus, ClipboardList } from "lucide-react";
import { toast } from "sonner";

const ticketStatusStyles: Record<string, string> = {
  open:        "bg-blue-50 text-blue-600 border-blue-200",
  assigned:    "bg-amber-50 text-amber-600 border-amber-200",
  in_progress: "bg-purple-50 text-purple-600 border-purple-200",
  resolved:    "bg-emerald-50 text-emerald-700 border-emerald-200",
  closed:      "bg-gray-100 text-gray-500 border-gray-200",
};

interface PortalStats {
  open_tickets: number;
  pending_orders: number;
  my_machines: number;
  recent_tickets: Array<{
    id: number;
    ticket_number: string;
    machine_code?: string;
    machine_model?: string;
    status: string;
    created_at: string;
  }>;
}

export default function CustomerPortal() {
  const navigate = useNavigate();
  const { userName, logout } = useAuth();
  const [stats, setStats] = useState<PortalStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await customerPortalApi.stats();
      setStats((res as any).data ?? null);
    } catch (err) {
      toast.error("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
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
          {userName && <span className="text-sm text-muted-foreground hidden sm:inline">Hello, {userName}</span>}
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-1" />Logout
          </Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Welcome */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Welcome back{userName ? `, ${userName}` : ""}!</p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-card rounded-xl border shadow-sm p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Open Tickets</p>
              <Ticket className="h-6 w-6 text-primary" />
            </div>
            {loading
              ? <Skeleton className="h-8 w-16 mt-1" />
              : <p className="text-2xl font-bold mt-1 text-card-foreground">{stats?.open_tickets ?? 0}</p>
            }
          </div>
          <div className="bg-card rounded-xl border shadow-sm p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Pending Orders</p>
              <ShoppingCart className="h-6 w-6 text-primary" />
            </div>
            {loading
              ? <Skeleton className="h-8 w-16 mt-1" />
              : <p className="text-2xl font-bold mt-1 text-card-foreground">{stats?.pending_orders ?? 0}</p>
            }
          </div>
          <div className="bg-card rounded-xl border shadow-sm p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">My Machines</p>
              <Cpu className="h-6 w-6 text-primary" />
            </div>
            {loading
              ? <Skeleton className="h-8 w-16 mt-1" />
              : <p className="text-2xl font-bold mt-1 text-card-foreground">{stats?.my_machines ?? 0}</p>
            }
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-4">
          <Button
            className="h-14 text-base"
            onClick={() => navigate("/tickets")}
          >
            <Plus className="h-5 w-5 mr-2" />Raise a Ticket
          </Button>
          <Button
            variant="outline"
            className="h-14 text-base"
            onClick={() => navigate("/orders")}
          >
            <ShoppingCart className="h-5 w-5 mr-2" />Place an Order
          </Button>
        </div>

        {/* Recent tickets */}
        <div className="bg-card rounded-xl border shadow-sm">
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold text-card-foreground">Recent Tickets</h2>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/tickets")}>View All</Button>
          </div>
          <div className="p-4">
            <div className="overflow-x-auto eco-float-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {["Ticket #", "Machine", "Status", "Date"].map(h => (
                      <th key={h} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      {Array.from({ length: 4 }).map((_, j) => (
                        <td key={j} className="py-3 px-4"><Skeleton className="h-4 w-20" /></td>
                      ))}
                    </tr>
                  ))}
                  {!loading && (!stats?.recent_tickets || stats.recent_tickets.length === 0) && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-sm text-muted-foreground">No tickets raised yet</td>
                    </tr>
                  )}
                  {!loading && stats?.recent_tickets?.map(t => (
                    <tr key={t.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-medium text-card-foreground">{t.ticket_number}</td>
                      <td className="py-3 px-4 text-card-foreground">{t.machine_code ?? "—"} {t.machine_model ? `(${t.machine_model})` : ""}</td>
                      <td className="py-3 px-4">
                        <Badge className={cn("border capitalize", ticketStatusStyles[t.status] ?? "bg-muted text-muted-foreground")}>
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
    </div>
  );
}
