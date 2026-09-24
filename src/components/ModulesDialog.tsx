import { useEffect, useMemo, useRef, useState } from "react";
import { sections, ACTIVE_MODULE_STORAGE_KEY } from "@/lib/navigation";
import type { MenuItem, MenuSection } from "@/lib/navigation";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Search,
  ChevronRight,
  LayoutDashboard,
  Users,
  FolderKanban,
  Bug,
  CalendarDays,
  IndianRupee,
  RefreshCcw,
  Megaphone,
  Target,
  UserCog,
  Settings,
  // Last-resort fallback icon — referenced below when a section has neither a
  // mapped icon nor any items. It was used without being imported.
  Cpu,
} from "lucide-react";

interface ModulesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const sectionIcons: Record<string, typeof LayoutDashboard> = {
  Overview:  LayoutDashboard,
  CRM:       Users,
  Sales:     Target,
  Delivery:  Bug,
  Finance:   IndianRupee,
  Growth:    Megaphone,
  Team:      UserCog,
  System:    Settings,
};

const moduleDescriptions: Record<string, string> = {
  "/":         "Today's actions, money overview, project health, AI recommendations",
  "/clients":  "CRM pipeline — track every client from first meetup to closure",
  "/projects": "All active projects with health, stage, financials and blockers",
  "/sales":                "Today's follow-ups, meetings, hot leads and active sales challenges",
  "/sales/leads":          "Lead pipeline — hot, warm and cold, with calls and follow-ups",
  "/sales/followups":      "Today, overdue and upcoming follow-ups — the daily action queue",
  "/sales/meetings":       "Sales meetings — physical and virtual, with outcomes",
  "/sales/challenges":     "Challenge Accepted — accept, complete before the deadline, or expire",
  "/sales/activity":       "Chronological sales activity across every lead",
  "/sales/access-control": "Grant sales permissions per user (administrators only)",
  "/bugs":     "Bug tracker — report, assign and track issues per project",
  "/meetings": "Schedule and log client meetings with outcomes and follow-ups",
  "/finance":  "Payments received, expenses, and P&L by project and month",
  "/amc":      "AMC renewals — upcoming, overdue and payment tracking",
  "/pitches":  "Pitch events and marketing ROI — leads generated and converted",
  "/hiring":   "Candidate evaluation pipeline with scoring and selection workflow",
  "/employees":"Team roster — roles, access levels and assignments",
  "/settings": "System configuration and access control",
};

type SearchResult =
  | { kind: "module"; section: MenuSection }
  | { kind: "item"; item: MenuItem; parent: MenuSection };

