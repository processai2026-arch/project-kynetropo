import type { ReactNode } from "react";
import { ChevronRight, LayoutGrid, type LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { ProfileWaves } from "@/components/ProfileWaves";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { TopBar, usePhoneApp } from "@/components/phone/PhoneKit";

/**
 * The top of a record page (mpTV-erp's Operator/Customer profile block):
 * breadcrumb and actions, a gradient mark, the code and status, the name, a
 * line of context, then a strip of the three or four facts people open the
 * record for. Must sit inside `RecordDetailPage` — `record-detail.css` turns it
 * from a card into the open, wave-washed header.
 */
export interface ProfileFact {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  /** Makes the fact a link — tel:, mailto:, or an in-app path. */
  href?: string;
  external?: boolean;
}

export interface RecordProfileHeaderProps {
  backTo: string;
  backLabel: string;
  crumb: string;
  /** Mark shown when there is no `mark` content (a building, a box…). */
  icon: LucideIcon;
  /**
   * What goes in the mark instead of the icon: a person's initials, or a photo.
   * A photo fills the disc edge to edge.
   */
  mark?: ReactNode;
  /** "lg" is the 104px Operator avatar, for records about a person. */
  markSize?: "md" | "lg";
  eyebrow?: string;
  status?: ReactNode;
  title: string;
  subtitle?: ReactNode;
  facts?: ProfileFact[];
  aside?: ReactNode;
  actions?: ReactNode;
  loading?: boolean;
  className?: string;
}

export function RecordProfileHeader({
  backTo,
  backLabel,
  crumb,
  icon: Icon,
  mark,
  markSize = "md",
  eyebrow,
  status,
  title,
  subtitle,
  facts = [],
  aside,
  actions,
  loading,
  className,
}: RecordProfileHeaderProps) {
  const navigate = useNavigate();
  // The Sales app on a phone: Diamond Fencing's record screen instead.
  if (usePhoneApp()) {
    return <PhoneProfile {...{ backTo, crumb, icon: Icon, mark, eyebrow, status, title, subtitle, facts, aside, actions, loading }} />;
  }

  return (
    <header data-profile="" className={cn("rounded-xl border bg-card shadow-sm", className)}>
      <ProfileWaves />

      <div data-profile-toolbar="" className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 md:px-6">
        <nav data-profile-crumb="" className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground" aria-label="Breadcrumb">
          <button
            type="button"
            onClick={() => navigate(backTo)}
            className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors hover:bg-muted/60 hover:text-foreground"
          >
            <LayoutGrid className="h-4 w-4" aria-hidden /> {backLabel}
          </button>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          <span aria-current="page" className="truncate font-medium text-foreground">{crumb}</span>
        </nav>
        {actions && <div data-profile-actions="" className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>

      <div data-profile-body="" className="flex flex-wrap items-start gap-4 p-4 md:p-6">
        <div className="flex min-w-0 flex-1 items-start gap-5">
          <span
            data-profile-mark=""
            data-mark-size={markSize}
            className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-primary/10 text-primary"
            // Only the stock icon is decoration; a photo there can be a button (add / replace / remove).
            aria-hidden={mark ? undefined : true}
          >
            {mark ?? <Icon className="h-7 w-7" />}
          </span>

          <div className="min-w-0 flex-1 space-y-2 pt-1">
            {loading ? (
              <>
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-48" />
              </>
            ) : (
              <>
                {(eyebrow || status) && (
                  <div data-profile-state="" className="flex flex-wrap items-center gap-2">
                    {eyebrow && <span className="text-xs text-muted-foreground">{eyebrow}</span>}
                    {status}
                  </div>
                )}
                <h1 data-profile-title="" className="text-2xl font-bold text-foreground">{title}</h1>
                {subtitle && (
                  <div data-profile-subtitle="" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                    {subtitle}
                  </div>
                )}
              </>
            )}

            {facts.length > 0 && (
              <dl data-profile-facts="" className={cn("grid grid-cols-1 gap-3 pt-4 sm:grid-cols-2", aside ? "xl:grid-cols-4" : "lg:grid-cols-4")}>
                {facts.map((fact) => <Fact key={fact.label} {...fact} />)}
              </dl>
            )}
          </div>
        </div>

        {aside && <div data-profile-aside="" className="w-full min-w-0 lg:w-72">{aside}</div>}
      </div>
    </header>
  );
}

function Fact({ icon: Icon, label, value, href, external }: ProfileFact) {
  const navigate = useNavigate();
  const empty = value === null || value === undefined || value === "" || value === "—";
  const body = (
    <>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0">
        <dd className="truncate text-sm font-medium text-card-foreground">{empty ? "Not recorded" : value}</dd>
        <dt className="truncate text-xs text-muted-foreground">{label}</dt>
      </span>
    </>
  );
  const shell = "flex min-w-0 items-center gap-2.5 rounded-lg border bg-muted/20 px-3 py-2 text-left";

  if (!href || empty) return <div data-profile-fact="" className={shell}>{body}</div>;
  // In-app paths navigate in place; tel:/mailto:/https go through the browser.
  if (href.startsWith("/")) {
    return <button type="button" data-profile-fact="" className={cn(shell, "hover:bg-muted/50")} onClick={() => navigate(href)}>{body}</button>;
  }
  return (
    <a data-profile-fact="" className={cn(shell, "hover:bg-muted/50")} href={href}
      target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}>
      {body}
    </a>
  );
}

/**
 * The card beside the identity (mpTV's "Field Technician" block): one person or
 * record this one belongs to, opened with a click.
 */
export function ProfileLinkCard({ icon: Icon, label, value, onClick }: { icon: LucideIcon; label: string; value: ReactNode; onClick?: () => void }) {
  return (
    <button type="button" data-profile-link="" disabled={!onClick} onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg border bg-card px-3.5 py-3 text-left shadow-sm transition-colors enabled:hover:border-primary/40">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-success/10 text-success"><Icon className="h-5 w-5" aria-hidden /></span>
      <span className="min-w-0">
        <span className="block text-xs text-muted-foreground">{label}</span>
        <strong className="mt-0.5 block truncate text-sm">{value}</strong>
      </span>
      {onClick && <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" aria-hidden />}
    </button>
  );
}

export default RecordProfileHeader;

/**
 * A record on the phone app (Diamond Fencing's design): the coloured bar with the back arrow,
 * the record's circle, name and status on a white card, its facts as plain rows (a phone
 * number dials, an e-mail writes), then its buttons.
 */
function PhoneProfile({ backTo, crumb, icon: Icon, mark, eyebrow, status, title, subtitle, facts = [], aside, actions, loading }:
  Pick<RecordProfileHeaderProps, "backTo" | "crumb" | "icon" | "mark" | "eyebrow" | "status" | "title" | "subtitle" | "facts" | "aside" | "actions" | "loading">) {
  return (
    <div data-phone-profile="" className="space-y-3">
      <TopBar back={backTo} title={loading ? title : crumb || title} sub={eyebrow} />
      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="flex items-center gap-3 p-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
            {mark ?? <Icon className="h-6 w-6" />}
          </span>
          <div className="min-w-0 flex-1">
            {loading ? <Skeleton className="h-6 w-40" /> : <h2 className="truncate text-lg font-bold text-foreground">{title}</h2>}
            {status ? <div className="mt-1 flex flex-wrap items-center gap-1.5">{status}</div> : null}
            {subtitle ? <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground [&_svg]:h-4 [&_svg]:w-4">{subtitle}</div> : null}
          </div>
        </div>
        {facts.length > 0 && (
          <dl className="divide-y border-t">
            {facts.map((f) => {
              const FactIcon = f.icon;
              const body = (
                <>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"><FactIcon className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1">
                    <dd className="truncate font-medium text-foreground">{f.value}</dd>
                    <dt className="text-xs text-muted-foreground">{f.label}</dt>
                  </span>
                </>
              );
              const cls = "flex min-h-14 items-center gap-3 px-4 py-2.5";
              return f.href
                ? <a key={f.label} href={f.href} target={f.external ? "_blank" : undefined} rel={f.external ? "noreferrer" : undefined} className={cn(cls, "active:bg-muted/70")}>{body}</a>
                : <div key={f.label} className={cls}>{body}</div>;
            })}
          </dl>
        )}
      </section>
      {actions && <div className="grid grid-cols-2 gap-2 [&>*]:w-full">{actions}</div>}
      {aside}
    </div>
  );
}
