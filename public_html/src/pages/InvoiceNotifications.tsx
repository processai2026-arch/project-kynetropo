import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { invoiceNotificationsApi } from "@/lib/api/invoiceNotifications";
import type { InvoiceNotification } from "@/types/invoiceNotification";

const typeColors: Record<string, string> = {
  low_stock:        "bg-amber-50 text-amber-700 border-amber-200",
  duplicate_invoice:"bg-blue-50 text-blue-600 border-blue-200",
  gst_mismatch:     "bg-red-50 text-red-600 border-red-200",
  invoice_error:    "bg-red-50 text-red-600 border-red-200",
  ai_low_confidence:"bg-orange-50 text-orange-600 border-orange-200",
  new_sales_record: "bg-emerald-50 text-emerald-700 border-emerald-200",
  inventory_warning:"bg-amber-50 text-amber-700 border-amber-200",
  gst_due:          "bg-purple-50 text-purple-600 border-purple-200",
};

export default function InvoiceNotifications() {
  const [items, setItems] = useState<InvoiceNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const res = await invoiceNotificationsApi.list();
      setItems(res.data ?? []);
      setUnread(res.pagination?.unread_count ?? 0);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleMarkRead = async (id: number) => {
    try {
      await invoiceNotificationsApi.markRead(id);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const handleReadAll = async () => {
    try {
      await invoiceNotificationsApi.readAll();
      toast.success("All marked as read");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await invoiceNotificationsApi.remove(id);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const grouped = useMemo(() => {
    const today: InvoiceNotification[] = [];
    const yesterday: InvoiceNotification[] = [];
    const older: InvoiceNotification[] = [];
    const now = new Date();
    const todayStr = now.toDateString();
    const yest = new Date(now); yest.setDate(yest.getDate() - 1);
    const yesterdayStr = yest.toDateString();
    for (const n of items) {
      const d = new Date(n.created_at).toDateString();
      if (d === todayStr) today.push(n);
      else if (d === yesterdayStr) yesterday.push(n);
      else older.push(n);
    }
    return [
      { label: "Today", items: today },
      { label: "Yesterday", items: yesterday },
      { label: "Earlier", items: older },
    ].filter(g => g.items.length > 0);
  }, [items]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-foreground">Invoice Notifications</h1>
          {unread > 0 && <Badge className="bg-primary text-primary-foreground border-0">{unread} unread</Badge>}
        </div>
        {unread > 0 && (
          <Button variant="outline" onClick={handleReadAll}><CheckCheck className="h-4 w-4 mr-2" />Mark all read</Button>
        )}
      </div>

      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-4">
          {loading && Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-3 py-3 border-b last:border-0">
              <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
              <div className="flex-1 space-y-1.5"><Skeleton className="h-4 w-48" /><Skeleton className="h-3 w-72" /></div>
            </div>
          ))}
          {!loading && items.length === 0 && (
            <div className="py-12 text-center">
              <Bell className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">No notifications</p>
            </div>
          )}
          {!loading && grouped.map(group => (
            <div key={group.label}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 pt-3 pb-1">{group.label}</p>
              {group.items.map(n => (
                <div key={n.notification_id} className={cn("flex items-start gap-3 py-3 border-b last:border-0 transition-colors", !n.is_read && "bg-primary/5")}>
                  <div className="shrink-0 mt-0.5">
                    <Badge className={cn("border text-xs capitalize", typeColors[n.type] ?? "bg-muted text-muted-foreground")}>
                      {n.type.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm", n.is_read ? "text-card-foreground" : "font-semibold text-foreground")}>{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{new Date(n.created_at).toLocaleString("en-IN")}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {!n.is_read && (
                      <Button variant="ghost" size="icon" title="Mark as read" onClick={() => handleMarkRead(n.notification_id)}>
                        <CheckCheck className="h-4 w-4 text-primary" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(n.notification_id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
