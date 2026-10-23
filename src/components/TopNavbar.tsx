// Headset, not LifeBuoy: the ring-and-spokes life ring reads as a wheel or a
// target at 20px, which is not "talk to someone".
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Bell, ChevronDown, LayoutGrid, LogOut, Maximize2, MessageSquare,
  Minimize2, MonitorDown, RefreshCcw, Settings, ShoppingCart, UserRound,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api/client";
import { useDashboardLayout } from "@/hooks/useDashboardLayout";
import { useActiveModule } from "@/hooks/useActiveModule";
import { sectionIcons } from "@/lib/navigation";
import { usePrefs } from "@/lib/prefs";
import { WorkspaceTabs } from "@/components/WorkspaceTabs";
import { GlobalSearch } from "@/components/GlobalSearch";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useInstallApp } from "@/hooks/useInstallApp";

interface ApiNotification {
  id: string;
  type: string;
  message: string;
  time: string;
  read: boolean;
  /** Where clicking it goes (AMC alerts open the AMC page). */
  url?: string;
  urgent?: boolean;
}

/** What /admin/notifications sends. */
interface RawNotification {
  id: string | number;
  type: string;
  title?: string;
  message: string;
  is_read?: boolean;
  created_at: string;
  url?: string;
  severity?: string;
}

const toNotification = (n: RawNotification): ApiNotification => ({
  id: String(n.id), type: n.type, message: n.message, time: n.created_at, read: !!n.is_read, url: n.url, urgent: n.severity === "urgent",
});

function initialsOf(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/[\s@.]+/).filter(Boolean);
  return (parts.map((p) => p[0]).join("").slice(0, 2) || "?").toUpperCase();
}