export function ModulesDialog({ open, onOpenChange }: ModulesDialogProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const rowRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const displaySections = sections.filter((s) => s.label !== "Overview");

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveLabel(displaySections[0]?.label ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleItemClick = (url: string, sectionLabel: string) => {
    localStorage.setItem(ACTIVE_MODULE_STORAGE_KEY, sectionLabel);
    navigate(url);
    onOpenChange(false);
  };

  const activeSection =
    displaySections.find((s) => s.label === activeLabel) ?? displaySections[0];

  const onRowKeyDown = (e: React.KeyboardEvent, idx: number, section: MenuSection) => {
    let next = -1;
    if (e.key === "ArrowDown") next = Math.min(idx + 1, displaySections.length - 1);
    else if (e.key === "ArrowUp") next = Math.max(idx - 1, 0);
    else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (section.items[0]) handleItemClick(section.items[0].url, section.label);
      return;
    }
    if (next >= 0) {
      e.preventDefault();
      rowRefs.current[next]?.focus();
      setActiveLabel(displaySections[next].label);
    }
  };

  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: SearchResult[] = [];
    for (const section of displaySections) {
      if (section.label.toLowerCase().includes(q)) out.push({ kind: "module", section });
    }
    for (const section of displaySections) {
      for (const item of section.items) {
        if (item.title.toLowerCase().includes(q)) out.push({ kind: "item", item, parent: section });
      }
    }
    return out;
  }, [query, displaySections]);

  const searching = query.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Select a module</DialogTitle>
          <DialogDescription>Choose an area to load in the sidebar</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search modules and areas…"
            className="pl-9"
            autoFocus
          />
        </div>

        {searching ? (
          <div className="flex-1 min-h-0 overflow-y-auto py-2 space-y-0.5 eco-float-scroll">
            {results.map((r) => {
              const isModule = r.kind === "module";
              const section = isModule ? r.section : r.parent;
              const Icon = isModule
                ? (sectionIcons[section.label] ?? section.items[0]?.icon ?? Cpu)
                : r.item.icon;
              const label = isModule ? section.label : r.item.title;
              const url   = isModule ? section.items[0]?.url : r.item.url;
              return (
                <button
                  key={`${r.kind}-${label}-${url}`}
                  onClick={() => url && handleItemClick(url, section.label)}
                  title={!isModule ? (moduleDescriptions[r.item.url] ?? r.item.title) : undefined}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/30 transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className={`block text-sm truncate ${isModule ? "font-semibold text-primary" : "text-card-foreground"}`}>
                      {label}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {isModule
                        ? (moduleDescriptions[section.items[0]?.url ?? ""] ?? `${section.items.length} areas`)
                        : `in ${section.label}`}
                    </span>
                  </span>
                </button>
              );
            })}
            {results.length === 0 && (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                No matches for &ldquo;{query.trim()}&rdquo;
              </p>
            )}
          </div>
        ) : (
          <div className="flex-1 min-h-0 grid grid-cols-1 sm:grid-cols-[minmax(180px,1fr)_1.6fr] gap-4 py-4 overflow-hidden">
            <div className="space-y-1 overflow-y-auto min-h-0 pr-1 eco-float-scroll">
              {displaySections.map((section, idx) => {
                const Icon  = sectionIcons[section.label] ?? section.items[0]?.icon ?? Cpu;
                const count = section.items.length;
                const isActive = activeSection?.label === section.label;
                return (
                  <button
                    key={section.label}
                    ref={(el) => { rowRefs.current[idx] = el; }}
                    onMouseEnter={() => setActiveLabel(section.label)}
                    onFocus={() => setActiveLabel(section.label)}
                    onClick={() => {
                      const hasHover = window.matchMedia("(hover: hover)").matches;
                      if (hasHover || isActive) {
                        if (section.items[0]) handleItemClick(section.items[0].url, section.label);
                      } else {
                        setActiveLabel(section.label);
                      }
                    }}
                    onKeyDown={(e) => onRowKeyDown(e, idx, section)}
                    aria-current={isActive ? "true" : undefined}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 border-[0.5px] ${
                      isActive
                        ? "bg-primary/10 border-primary/30"
                        : "border-transparent hover:bg-muted/40"
                    }`}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-card-foreground truncate">{section.label}</span>
                      <span className="block text-xs text-muted-foreground">{count} {count === 1 ? "area" : "areas"}</span>
                    </span>
                    <ChevronRight className={`h-4 w-4 shrink-0 transition-colors ${isActive ? "text-primary" : "text-muted-foreground/40"}`} />
                  </button>
                );
              })}
            </div>

            <div className="rounded-xl border border-border bg-muted/20 p-3 overflow-y-auto min-h-0 eco-float-scroll">
              {activeSection && (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1 pb-2">
                    {activeSection.label}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {activeSection.items.map((item) => {
                      const ItemIcon = item.icon;
                      const desc = moduleDescriptions[item.url];
                      return (
                        <button
                          key={item.url}
                          onClick={() => handleItemClick(item.url, activeSection.label)}
                          title={desc ?? item.title}
                          className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-left bg-card hover:bg-muted/40 hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                        >
                          <ItemIcon className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-medium text-card-foreground truncate">{item.title}</span>
                            {desc && <span className="block text-xs text-muted-foreground leading-snug mt-0.5 line-clamp-2">{desc}</span>}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
