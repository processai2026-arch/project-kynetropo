import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, Users, CalendarClock, Trophy, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSalesAccess } from "@/hooks/useSalesAccess";

/**
 * Mobile bottom-tab navigation for the sales module (spec §5).
 *
 * Desktop keeps the application's existing sidebar — the tabs render only
 * below the app's 768px mobile breakpoint, so the desktop UI is untouched.
 * Calls are deliberately NOT a tab: logging a call belongs inside the lead
 * and follow-up workflow.
 */
const TABS = [
  { label: "Home",       to: "/sales",            icon: Home,          permission: "sales.dashboard.view" },
  { label: "Leads",      to: "/sales/leads",      icon: Users,         permission: "sales.leads.view" },
  { label: "Follow-Ups", to: "/sales/followups",  icon: CalendarClock, permission: "sales.followups.view" },
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
      <ul className="grid grid-cols-5">
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
                <span className="leading-none">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Wraps every sales page: adds the bottom tabs and the padding they need on
 * mobile, and leaves desktop rendering to the existing DashboardLayout.
 */
export function SalesLayout({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();

  return (
    <div className={cn("space-y-5", isMobile && "pb-20")}>
      {children}
      <SalesBottomTabs />
    </div>
  );
}

export default SalesLayout;
