import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SectionCardProps {
  title?: ReactNode;
  subtitle?: string;
  /** A tinted icon chip before the title (mpTV-erp Operator cards). */
  icon?: LucideIcon;
  headerAction?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyPadding?: string;
}

export function SectionCard({
  title,
  subtitle,
  icon: Icon,
  headerAction,
  children,
  className,
  bodyPadding = 'p-4',
}: SectionCardProps) {
  const hasHeader = title || subtitle || headerAction;
  return (
    // The data-* hooks are what `record-detail.css` / `record-form.css` restyle
    // a panel through. They say what each element IS, so the skin survives this
    // component being rewritten; matching on its Tailwind classes would not.
    <div data-panel="" className={cn('bg-card rounded-xl border shadow-sm', className)}>
      {hasHeader && (
        <div data-panel-head="" className="p-4 border-b flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-2.5">
            {Icon && (
              <span data-panel-icon="" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary" aria-hidden="true">
                <Icon className="h-4 w-4" />
              </span>
            )}
            <div className="min-w-0">
              {title && (
                <h2 className="text-base font-semibold text-card-foreground truncate">
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
              )}
            </div>
          </div>
          {headerAction && <div className="shrink-0">{headerAction}</div>}
        </div>
      )}
      {/* A caller that clears bodyPadding is saying its content brings its own
          — a table, a list of rows. The skin has to be told, or it puts the
          padding back and the table sits inside a second frame. */}
      <div data-panel-body="" data-panel-flush={bodyPadding ? undefined : ''} className={bodyPadding}>
        {children}
      </div>
    </div>
  );
}

export default SectionCard;
