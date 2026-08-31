import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, CalendarDays, ChevronRight, History, Phone, Settings, ShieldCheck, Trophy, User } from "lucide-react";
import { SalesLayout } from "@/components/sales/SalesLayout";
import { useSalesAccess } from "@/hooks/useSalesAccess";
import { useIsMobile } from "@/hooks/use-mobile";
import { requestNotificationPermission } from "@/hooks/useSalesNotifications";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

/**
 * "More" tab — the less frequent destinations, kept out of the primary tabs.
 * Admin-only entries appear only for users who actually hold the permission.
 */
export default function SalesMore() {
  const { me, can, isSalesAdmin, loading } = useSalesAccess();
  const isMobile = useIsMobile();
  const [permission, setPermission] = useState<string>("default");

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) setPermission(Notification.permission);
  }, []);

  const items = [
    { to: "/sales/meetings", label: "Meetings", icon: CalendarDays, show: can("sales.meetings.view") },
    { to: "/sales/calls", label: "Call History", icon: Phone, show: can("sales.calls.view") },
    { to: "/sales/activity", label: "Activity History", icon: History, show: can("sales.dashboard.view") },
    { to: "/sales/challenges", label: "Challenges", icon: Trophy, show: can("sales.challenges.view") },
    // Access control is deliberately desktop-only — administering permissions
    // is not something to do from a phone, and it keeps the app to the five
    // things a salesperson actually needs.
    {
      to: "/sales/access-control",
      label: "Access Control",
      icon: ShieldCheck,
      show: !isMobile && (isSalesAdmin || can("sales.challenges.manage")),
      admin: true,
    },
    { to: "/settings", label: "Settings", icon: Settings, show: true },
  ].filter((i) => i.show);

  return (
    <SalesLayout>
      <h1 className="text-2xl font-bold text-foreground">More</h1>

      {loading ? (
        <Skeleton className="h-20 w-full rounded-2xl" />
      ) : (
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-secondary">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold text-card-foreground">{me?.name || "—"}</p>
              <p className="truncate text-xs text-muted-foreground">{me?.email}</p>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            {isSalesAdmin ? "Sales administrator" : `${me?.permissions.length ?? 0} sales permissions`}
          </p>
        </div>
      )}

      {/* Alerts replace the old bell icon: the app tells you, you don't go looking. */}
      {typeof window !== "undefined" && "Notification" in window && (
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <Bell className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-card-foreground">Alerts</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {permission === "granted"
                  ? "On — you'll be alerted about follow-ups falling due, meetings starting and challenge deadlines while the app is open."
                  : permission === "denied"
                    ? "Blocked in your browser settings. Re-enable notifications for this site to turn them back on."
                    : "Get told about follow-ups falling due, meetings starting and challenge deadlines."}
              </p>
            </div>
            {permission === "default" && (
              <Button
                size="sm"
                className="h-9 shrink-0"
                onClick={async () => {
                  const result = await requestNotificationPermission();
                  if (result === "unsupported") {
                    toast.error("This browser does not support notifications");
                    return;
                  }
                  setPermission(result);
                  if (result === "granted") toast.success("Alerts enabled");
                  else if (result === "denied") toast.error("Alerts blocked");
                }}
              >
                Enable
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm divide-y">
        {items.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-muted/40"
          >
            <item.icon className="h-5 w-5 shrink-0 text-muted-foreground" />
            <span className="flex-1 text-sm font-medium text-card-foreground">{item.label}</span>
            {item.admin && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Admin
              </span>
            )}
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </SalesLayout>
  );
}