function timeAgo(dateString: string) {
  const diff = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? "s" : ""} ago`;
  return `${Math.floor(hrs / 24)} days ago`;
}

export function TopNavbar() {
  const { adminEmail, userName, role, logout } = useAuth();
  const { setModulesDialogOpen } = useDashboardLayout();
  const { canInstall, install } = useInstallApp();
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const navigate = useNavigate();
  const path = useLocation().pathname;
  const isSettings = path.startsWith("/settings");

  // The module launcher wears the module you are in. Same source as the rail's
  // heading, so the two can never name different modules.
  const activeModule = useActiveModule();
  const moduleLabel = activeModule?.label ?? "All Modules";
  const ModuleIcon = sectionIcons[moduleLabel] ?? LayoutGrid;
  // With every module in the sidebar there is nothing to switch, so the header says nothing.
  const allModules = usePrefs().sidebarAllModules;

  // Keep the icon in sync with the browser's fullscreen state — including when
  // the user presses Esc to exit (no click), which still fires the event.
  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn("Fullscreen request failed:", err);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const fetchNotifications = () => {
      apiFetch<{ data: RawNotification[] }>("/admin/notifications")
        .then((res) => {
          const list = (res.data ?? []).map(toNotification);
          setNotifications(list);
          setUnreadCount(list.filter((n) => !n.read).length);
        })
        .catch(() => {});
    };
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  const markAllRead = () => { setNotifications(notifications.map((n) => ({ ...n, read: true }))); setUnreadCount(0); };

  return (
    <header className="shrink-0 border-b bg-card shadow-sm">
      {/* A brand wash fading left to right, so the bar is tied to the rail it
          sits beside instead of reading as one more sheet of white. It stays
          under 10% so the controls on top keep full contrast. */}
      <div className="flex h-14 items-center justify-between gap-2 bg-gradient-to-r from-primary/[0.09] via-primary/[0.03] to-transparent px-3 md:px-6">
        <div className="flex min-w-0 items-center gap-2 md:gap-3">
          <SidebarTrigger className="shrink-0 lg:hidden" />
          {/* One module at a time (Settings → Sidebar): the switch names the module you are in. */}
          {!allModules && (
            <button
              type="button"
              onClick={() => setModulesDialogOpen(true)}
              aria-haspopup="dialog"
              title={`Switch module — currently ${moduleLabel}`}
              aria-label={`Switch module — currently ${moduleLabel}`}
              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium text-card-foreground shadow-sm transition-colors hover:bg-muted"
            >
              <ModuleIcon className="h-5 w-5 text-primary" />
              <span className="hidden max-w-32 truncate md:block">{moduleLabel}</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Search takes the middle and grows into it. Pinned to the right beside
            the icons it was a token control on a bar that was mostly empty, and
            too narrow to hint at what it searches. */}
        <div className="hidden flex-1 justify-center px-2 sm:flex md:px-4">
          <div className="w-full max-w-xl">
            <GlobalSearch />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 md:gap-2">
          {/* Narrow screens have no room for the middle column, so the search
              travels here as an icon rather than disappearing. */}
          <div className="sm:hidden">
            <GlobalSearch compact />
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <button className="relative rounded-lg p-2 transition-colors hover:bg-muted">
                <Bell className="h-5 w-5 text-muted-foreground" />
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                    {unreadCount}
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h4 className="text-sm font-semibold text-card-foreground">Notifications</h4>
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllRead}>
                    Mark all as read
                  </Button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 && (
                  <div className="py-8 text-center text-sm text-muted-foreground">No notifications</div>
                )}
                {notifications.map((n) => {
                  const amc = n.type === "amc";
                  const Icon = amc ? RefreshCcw : n.type === "order" ? ShoppingCart : MessageSquare;
                  const body = <>
                    <div className="pt-0.5">
                      <Icon className={cn("h-4 w-4", amc ? (n.urgent ? "text-red-600" : "text-amber-600") : n.type === "order" ? "text-primary" : "text-blue-500")} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug text-card-foreground">{n.message}</p>
                      {/* An AMC alert says when it is due in its own text. */}
                      {!amc && <p className="mt-0.5 text-xs text-muted-foreground">{timeAgo(n.time)}</p>}
                    </div>
                    {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                  </>;
                  const rowClass = cn(
                    "flex items-start gap-3 border-b px-4 py-3 transition-colors last:border-0",
                    !n.read && "bg-muted/30",
                    n.url && "hover:bg-muted/50",
                  );
                  return n.url
                    ? <Link key={n.id} to={n.url} className={rowClass}>{body}</Link>
                    : <div key={n.id} className={rowClass}>{body}</div>;
                })}
              </div>
            </PopoverContent>
          </Popover>

          {/* Settings sits with the utilities, not in the rail. It is one page
              that belongs to no module, and pinned to the bottom of the sidebar
              it was taking a permanent slot from the modules. */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/settings"
                aria-label="Settings"
                className={cn(
                  "rounded-lg p-2 transition-colors hover:bg-muted",
                  // The open page gets the brand, the same signal the rail gives
                  // its active item — otherwise this is the one destination in
                  // the app with no way of telling you that you are on it.
                  isSettings ? "bg-primary/10 text-primary" : "text-muted-foreground",
                )}
              >
                <Settings className="h-5 w-5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="bottom">Settings</TooltipContent>
          </Tooltip>

          {/* Install, while the browser offers it after Settings, as in Diamond Fencing's header. */}
          {canInstall && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => void install().then((ok) => { if (ok) toast.success("Kynetropo is installed — find it in the Start menu or on the home screen"); })}
                  aria-label="Install Kynetropo on this device"
                  className="rounded-lg p-2 transition-colors hover:bg-muted"
                >
                  <MonitorDown className="h-5 w-5 text-muted-foreground" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Install Kynetropo on this device</TooltipContent>
            </Tooltip>
          )}

          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            className="rounded-lg p-2 transition-colors hover:bg-muted"
          >
            {isFullscreen ? (
              <Minimize2 className="h-5 w-5 text-muted-foreground" />
            ) : (
              <Maximize2 className="h-5 w-5 text-muted-foreground" />
            )}
          </button>

          <div className="hidden h-6 w-px shrink-0 bg-border md:block" />

          {/*
            Avatar only in the bar — the address was the widest thing in it and
            told you something you already know. Clicking gives the account
            panel: who you are, which address, what role, and the way out.

            Signing out lives here rather than on Settings. It is not a setting,
            and burying the way out of the app three screens deep is the one
            place nobody thinks to look.
          */}
          {/* The account menu: who you are, your profile, and the way out. */}
          <Popover open={accountOpen} onOpenChange={setAccountOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={adminEmail ? `Account — signed in as ${adminEmail}` : "Account"}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold uppercase text-primary-foreground transition-opacity hover:opacity-90"
              >
                {initialsOf(userName || adminEmail)}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-0">
              <div className="border-b p-3">
                <p className="truncate text-sm font-medium text-card-foreground">{userName || "Signed in"}</p>
                {/* break-all: an address longer than the panel would otherwise push it wider. */}
                {adminEmail && <p className="mt-0.5 break-all text-xs text-muted-foreground">{adminEmail}</p>}
                {role && (
                  <span className="mt-2 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium capitalize text-primary">
                    {role}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => { setAccountOpen(false); navigate("/settings"); }}
                className="flex w-full items-center gap-2 border-b px-3 py-2.5 text-sm text-card-foreground transition-colors hover:bg-muted"
              >
                <UserRound className="h-4 w-4 text-muted-foreground" /> My profile
              </button>
              <button
                type="button"
                onClick={() => { setAccountOpen(false); logout(); }}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-destructive transition-colors hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <WorkspaceTabs />
    </header>
  );
}
