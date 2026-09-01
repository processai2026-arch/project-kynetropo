import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Bug,
  CalendarDays,
  CalendarClock,
  ClipboardList,
  IndianRupee,
  RefreshCcw,
  Megaphone,
  Target,
  Trophy,
  History,
  ShieldCheck,
  UserCog,
  Settings,
  FileText,
  Phone,
  MoreHorizontal,
} from "lucide-react";

export type MenuItem = { title: string; url: string; icon: typeof LayoutDashboard };
export type MenuSection = { label: string; items: MenuItem[] };

export const sections: MenuSection[] = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", url: "/", icon: LayoutDashboard }],
  },
  {
    label: "CRM",
    items: [
      { title: "Clients",  url: "/clients",  icon: Users },
      { title: "Projects", url: "/projects", icon: FolderKanban },
    ],
  },
  {
    // Desktop keeps the existing sidebar pattern; the mobile bottom tabs are a
    // separate, sales-only navigation (see components/sales/SalesLayout.tsx).
    label: "Sales",
    items: [
      { title: "Sales Dashboard", url: "/sales",                icon: Target },
      { title: "Leads",           url: "/sales/leads",          icon: Users },
      { title: "Follow-Ups",      url: "/sales/followups",      icon: CalendarClock },
      { title: "Sales Meetings",  url: "/sales/meetings",       icon: CalendarDays },
      { title: "Call History",    url: "/sales/calls",          icon: Phone },
      { title: "Tasks",           url: "/sales/tasks",          icon: ClipboardList },
      { title: "Challenges",      url: "/sales/challenges",     icon: Trophy },
      { title: "Team Activity",   url: "/sales/activity",       icon: History },
      { title: "Access Control",  url: "/sales/access-control", icon: ShieldCheck },
    ],
  },
  {
    label: "Delivery",
    items: [
      { title: "Bug Tracker", url: "/bugs",     icon: Bug },
      { title: "Meetings",    url: "/meetings", icon: CalendarDays },
    ],
  },
  {
    label: "Finance",
    items: [
      { title: "Finance", url: "/finance", icon: IndianRupee },
      { title: "AMC",     url: "/amc",     icon: RefreshCcw },
    ],
  },
  {
    label: "Growth",
    items: [
      { title: "Pitches & Marketing", url: "/pitches",   icon: Megaphone },
    ],
  },
  {
    label: "Team",
    items: [
      { title: "Hiring",    url: "/hiring",    icon: UserCog },
      { title: "Employees", url: "/employees", icon: Users },
    ],
  },
  {
    label: "System",
    items: [
      { title: "Settings", url: "/settings", icon: Settings },
    ],
  },
];

/**
 * Routes with no sidebar entry of their own — detail pages, and the two
 * settings-shaped pages reachable only from the header. The tab strip has to be
 * able to name and draw every page, not only the ones on a menu.
 */
const EXTRA_ROUTE_TITLES: Record<string, string> = {
  "/user-management": "User Management",
  "/sales/more": "More",
};

const EXTRA_ROUTE_ICONS: Record<string, MenuItem["icon"]> = {
  "/user-management": UserCog,
  "/sales/more": MoreHorizontal,
};

