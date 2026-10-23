import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, Users, CalendarClock, ClipboardList, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSalesAccess } from "@/hooks/useSalesAccess";
import { useSalesNotifications } from "@/hooks/useSalesNotifications";
import { useKeepPushRegistered } from "@/hooks/usePushNotifications";
import { SalesQuickAdd } from "@/components/sales/SalesQuickAdd";
import { ViewAsBanner } from "@/components/sales/ViewAsSwitcher";
import { AppDestroyedGate } from "@/components/sales/challenge/AppDestroyedGate";
import { salesFollowupsApi } from "@/lib/api/sales";
import { isPhoneTab } from "@/components/phone/PhoneKit";

/**
 * The phone app's tabs (Diamond Fencing's design): five, so every label fits — Home, Leads,
 * Follow-Ups, Tasks, More. Clients, Challenges, Meetings and the rest are under More. The open
 * tab's icon sits in a tinted pill; Follow-Ups carries how many are due today or overdue.
 *
 * Shown on the main screens only: an opened lead, meeting or challenge has its back arrow
 * instead. Desktop keeps the sidebar — the tabs render only below the 768px breakpoint.
 */
const TABS = [
  { label: "Home",       to: "/sales",           icon: Home,           permission: "sales.dashboard.view" },
  { label: "Leads",      to: "/sales/leads",     icon: Users,          permission: "sales.leads.view" },
  { label: "Follow-Ups", to: "/sales/followups", icon: CalendarClock,  permission: "sales.followups.view" },
  { label: "Tasks",      to: "/sales/tasks",     icon: ClipboardList,  permission: "sales.tasks.view" },
  { label: "More",       to: "/sales/more",      icon: MoreHorizontal, permission: null },
] as const;

export function SalesBottomTabs() {
  const { pathname } = useLocation();
  const { can } = useSalesAccess();
  const [due, setDue] = useState(0);
  const canFollowups = can("sales.followups.view");

  useEffect(() => {
    if (!canFollowups) return;
    let live = true;
    salesFollowupsApi.list("today")
      .then((r) => { if (live) setDue((r.counts?.today ?? 0) + (r.counts?.overdue ?? 0)); })
      .catch(() => undefined);
    return () => { live = false; };
  }, [pathname, canFollowups]);

  const visible = TABS.filter((t) => t.permission === null || can(t.permission));
  if (visible.length <= 1 || !isPhoneTab(pathname)) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="Sales navigation"
    >
      <ul className="mx-auto grid max-w-2xl" style={{ gridTemplateColumns: `repeat(${visible.length}, minmax(0, 1fr))` }}>
        {visible.map((tab) => {
          // "/sales" must only match exactly, or every sales route lights it up.
          const active = tab.to === "/sales" ? pathname === "/sales" : pathname.startsWith(tab.to);
          const badge = tab.to === "/sales/followups" ? due : 0;
          return (
            <li key={tab.to}>
              <Link
                to={tab.to}
                aria-current={active ? "page" : undefined}
                className={cn("flex min-h-16 flex-col items-center justify-center gap-1 text-xs",
                  active ? "font-semibold text-foreground" : "font-medium text-muted-foreground")}
              >
                <span className={cn("relative flex h-8 w-14 items-center justify-center rounded-full", active && "bg-primary/15 text-primary")}>
                  <tab.icon className="h-6 w-6" />
                  {badge > 0 && (
                    <span className="absolute -right-0.5 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-bold text-white">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </span>
                <span className="w-full truncate px-0.5 text-center leading-none">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Wraps every sales page: bottom tabs, the quick-add button, and the alert
 * poller. Desktop rendering is left to the existing DashboardLayout.
 *
 * `onCreated` lets a page refresh itself after something is created from the
 * quick-add sheet.
 */
export function SalesLayout({
  children,
  onCreated,
}: {
  children: ReactNode;
  onCreated?: () => void;
}) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const tab = isPhoneTab(pathname);
  const { me, can, loading, lockout } = useSalesAccess();

  // Poll for follow-ups falling due, meetings starting and challenge deadlines.
  // A locked-out user is polling nothing: every endpoint refuses them anyway.
  useSalesNotifications(!loading && !lockout && can("sales.dashboard.view"), (url) => navigate(url));
  // Re-registers this device with the server on startup. A browser can
  // replace a push subscription without telling the app, and a shared
  // device has to follow whoever is signed in now rather than last time.
  useKeepPushRegistered(!loading && !lockout);

  // Accepting a challenge and missing the deadline destroys this user's access.
  // The server enforces it too (every sales endpoint answers them with 423);
  // this is the part that tells them why.
  if (lockout) {
    return <AppDestroyedGate lockout={lockout} userName={me?.name} />;
  }

  return (
    <div
      className="space-y-5"
      /*
       * Clears the bottom tab bar (4rem, main screens only) AND the Add button
       * floating above it, plus a gap. Anything less and the
       * last control on a page — the Post button under a comment box, usually —
       * ends up underneath a button that does something else entirely.
       */
      style={isMobile ? { paddingBottom: `calc(${tab ? "10rem" : "6rem"} + env(safe-area-inset-bottom))` } : undefined}
    >
      {/*
        Whose figures these are, said on every screen. Forgetting you are
        looking at a colleague is the one real risk in a mode like this.
      */}
      <ViewAsBanner />
      {children}
      <SalesQuickAdd onCreated={onCreated} />
      <SalesBottomTabs />
    </div>
  );
}

export default SalesLayout;
