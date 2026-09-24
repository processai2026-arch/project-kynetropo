import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AtSign, Bell, CalendarDays, ChevronRight, ClipboardList, History, Phone, Settings, ShieldCheck, Trophy, User } from "lucide-react";
import { SalesLayout } from "@/components/sales/SalesLayout";
import { useSalesAccess } from "@/hooks/useSalesAccess";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { salesMentionsApi } from "@/lib/api/sales";

/**
 * "More" tab — the less frequent destinations, kept out of the primary tabs.
 * Admin-only entries appear only for users who actually hold the permission.
 */
export default function SalesMore() {
  const { me, can, isSalesAdmin, loading } = useSalesAccess();
  const isMobile = useIsMobile();
  const [unreadMentions, setUnreadMentions] = useState(0);
  const push = usePushNotifications();
  const [testing, setTesting] = useState(false);

  // How many people are waiting on you. Failing quietly is right here: a badge
  // is a convenience, and a broken one should not take the menu with it.
  useEffect(() => {
    if (!can("sales.comments.view")) return;
    let live = true;
    salesMentionsApi
      .list({ unread: true, limit: 1 })
      .then((res) => live && setUnreadMentions(res.unread))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [can]);

  const items = [
    {
      to: "/sales/mentions",
      label: "Mentioned",
      icon: AtSign,
      show: can("sales.comments.view"),
      badge: unreadMentions,
    },
    { to: "/sales/meetings", label: "Meetings", icon: CalendarDays, show: can("sales.meetings.view") },
    { to: "/sales/calls", label: "Call History", icon: Phone, show: can("sales.calls.view") },
    { to: "/sales/activity", label: "Team Activity", icon: History, show: can("sales.dashboard.view") },
    { to: "/sales/challenges", label: "Challenges", icon: Trophy, show: can("sales.challenges.view") },
    { to: "/sales/tasks", label: "Tasks", icon: ClipboardList, show: can("sales.tasks.view") },
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

      {/*
        Notifications that arrive with the app closed. The in-app version only
        ever worked while a tab was open, which is not where people are when a
        task lands on them.
      */}
      {push.state !== "unsupported" && (
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <Bell className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-card-foreground">Notifications</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {push.state === "on"
                  ? "On — you'll be told when work is assigned to you and when someone comments or names you, even with the app closed. Tapping one opens it."
                  : push.state === "denied"
                    ? "Blocked in your browser settings. Allow notifications for this site to turn them back on."
                    : push.state === "unconfigured"
                      ? "Not available on this server yet."
                      : "Get told when work is assigned to you and when someone comments or names you — including when the app is closed."}
              </p>

              {push.state === "on" && (
                <button
                  type="button"
                  disabled={testing}
                  className="mt-2 text-xs font-medium text-primary underline disabled:opacity-50"
                  onClick={async () => {
                    setTesting(true);
                    try {
                      // Everything between pressing Enable and a notification
                      // arriving is invisible; this proves the whole chain.
                      toast.success(await push.sendTest());
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Could not send a test");
                    } finally {
                      setTesting(false);
                    }
                  }}
                >
                  {testing ? "Sending…" : "Send me a test"}
                </button>
              )}
            </div>

            {(push.state === "off" || push.state === "on") && (
              <Button
                size="sm"
                variant={push.state === "on" ? "outline" : "default"}
                className="h-9 shrink-0"
                disabled={push.busy}
                onClick={async () => {
                  if (push.state === "on") {
                    await push.disable();
                    toast.success("Notifications turned off");
                    return;
                  }
                  const result = await push.enable();
                  if (result === "on") toast.success("Notifications are on");
                  else if (result === "denied") toast.error("Notifications blocked in your browser");
                  else toast.error("Could not turn notifications on");
                }}
              >
                {push.busy ? "…" : push.state === "on" ? "Turn off" : "Enable"}
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
            {!!item.badge && item.badge > 0 && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                {item.badge > 99 ? "99+" : item.badge}
              </span>
            )}
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