/** Strip one trailing slash, so "/clients/" and "/clients" answer the same. */
function normalise(pathname: string): string {
  return pathname !== "/" && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

/** Turn a URL slug into something readable, as a last resort. */
function titleCaseSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * What to call a route in the workspace tab strip.
 *
 * The sidebar is the authority wherever it has an entry, so a tab and its menu
 * item can never disagree about a page's name. Record pages are named by their
 * id, so two open at once are told apart — "Lead 4" and "Lead 7" rather than
 * "Leads" twice.
 */
export function routeTitle(pathname: string): string {
  const path = normalise(pathname);

  for (const section of sections) {
    for (const item of section.items) {
      if (item.url === path) return item.title;
    }
  }
  if (EXTRA_ROUTE_TITLES[path]) return EXTRA_ROUTE_TITLES[path];

  const lead = path.match(/^\/sales\/leads\/(.+)$/);
  if (lead) return `Lead ${decodeURIComponent(lead[1])}`;
  const challenge = path.match(/^\/sales\/challenges\/(.+)$/);
  if (challenge) return `Challenge ${decodeURIComponent(challenge[1])}`;
  const client = path.match(/^\/clients\/(.+)$/);
  if (client) return `Client ${decodeURIComponent(client[1])}`;
  const project = path.match(/^\/projects\/(.+)$/);
  if (project) return `Project ${decodeURIComponent(project[1])}`;
  const bug = path.match(/^\/bugs\/(.+)$/);
  if (bug) return `Bug ${decodeURIComponent(bug[1])}`;
  const pitch = path.match(/^\/pitches\/(.+)$/);
  if (pitch) return `Pitch ${decodeURIComponent(pitch[1])}`;

  const last = path.split("/").filter(Boolean).pop();
  return last ? titleCaseSlug(last) : "Dashboard";
}

/**
 * The glyph for a route, so a tab is recognised by shape before its label is
 * read — which is what makes a long strip scannable rather than a wall of
 * similar-length words.
 */
export function routeIcon(pathname: string): MenuItem["icon"] {
  const path = normalise(pathname);

  for (const section of sections) {
    for (const item of section.items) {
      if (item.url === path) return item.icon;
    }
  }
  if (EXTRA_ROUTE_ICONS[path]) return EXTRA_ROUTE_ICONS[path];

  if (/^\/sales\/leads\//.test(path)) return Users;
  if (/^\/sales\/challenges\//.test(path)) return Trophy;
  if (/^\/clients\//.test(path)) return Users;
  if (/^\/projects\//.test(path)) return FolderKanban;
  if (/^\/bugs\//.test(path)) return Bug;
  if (/^\/pitches\//.test(path)) return Megaphone;
  return FileText;
}

export function findSectionByPath(pathname: string): MenuSection | null {
  for (const section of sections) {
    for (const item of section.items) {
      if (item.url === pathname) return section;
    }
  }
  return null;
}

/**
 * The module a route belongs to.
 *
 * `findSectionByPath` matches a URL exactly, which leaves every record route —
 * `/clients/4`, `/sales/leads/7` — belonging to no module at all. That was
 * invisible while the answer only chose which list the sidebar showed. It stops
 * being invisible now the header states the module by name: opening a lead
 * would otherwise announce whichever module you happened to be in before.
 *
 * Longest prefix wins, so `/sales/leads/7` is answered by the Leads entry
 * rather than the Sales dashboard above it.
 */
export function routeSection(pathname: string): MenuSection | null {
  const path = normalise(pathname);

  const exact = findSectionByPath(path);
  if (exact) return exact;

  let best: MenuSection | null = null;
  let bestLen = 0;
  for (const section of sections) {
    for (const item of section.items) {
      // "/" is a prefix of every path, so it can never be a prefix match — it
      // would make the Dashboard's module the answer for the whole app.
      if (item.url === "/") continue;
      if (path.startsWith(item.url + "/") && item.url.length > bestLen) {
        best = section;
        bestLen = item.url.length;
      }
    }
  }
  return best;
}

/**
 * A representative glyph per module — sections carry no icon of their own.
 *
 * Lives here rather than in the launcher because the header shows the module
 * you are in with the same glyph the launcher lists it under. Two copies of
 * this map would let those two drift apart.
 */
export const sectionIcons: Record<string, MenuItem["icon"]> = {
  Overview: LayoutDashboard,
  CRM: Users,
  Sales: Target,
  Delivery: Bug,
  Finance: IndianRupee,
  Growth: Megaphone,
  Team: UserCog,
  System: Settings,
};

export function getDefaultSection(): MenuSection {
  return sections[1];
}

export const ACTIVE_MODULE_STORAGE_KEY = "erp_active_module_section";

const LEGACY_SECTION_LABELS: Record<string, string> = {};

export function resolveStoredSection(stored: string): MenuSection | undefined {
  const label = LEGACY_SECTION_LABELS[stored] ?? stored;
  return sections.find((s) => s.label === label);
}
