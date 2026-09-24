import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The shell for creating or editing a record.
 *
 * ## Why a page and not a dialog
 *
 * A dialog is right for a question with two or three answers. A record form is
 * twenty fields and often a line-item table, and at that size the popup fights
 * the page: its own scrollbar inside the page's, its own width, and — the part
 * that actually costs the user — **no address of its own**. A half-typed
 * invoice in a dialog cannot be linked to, reloaded, or reached with Back.
 *
 * Every ERP of this shape — Zoho, Xero, QuickBooks — opens a full page for a
 * record and keeps dialogs for the small stuff. Side actions (record a payment,
 * adjust a quantity, confirm a delete, pick a product) still open a dialog in
 * place, because navigating away from a list loses the position, the filters
 * and the scroll offset.
 *
 * ## Height
 *
 * This deliberately does NOT scroll. `<main>` is the only scroll container in
 * the app (see `DashboardLayout`); a form that set its own `h-screen` or
 * `overflow-auto` would give the user two vertical scrollbars for one axis and
 * a wheel that moves the wrong one. The page is given height and allowed to
 * grow.
 *
 * The header matches `PageHeader`'s height and rhythm on purpose, so arriving
 * here reads as *going somewhere* rather than as something appearing on top.
 */
export interface FormPageProps {
  title: string;
  /** Sits under the title. Say what saving will do, not what the form is. */
  description?: string;
  /** Label on the back control — the place you came from, e.g. "Invoices". */
  backLabel?: string;
  onBack: () => void;
  /** Extra header controls, e.g. "Duplicate". Not the primary save. */
  actions?: ReactNode;
  /** Optional visual marker for a focused create page, such as a record icon. */
  headerIcon?: ReactNode;
  /**
   * Cancel/Save in a fixed strip at the foot of the card.
   *
   * Omit it when the buttons live at the end of the form instead — a long form
   * reads better with the actions where the typing ends, and a short one reads
   * better with them pinned. Passing both would give the form two save buttons.
   */
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  /** The surrounding EditDialog supplies the title and card treatment. */
  embedded?: boolean;
  /**
   * No outer card: the children are section cards of their own
   * (`RecordFormPage`), and the footer sits after them as a plain row.
   */
  bare?: boolean;
}

export function FormPage({
  title,
  description,
  backLabel,
  onBack,
  actions,
  headerIcon,
  footer,
  children,
  className,
  embedded = false,
  bare = false,
}: FormPageProps) {
  if (embedded) {
    return (
      <div className={className}>
        {children}
        {footer && (
          <div className="flex items-center justify-start gap-2 px-4 py-3 md:px-6">
            {footer}
          </div>
        )}
      </div>
    );
  }

  // Preserve the exact header markup for every existing form. The optional
  // icon is deliberately a small wrapper around it rather than a permanent
  // extra flex layer, so adding a richer create page cannot shift other forms.
  const headerCopy = (
    <div className="min-w-0">
      {/* -ml-2 pulls the ghost button's own padding back so the label sits
          on the same optical left edge as the h1 below it. */}
      <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
        <ArrowLeft className="h-4 w-4 mr-1" />
        {backLabel ?? "Back"}
      </Button>
      <h1 className="text-2xl font-bold text-foreground mt-1">{title}</h1>
      {description && (
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        {headerIcon ? (
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-7 shrink-0">{headerIcon}</div>
            {headerCopy}
          </div>
        ) : headerCopy}
        {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
      </div>

      {bare ? (
        <div className={cn("space-y-4", className)}>
          {children}
          {footer && <div data-form-actions="" className="flex items-center justify-start gap-2">{footer}</div>}
        </div>
      ) : (
        <div className={cn("bg-card rounded-xl border shadow-sm", className)}>
          <div className="p-4 md:p-6">{children}</div>
          {footer && (
            <div className="flex items-center justify-start gap-2 px-4 py-3 md:px-6">
              {footer}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default FormPage;
