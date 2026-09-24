import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The standard content card.
 *
 * Every page was hand-rolling `<div className="bg-card rounded-xl border">`
 * plus its own header markup — 68 of them across 27 files — so padding, title
 * weight, divider placement and footer treatment drifted apart screen by
 * screen. That drift is what reads as "unfinished" next to Salesforce or SAP,
 * where every card on every screen has the same anatomy.
 *
 * Anatomy, fixed:
 *
 *     ┌──────────────────────────────────────────┐
 *     │ Title                          [actions] │  header — only when titled
 *     │ subtitle                                 │
 *     ├──────────────────────────────────────────┤
 *     │ body                                     │
 *     ├──────────────────────────────────────────┤
 *     │ footer                                   │  optional
 *     └──────────────────────────────────────────┘
 *
 * `flush` turns off body padding, for a table that should meet the card's
 * edges — the one variation the ledgers legitimately need.
 */
export function Panel({
  title,
  subtitle,
  actions,
  footer,
  flush = false,
  className,
  bodyClassName,
  children,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Right-aligned in the header: filters, a link out, an overflow menu. */
  actions?: ReactNode;
  footer?: ReactNode;
  /** Drop body padding, so a table can reach the card's edges. */
  flush?: boolean;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  const titled = title !== undefined || actions !== undefined;

  return (
    <div className={cn("bg-card rounded-xl border shadow-sm overflow-hidden", className)}>
      {titled && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            {title !== undefined && (
              <h2 className="text-base font-semibold text-card-foreground truncate">{title}</h2>
            )}
            {subtitle !== undefined && (
              <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
          {actions !== undefined && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
          )}
        </div>
      )}
      <div className={cn(flush ? "" : "p-4", bodyClassName)}>{children}</div>
      {footer !== undefined && (
        <div className="border-t bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
          {footer}
        </div>
      )}
    </div>
  );
}

/**
 * The heading block every page opens with.
 *
 * Same reason as Panel: the title/description/action row was retyped on each
 * page, so the gap under the description and the alignment of the primary
 * button were never quite the same twice.
 */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        {description !== undefined && (
          <p className="text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {actions !== undefined && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
