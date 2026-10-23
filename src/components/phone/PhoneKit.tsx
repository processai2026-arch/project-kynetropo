/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Search, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/*
 * The phone app's building blocks — the same design as Diamond Fencing's branch and staff
 * apps, laid out the way everyday apps (WhatsApp, YouTube) are: a coloured header on the main
 * screens, a coloured bar with a back arrow on the rest, plain full-width lists, filter chips,
 * a round search box, one big button for the main job, and buttons fixed at the bottom.
 *
 * Used by the Sales app on a phone (what installs to the home screen). On a computer the same
 * pages keep the ERP layout.
 */

/** The phone app's main screens: the ones with the tabs at the bottom and the big header. */
export const PHONE_TABS = ["/sales", "/sales/leads", "/sales/followups", "/sales/tasks", "/sales/more"] as const;
export const isPhoneTab = (pathname: string) => (PHONE_TABS as readonly string[]).includes(pathname.replace(/\/$/, "") || "/");

/** True for the Sales app on a phone: the phone layout instead of the ERP one. */
export function usePhoneApp(): boolean {
  const isMobile = useIsMobile();
  const { pathname } = useLocation();
  return isMobile && /^\/sales(\/|$)/.test(pathname);
}

/** Good morning / afternoon / evening, by the phone's clock. */
export const greeting = (d = new Date()) => d.getHours() < 12 ? "Good morning" : d.getHours() < 17 ? "Good afternoon" : "Good evening";

/** The bar on top of an inner screen: back arrow (a path, or -1 for the previous screen), title, buttons on the right. */
export function TopBar({ title, sub, back = -1, right }: { title: ReactNode; sub?: ReactNode; back?: string | number | null; right?: ReactNode }) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-20 -mx-4 -mt-4 mb-3 flex min-h-14 items-center gap-1 bg-primary px-2 pt-[env(safe-area-inset-top)] text-primary-foreground shadow-sm">
      {back !== null ? (
        <button type="button" aria-label="Back" onClick={() => (typeof back === "number" ? navigate(back) : navigate(back))}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:bg-white/20">
          <ArrowLeft className="h-6 w-6" />
        </button>
      ) : <span className="w-2" />}
      <div className="min-w-0 flex-1 py-2">
        <h1 className="truncate !text-lg !font-semibold !leading-tight !text-primary-foreground">{title}</h1>
        {sub ? <p className="truncate text-xs opacity-85">{sub}</p> : null}
      </div>
      {right ? <div className="flex shrink-0 items-center">{right}</div> : null}
    </header>
  );
}

/**
 * The big coloured top of a main (tab) screen: a small line, a large title, a chip, a circle
 * on the right, and room underneath for the screen's headline (the day's figures, a search box).
 */
