// Headset, not LifeBuoy: the ring-and-spokes life ring reads as a wheel or a
// target at 20px, which is not "talk to someone".
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Bell, ChevronDown, LayoutGrid, LogOut, Maximize2, MessageSquare,
  Minimize2, Settings, ShoppingCart,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api/client";
import { useDashboardLayout } from "@/hooks/useDashboardLayout";
import { useActiveModule } from "@/hooks/useActiveModule";
import { sectionIcons } from "@/lib/navigation";
import { ACCENTS, MODULE } from "@/lib/accents";
import { WorkspaceTabs } from "@/components/WorkspaceTabs";
import { GlobalSearch } from "@/components/GlobalSearch";
import { cn } from "@/lib/utils";

interface ApiNotification {
  id: string;
  type: string;
  message: string;
  time: string;
  read: boolean;
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
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const path = useLocation().pathname;
  const isSettings = path.startsWith("/settings");

  // The module launcher wears the module you are in. Same source as the rail's
  // heading, so the two can never name different modules.
  const activeModule = useActiveModule();
  const moduleLabel = activeModule?.label ?? "All Modules";
  const ModuleIcon = sectionIcons[moduleLabel] ?? LayoutGrid;
  const moduleAccent = ACCENTS[MODULE[moduleLabel] ?? "slate"];

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
      apiFetch<{ data: ApiNotification[] }>("/admin/notifications")
        .then((res) => {
          setNotifications(res.data ?? []);
          setUnreadCount((res.data ?? []).filter((n) => !n.read).length);
        })
        .catch(() => {});
    };
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  const markAllRead = () => setNotifications(notifications.map((n) => ({ ...n, read: true })));

  return (
    <header className="shrink-0 border-b bg-card shadow-sm">
      {/* A brand wash fading left to right, so the bar is tied to the rail it
          sits beside instead of reading as one more sheet of white. It stays
          under 10% so the controls on top keep full contrast. */}
      <div className="flex h-14 items-center justify-between gap-2 bg-gradient-to-r from-primary/[0.09] via-primary/[0.03] to-transparent px-3 md:px-6">
        <div className="flex min-w-0 items-center gap-2 md:gap-3">

          {/*
            The launcher says which module you are in and opens the picker. It
            was a bare four-dot grid in the rail: a control that told you nothing
            about where you were, next to a heading that was the one place that
            did. Naming it here turns "open the module list" into "switch
            module", which is what people are actually doing when they click it.
          */}
          <button
            type="button"
            onClick={() => setModulesDialogOpen(true)}
            aria-haspopup="dialog"
            aria-label={`Module: ${moduleLabel}. Switch module`}
            title="Switch module"
            className="flex shrink-0 items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition-colors hover:bg-muted"
          >
            <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", moduleAccent.tile)}>
              <ModuleIcon className={cn("h-[18px] w-[18px]", moduleAccent.icon)} />
            </span>
            {/* Hidden on the narrowest screens, where the header is already
                carrying the rail trigger, search and the utilities — the tinted
                glyph and caret still read as the same control. */}
            <span className="hidden max-w-[10rem] truncate text-sm font-semibold text-foreground md:block">
              {moduleLabel}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
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
                  const Icon = n.type === "order" ? ShoppingCart : MessageSquare;
                  return (
                    <div
                      key={n.id}
                      className={cn(
                        "flex items-start gap-3 border-b px-4 py-3 transition-colors last:border-0",
                        !n.read && "bg-muted/30",
                      )}
                    >
                      <div className="pt-0.5">
                        <Icon className={cn("h-4 w-4", n.type === "order" ? "text-primary" : "text-blue-500")} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-snug text-card-foreground">{n.message}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{timeAgo(n.time)}</p>
                      </div>
                      {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                    </div>
                  );
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
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={adminEmail ? `Account — signed in as ${adminEmail}` : "Account"}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold uppercase text-primary-foreground transition-opacity hover:opacity-90"
              >
                {(userName || adminEmail || "?").charAt(0)}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-0">
              <div className="space-y-1 p-4">
                <p className="text-sm font-semibold text-card-foreground">{userName || "Account"}</p>
                {/* break-all: an address longer than the panel would otherwise
                    push it wider than the button it hangs off. */}
                <p className="break-all text-xs text-muted-foreground">
                  {adminEmail || "No address on this account"}
                </p>
                {role && (
                  <span className="mt-1 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium capitalize text-primary">
                    {role}
                  </span>
                )}
              </div>
              <div className="border-t p-1">
                <button
                  type="button"
                  onClick={logout}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <WorkspaceTabs />
    </header>
  );
}
