import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import * as HoverCardPrimitive from "@radix-ui/react-hover-card";
import { ChevronDown, Home } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useActiveModule } from "@/hooks/useActiveModule";
import { BrandLogo } from "@/components/BrandLogo";
import { activeItemUrl, routeSection, sectionIcons, sections, type MenuItem } from "@/lib/navigation";
import { usePrefs } from "@/lib/prefs";
import { cn } from "@/lib/utils";

/*
 * The rail, as Diamond Fencing and Eco Sudar draw it (UI-STANDARDS §3).
 *
 * Settings → Sidebar picks the shape: every module in one list, each opening
 * to its pages (the default), or one module at a time, switched from the
 * header. Settings itself lives in the header, so it is no module here.
 */

// Overrides shadcn's faint active tint with the intended active chip. Passed as
// `className` so tailwind-merge resolves the conflicting data-[active=true]
// utilities in our favour.
const ACTIVE_ITEM_OVERRIDE = [
  "data-[active=true]:bg-sidebar-primary",
  "data-[active=true]:text-sidebar-primary-foreground",
  "data-[active=true]:hover:bg-sidebar-primary",
  "data-[active=true]:hover:text-sidebar-primary-foreground",
  "data-[active=true]:[&>svg]:text-sidebar-primary-icon",
  "data-[active=true]:font-semibold",
].join(" ");

// The same colouring for NavLink's own activeClassName — both style one element.
const ACTIVE_LINK = [
  "bg-sidebar-primary",
  "text-sidebar-primary-foreground",
  "font-semibold",
  "hover:bg-sidebar-primary",
  "[&>svg]:text-sidebar-primary-icon",
].join(" ");

const IDLE_LINK =
  "flex items-center gap-3 px-3 py-2.5 rounded-nav font-semibold text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors";

// Collapsed, the rail is a NARROW MENU — glyph on top, name underneath — not an
// icon strip. Scoped to `group-data-[collapsible=icon]:` so expanded is untouched.
const COLLAPSED_ICON_CELL = [
  "group-data-[collapsible=icon]:!h-auto",
  "group-data-[collapsible=icon]:!w-full",
  "group-data-[collapsible=icon]:!min-w-0",
  "group-data-[collapsible=icon]:!max-w-full",
  "group-data-[collapsible=icon]:!flex-col",
  "group-data-[collapsible=icon]:!items-center",
  "group-data-[collapsible=icon]:!justify-center",
  "group-data-[collapsible=icon]:!gap-1",
  "group-data-[collapsible=icon]:!px-1",
  "group-data-[collapsible=icon]:!py-2",
  "group-data-[collapsible=icon]:shrink-0",
  "group-data-[collapsible=icon]:rounded-nav",
  "group-data-[collapsible=icon]:[&>svg]:!size-5",
  "group-data-[collapsible=icon]:[&>svg]:shrink-0",
  "group-data-[collapsible=icon]:[&>span:last-child]:!whitespace-normal",
].join(" ");

const COLLAPSED_LABEL = [
  "flex-1",
  "group-data-[collapsible=icon]:flex-none",
  "group-data-[collapsible=icon]:w-full",
  "group-data-[collapsible=icon]:text-center",
  "group-data-[collapsible=icon]:text-[10px]",
  "group-data-[collapsible=icon]:leading-tight",
  "group-data-[collapsible=icon]:line-clamp-1",
].join(" ");

const COLLAPSED_GROUP_PAD = "group-data-[collapsible=icon]:px-1";

// In the all-modules sidebar a page sits under its module, so it must not look like one:
// smaller text and glyph, lighter weight, hung on the module's guide line.
const SUB_LINK =
  "flex items-center gap-2.5 px-3 py-2 rounded-nav text-sm font-medium text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors";

/** What a page is called on the rail, where its module already names it. */
const SHORT_TITLES: Record<string, string> = {
  "Sales Dashboard": "Dashboard",
  "Sales Meetings": "Meetings",
  "Call History": "Calls",
  "Team Activity": "Activity",
  "Access Control": "Access",
  "Pitches & Marketing": "Pitches",
  "Bug Tracker": "Bugs",
};

const NOT_MODULES = new Set(["Overview", "System"]);