export function HeroBar({ eyebrow, title, chip, right, children, className }: {
  eyebrow?: ReactNode; title: ReactNode; chip?: ReactNode; right?: ReactNode; children?: ReactNode; className?: string;
}) {
  return (
    <header className={cn("relative -mx-4 -mt-4 mb-1 overflow-hidden rounded-b-[28px] bg-gradient-to-b from-primary to-sky-600 px-5 pb-6 pt-[calc(env(safe-area-inset-top)+1.25rem)] text-primary-foreground shadow-[0_8px_24px_-12px_hsl(var(--primary)/0.7)] dark:to-sky-800", className)}>
      <span aria-hidden className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-white/10" />
      <span aria-hidden className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-white/[0.06]" />
      <div className="relative flex items-center gap-3">
        <div className="min-w-0 flex-1">
          {eyebrow ? <p className="truncate text-sm text-white/80">{eyebrow}</p> : null}
          <h1 className="truncate !text-2xl !font-bold !leading-tight tracking-tight !text-primary-foreground">{title}</h1>
          {chip ? <p className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium"><span className="truncate">{chip}</span></p> : null}
        </div>
        {right ? <div className="flex shrink-0 items-center gap-1">{right}</div> : null}
      </div>
      {children ? <div className="relative mt-5">{children}</div> : null}
    </header>
  );
}

const initials = (name?: string | null) =>
  (name ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

/** A person's first letters in a light ring, for the coloured header; a link when given one. */
export function HeroAvatar({ name, to }: { name?: string | null; to?: string }) {
  const cls = "flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-base font-semibold ring-2 ring-white/40";
  return to ? <Link to={to} aria-label="Me" className={cls}>{initials(name)}</Link> : <span className={cls}>{initials(name)}</span>;
}

/** A round icon button for a coloured bar. */
export function BarButton({ icon: Icon, label, onClick, to }: { icon: LucideIcon; label: string; onClick?: () => void; to?: string }) {
  const cls = "flex h-11 w-11 items-center justify-center rounded-full active:bg-white/20";
  return to
    ? <Link to={to} aria-label={label} title={label} className={cls}><Icon className="h-5 w-5" /></Link>
    : <button type="button" aria-label={label} title={label} onClick={onClick} className={cls}><Icon className="h-5 w-5" /></button>;
}

const TONE = {
  primary: "bg-primary/10 text-primary",
  success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  danger: "bg-destructive/10 text-destructive",
  muted: "bg-muted text-muted-foreground",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
  sky: "bg-sky-500/10 text-sky-600 dark:text-sky-300",
} as const;
export type Tone = keyof typeof TONE;
const PEOPLE: Tone[] = ["primary", "success", "violet", "sky", "warning"];

/** The circle at the start of a row: an icon, or a name's first letters in a colour of its own. */
export function Avatar({ name, icon: Icon, tone, size = "md" }: { name?: string | null; icon?: LucideIcon; tone?: Tone; size?: "md" | "lg" }) {
  const t = tone ?? PEOPLE[[...(name ?? "")].reduce((s, c) => s + c.charCodeAt(0), 0) % PEOPLE.length];
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-full font-semibold", TONE[t], size === "lg" ? "h-16 w-16 text-xl" : "h-11 w-11 text-sm")}>
      {Icon ? <Icon className={size === "lg" ? "h-7 w-7" : "h-5 w-5"} /> : initials(name)}
    </span>
  );
}

/** A full-width list, like a chat list. */
export function List({ title, right, children }: { title?: ReactNode; right?: ReactNode; children: ReactNode }) {
  return (
    <section>
      {title || right ? (
        <div className="flex items-center gap-2 px-1 pb-1.5 pt-1">
          <h2 className="flex-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
          {right}
        </div>
      ) : null}
      <div className="-mx-4 divide-y border-y bg-card">{children}</div>
    </section>
  );
}

/**
 * One row: the circle, the title with a small right-hand note (a date, an amount), and a
 * second line with a status at its end — the shape of a chat in WhatsApp.
 */
export function Row({ to, onClick, avatar, title, meta, sub, end }: {
  to?: string; onClick?: () => void; avatar?: ReactNode; title: ReactNode; meta?: ReactNode; sub?: ReactNode; end?: ReactNode;
}) {
  const body = (
    <>
      {avatar}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="min-w-0 flex-1 truncate font-medium text-foreground">{title}</p>
          {meta ? <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{meta}</span> : null}
        </div>
        {sub || end ? (
          <div className="mt-0.5 flex items-center gap-2">
            <div className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{sub}</div>
            {end ? <div className="shrink-0">{end}</div> : null}
          </div>
        ) : null}
      </div>
    </>
  );
  const cls = "flex min-h-[4.5rem] w-full items-center gap-3 px-4 py-3 text-left active:bg-muted/70";
  if (to) return <Link to={to} className={cls}>{body}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={cls}>{body}</button>;
  return <div className={cls}>{body}</div>;
}

/** A small coloured status label. */
export function Pill({ tone = "muted", icon: Icon, children }: { tone?: Tone; icon?: LucideIcon; children: ReactNode }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", TONE[tone])}>{Icon ? <Icon className="h-3 w-3" /> : null}{children}</span>;
}

/** A count in a coloured circle (unread-style). */
export function Count({ n }: { n: number }) {
  if (!n) return null;
  return <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">{n > 99 ? "99+" : n}</span>;
}

/** Filter chips under the header (All / Hot / Warm …). */
export function Chips<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number }[] }) {
  return (
    <div className="eco-noscrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-3" role="tablist">
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}
          className={cn("flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-medium",
            value === o.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
          {o.label}{o.count !== undefined ? <span className="opacity-75">{o.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

/** The round search box; `onHero` for the white one inside a coloured header. */
export function SearchBox({ value, onChange, placeholder = "Search", autoFocus, onHero }: {
  value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean; onHero?: boolean;
}) {
  return (
    <div className={cn("relative", onHero ? "" : "mb-3")}>
      <Search className={cn("pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2", onHero ? "text-primary" : "text-muted-foreground")} />
      <input type="search" autoFocus={autoFocus} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder}
        className={cn("h-12 w-full rounded-full border-0 pl-12 pr-11 text-base outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:appearance-none",
          onHero ? "bg-white text-foreground shadow-sm focus:ring-2 focus:ring-white/60" : "bg-muted focus:ring-2 focus:ring-primary/40")} />
      {value ? (
        <button type="button" aria-label="Clear search" onClick={() => onChange("")} className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground active:bg-background">
          <X className="h-5 w-5" />
        </button>
      ) : null}
    </div>
  );
}

/** The one big button for the screen's main job, bottom right (above the tabs on a main screen). */
export function Fab({ to, onClick, icon: Icon, label }: { to?: string; onClick?: () => void; icon: LucideIcon; label: string }) {
  const tab = isPhoneTab(useLocation().pathname);
  const cls = cn(
    "fixed right-4 z-30 flex h-14 items-center gap-2 rounded-2xl bg-primary px-5 text-base font-semibold text-primary-foreground shadow-lg active:brightness-95",
    tab ? "bottom-[calc(5rem+env(safe-area-inset-bottom))]" : "bottom-[calc(1.25rem+env(safe-area-inset-bottom))]",
  );
  return (
    <>
      {/* Room under the list so the button never covers the last row. */}
      <div className="h-20" aria-hidden />
      {to
        ? <Link to={to} className={cls}><Icon className="h-6 w-6" /> {label}</Link>
        : <button type="button" onClick={onClick} className={cls}><Icon className="h-6 w-6" /> {label}</button>}
    </>
  );
}

/** The screen's buttons, kept at the bottom while the page scrolls. */
export function ActionBar({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="h-24" aria-hidden />
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto max-w-2xl px-4">{children}</div>
      </div>
    </>
  );
}

/** A white card block with an optional heading — for detail screens. */
export function Block({ title, icon: Icon, right, children, className }: { title?: ReactNode; icon?: LucideIcon; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("overflow-hidden rounded-2xl border bg-card", className)}>
      {title ? (
        <div className="flex items-center gap-2 px-4 pb-1 pt-3">
          {Icon ? <Icon className="h-4 w-4 text-muted-foreground" /> : null}
          <h2 className="flex-1 text-sm font-semibold text-muted-foreground">{title}</h2>
          {right}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Loading() {
  return <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
}

/** Nothing to show: a big icon, one line, and maybe a button. */
export function Empty({ icon: Icon, text, action }: { icon: LucideIcon; text: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span className="flex h-20 w-20 items-center justify-center rounded-full bg-muted"><Icon className="h-10 w-10 text-muted-foreground" /></span>
      <p className="text-base text-muted-foreground">{text}</p>
      {action}
    </div>
  );
}

/** "12 Oct", "Yesterday", or the time for today — as chat lists show it. */
export function shortDate(v: string | null | undefined): string {
  if (!v) return "";
  const d = new Date(v.length === 10 ? `${v}T00:00:00` : v.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const timed = v.length > 10 && v.slice(11, 16) !== "00:00";
  if (d.toDateString() === now.toDateString()) return timed ? d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : "Today";
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  const t = new Date(now); t.setDate(now.getDate() + 1);
  if (d.toDateString() === t.toDateString()) return "Tomorrow";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", ...(d.getFullYear() !== now.getFullYear() ? { year: "2-digit" } : {}) });
}

/** Re-renders every minute, so "Today" and times stay right on a screen left open. */
export function useMinuteTick(): number {
  const [n, setN] = useState(0);
  useEffect(() => { const t = setInterval(() => setN((x) => x + 1), 60_000); return () => clearInterval(t); }, []);
  return n;
}

/** A compact round drop-down for a second filter under the chips (owner, status). */
export function PhoneSelect({ value, onChange, options, label }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; label: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className="h-9 rounded-full border-0 bg-muted px-4 text-sm font-medium text-foreground">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
