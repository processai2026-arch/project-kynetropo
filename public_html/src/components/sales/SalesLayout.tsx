import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, Users, CalendarClock, ClipboardList, Trophy, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSalesAccess } from "@/hooks/useSalesAccess";
import { useSalesNotifications } from "@/hooks/useSalesNotifications";
import { SalesQuickAdd } from "@/components/sales/SalesQuickAdd";
import { ViewAsBanner } from "@/components/sales/ViewAsSwitcher";
import { AppDestroyedGate } from "@/components/sales/challenge/AppDestroyedGate";

/**
 * Mobile bottom-tab navigation for the sales module (spec §5).
 *
 * Desktop keeps the application's existing sidebar — the tabs render only
 * below the app's 768px mobile breakpoint, so the desktop UI is untouched.
 * Calls are deliberately NOT a tab: logging a call belongs inside the lead
 * and follow-up workflow, and is reachable from the quick-add button.
 */
const TABS = [
  { label: "Home",       to: "/sales",            icon: Home,          permission: "sales.dashboard.view" },
  { label: "Leads",      to: "/sales/leads",      icon: Users,         permission: "sales.leads.view" },
  { label: "Follow-Ups", to: "/sales/followups",  icon: CalendarClock, permission: "sales.followups.view" },
  { label: "Tasks",      to: "/sales/tasks",      icon: ClipboardList, permission: "sales.tasks.view" },
  { label: "Challenges", to: "/sales/challenges", icon: Trophy,        permission: "sales.challenges.view" },
  { label: "More",       to: "/sales/more",       icon: MoreHorizontal, permission: null },
] as const;

export function SalesBottomTabs() {
  const { pathname } = useLocation();
  const { can } = useSalesAccess();

  const visible = TABS.filter((t) => t.permission === null || can(t.permission));
  if (visible.length <= 1) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Sales navigation"
    >
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${visible.length}, minmax(0, 1fr))` }}>
        {visible.map((tab) => {
          // "/sales" must only match exactly, or every sales route lights it up.
          const active = tab.to === "/sales" ? pathname === "/sales" : pathname.startsWith(tab.to);
          return (
            <li key={tab.to}>
              <Link
                to={tab.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  // 56px tall keeps the touch target comfortably above the 44px minimum
                  "flex h-14 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <tab.icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
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
  const { me, can, loading, lockout } = useSalesAccess();

  // Poll for follow-ups falling due, meetings starting and challenge deadlines.
  // A locked-out user is polling nothing: every endpoint refuses them anyway.
  useSalesNotifications(!loading && !lockout && can("sales.dashboard.view"), (url) => navigate(url));

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
       * Clears the bottom tab bar (3.5rem) AND the quick-add button floating
       * above it (its top edge sits 8rem up), plus a gap. Anything less and the
       * last control on a page — the Post button under a comment box, usually —
       * ends up underneath a button that does something else entirely.
       */
      style={isMobile ? { paddingBottom: "calc(9.5rem + env(safe-area-inset-bottom))" } : undefined}
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