export function AppSidebar() {
  const { state, toggleSidebar, isMobile, setOpenMobile } = useSidebar();
  const allModules = usePrefs().sidebarAllModules;
  const collapsed = state === "collapsed";
  const location = useLocation();
  // Route, then last-used, then CRM — the rule lives in the hook, because the
  // header names this same module and the two must not answer separately.
  const activeSection = useActiveModule();
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  // Collapsed rail: the module whose pages are showing beside it on hover.
  const [flyout, setFlyout] = useState<string | null>(null);

  const handleNavClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  const modules = useMemo(() => sections.filter((m) => !NOT_MODULES.has(m.label)), []);
  const here = routeSection(location.pathname)?.label ?? null;
  const isOpen = (label: string) => opened[label] ?? label === here;
  // One module open at a time: opening one closes the rest.
  const openOnly = (label: string | null) => setOpened(Object.fromEntries(modules.map((x) => [x.label, x.label === label])));
  // Reaching a page of another module opens that module and closes the others.
  useEffect(() => { setOpened({}); }, [here]);
  // The page you are on stays in sight: on arrival, and when the window changes size.
  useEffect(() => {
    const show = () => document.querySelector<HTMLElement>('[data-sidebar="content"] [data-active="true"]')?.scrollIntoView({ block: "nearest" });
    const t = window.setTimeout(show, 150);
    let r = 0;
    const resized = () => { window.clearTimeout(r); r = window.setTimeout(show, 200); };
    window.addEventListener("resize", resized);
    return () => { window.clearTimeout(t); window.clearTimeout(r); window.removeEventListener("resize", resized); };
  }, [location.pathname]);
  // A module opened near the bottom would open below the screen's edge: bring its pages into view.
  const reveal = useRef<string | null>(null);
  useEffect(() => {
    const label = reveal.current;
    if (!label) return;
    reveal.current = null;
    const el = [...document.querySelectorAll<HTMLElement>("[data-module]")].find((e) => e.dataset.module === label);
    requestAnimationFrame(() => el?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  }, [opened]);

  const pageLink = (item: MenuItem, active: string | null, cls: string, iconCls: string) => (
    <SidebarMenuItem key={item.url}>
      <SidebarMenuButton asChild isActive={item.url === active} className={`${ACTIVE_ITEM_OVERRIDE} ${COLLAPSED_ICON_CELL}`}>
        <NavLink to={item.url} end onClick={handleNavClick} className={cls} activeClassName={ACTIVE_LINK} title={collapsed ? item.title : undefined}>
          <item.icon className={iconCls} />
          <span className={COLLAPSED_LABEL}>{collapsed ? SHORT_TITLES[item.title] ?? item.title : item.title}</span>
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  /**
   * Every module in one stretch. A module is a line you press to open its
   * pages; the one you are in opens itself. Collapsed to the rail, a module is
   * its glyph — resting the mouse on it shows its pages beside the rail, and
   * pressing it opens the sidebar on that module.
   */
  const moduleList = modules.map((m) => {
    const open = isOpen(m.label);
    const active = activeItemUrl(location.pathname, m.items);
    const Icon = sectionIcons[m.label] ?? m.items[0]?.icon;
    const press = () => {
      if (collapsed) { setFlyout(null); toggleSidebar(); reveal.current = m.label; openOnly(m.label); return; }
      if (!open) reveal.current = m.label;
      openOnly(open ? null : m.label);
    };
    const railFlyout = collapsed && !isMobile;
    const moduleButton = (
      <button type="button" onClick={press} aria-expanded={collapsed ? undefined : open} aria-haspopup={railFlyout ? "menu" : undefined}
        className={cn(
          "flex w-full items-center gap-3 rounded-nav px-3 py-2.5 text-left text-[15px] font-bold text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          "group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-1 group-data-[collapsible=icon]:px-1 group-data-[collapsible=icon]:py-2",
          // Blue marks the module you have OPEN; on the rail, the one you are in and the one showing its pages.
          collapsed ? (m.label === here || flyout === m.label) && "bg-sidebar-accent text-sidebar-primary" : open && "text-sidebar-primary",
        )}>
        {Icon && (
          <span className="hidden h-8 w-8 shrink-0 place-items-center group-data-[collapsible=icon]:grid">
            <Icon className="h-[18px] w-[18px]" />
          </span>
        )}
        <span className={COLLAPSED_LABEL}>{m.label}</span>
        <ChevronDown aria-hidden className={cn("ml-auto h-4 w-4 shrink-0 text-sidebar-muted transition-transform group-data-[collapsible=icon]:hidden", open && "rotate-180")} />
      </button>
    );
    return (
      <SidebarGroup key={m.label} data-module={m.label} className={`${COLLAPSED_GROUP_PAD} py-0`}>
        {railFlyout ? (
          <HoverCardPrimitive.Root open={flyout === m.label} onOpenChange={(o) => setFlyout(o ? m.label : (f) => (f === m.label ? null : f))} openDelay={60} closeDelay={120}>
            <HoverCardPrimitive.Trigger asChild>{moduleButton}</HoverCardPrimitive.Trigger>
            {/* Portalled: the rail clips anything that pokes out of it. */}
            <HoverCardPrimitive.Portal>
              <HoverCardPrimitive.Content side="right" align="start" sideOffset={10} collisionPadding={12}
                className="z-50 w-60 rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-lg outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[side=right]:slide-in-from-left-2">
                {/* Just the pages — the rail already names the module. */}
                <nav aria-label={m.label} className="flex flex-col gap-0.5">
                  {m.items.map((item) => (
                    <Link key={item.url} to={item.url} onClick={() => setFlyout(null)} aria-current={item.url === active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                        item.url === active ? "bg-sidebar-primary font-semibold text-sidebar-primary-foreground" : "text-foreground/80 hover:bg-muted hover:text-foreground",
                      )}>
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.title}</span>
                    </Link>
                  ))}
                </nav>
              </HoverCardPrimitive.Content>
            </HoverCardPrimitive.Portal>
          </HoverCardPrimitive.Root>
        ) : moduleButton}
        {open && !collapsed && (
          <SidebarGroupContent>
            <SidebarMenu className="mb-1 ml-4 mr-2 w-auto gap-0.5 border-l border-sidebar-border pl-2">
              {m.items.map((item) => pageLink(item, active, SUB_LINK, "h-4 w-4 shrink-0"))}
            </SidebarMenu>
          </SidebarGroupContent>
        )}
      </SidebarGroup>
    );
  });

  const section = !allModules && activeSection && !NOT_MODULES.has(activeSection.label) ? activeSection : null;
  const sectionActive = section ? activeItemUrl(location.pathname, section.items) : null;

  return (
    <Sidebar collapsible="icon" className="border-r-sidebar-border group-data-[collapsible=icon]:overflow-hidden">
      {/* h-14, level with the header beside it. Pressing the brand collapses or expands the rail. */}
      <button
        type="button"
        onClick={toggleSidebar}
        className="flex h-14 w-full shrink-0 items-center gap-2.5 px-3 text-left transition-colors hover:bg-sidebar-accent group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:overflow-hidden group-data-[collapsible=icon]:px-1"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed
          ? <BrandLogo className="h-5 w-full max-w-[72px]" fallbackClassName="text-xs" />
          : <BrandLogo className="h-6 max-w-[148px]" fallbackClassName="text-sm" />}
      </button>

      {/*
        The vendored SidebarContent sets overflow-hidden once collapsed, so a
        module list longer than the rail would be clipped with no way to reach
        the rest. overflow-y is forced back on; no scrollbar is drawn.
      */}
      <SidebarContent className="eco-noscrollbar group-data-[collapsible=icon]:!overflow-y-auto group-data-[collapsible=icon]:overscroll-contain">
        <SidebarGroup className={cn(COLLAPSED_GROUP_PAD, "pt-3")}>
          <SidebarGroupContent>
            <SidebarMenu>
              {pageLink({ title: "Dashboard", url: "/", icon: Home }, location.pathname === "/" ? "/" : null, IDLE_LINK, "h-5 w-5 shrink-0")}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {allModules && (
          <>
            <div className="mx-3 my-2 h-px bg-sidebar-border" />
            {moduleList}
          </>
        )}

        {section && (
          <>
            <div className="mx-3 my-2 h-px bg-sidebar-border" />
            <SidebarGroup className={COLLAPSED_GROUP_PAD}>
              {!collapsed && (
                <SidebarGroupLabel className="px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted">
                  {section.label}
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map((item) => pageLink(item, sectionActive, IDLE_LINK, "h-5 w-5 shrink-0"))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
