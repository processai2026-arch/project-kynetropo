import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/lib/format';

/**
 * A vertical event list for a detail page.
 *
 * Every record in the system has a life: issued and returned, taken out and
 * brought back, raised and resolved. Those pairs used to live as two columns in
 * a table, which reads as two unrelated facts. Here they read as what they are
 * — one thing that happened, then the next.
 *
 * `at` may be null: a step that has not happened yet still belongs on the
 * timeline, greyed, so the gap is visible rather than merely absent.
 */
export interface TimelineItem {
  /** What happened — "Issued", "Returned", "Checked out". */
  label: string;
  /** When, as the API returns it. Null means "not yet". */
  at?: string | null;
  /** Optional precise timestamp for callers that sort an effective date timeline. */
  sortAt?: string | null;
  /** Who did it, or any one-line context. */
  by?: string | null;
  /** Free detail — notes, readings, quantities. */
  description?: ReactNode;
  /** Colours the dot. `pending` also greys the whole row. */
  tone?: 'done' | 'active' | 'pending' | 'warn';
}

const dotTone: Record<string, string> = {
  done:    'bg-emerald-500',
  active:  'bg-primary',
  pending: 'bg-muted-foreground/30',
  warn:    'bg-amber-500',
};

export function DetailTimeline({
  items,
  empty = 'Nothing recorded yet',
}: {
  items: TimelineItem[];
  empty?: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground py-4 text-center">{empty}</p>;
  }

  return (
    <ol className="relative space-y-5">
      {items.map((item, i) => {
        const tone = item.tone ?? (item.at ? 'done' : 'pending');
        return (
          <li key={`${item.label}-${i}`} className="relative flex gap-3">
            {/* The rail, drawn per row so it stops at the last dot rather than
                running past it into empty space. */}
            <div className="flex flex-col items-center">
              <span className={cn('mt-1 h-2.5 w-2.5 shrink-0 rounded-full', dotTone[tone])} />
              {i < items.length - 1 && <span className="mt-1 w-px flex-1 bg-border" />}
            </div>

            <div className={cn('min-w-0 flex-1 pb-1', tone === 'pending' && 'opacity-60')}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="text-sm font-medium text-card-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">
                  {item.at ? formatDateTime(item.at) : 'Pending'}
                </p>
              </div>
              {item.by && <p className="text-xs text-muted-foreground mt-0.5">{item.by}</p>}
              {item.description != null && item.description !== '' && (
                <div className="text-sm text-card-foreground mt-1 whitespace-pre-line break-words">
                  {item.description}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default DetailTimeline;
