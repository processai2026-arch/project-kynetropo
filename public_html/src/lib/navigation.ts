import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Bug,
  CalendarDays,
  CalendarClock,
  IndianRupee,
  RefreshCcw,
  Megaphone,
  Target,
  Trophy,
  History,
  ShieldCheck,
  UserCog,
  Settings,
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
      { title: "Challenges",      url: "/sales/challenges",     icon: Trophy },
      { title: "Sales Activity",  url: "/sales/activity",       icon: History },
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

export function findSectionByPath(pathname: string): MenuSection | null {
  for (const section of sections) {
    for (const item of section.items) {
      if (item.url === pathname) return section;
    }
  }
  return null;
}

export function getDefaultSection(): MenuSection {
  return sections[1];
}

export const ACTIVE_MODULE_STORAGE_KEY = "erp_active_module_section";

const LEGACY_SECTION_LABELS: Record<string, string> = {};

export function resolveStoredSection(stored: string): MenuSection | undefined {
  const label = LEGACY_SECTION_LABELS[stored] ?? stored;
  return sections.find((s) => s.label === label);
}
