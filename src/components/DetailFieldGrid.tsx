import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface DetailFieldGridProps {
  children: ReactNode;
  cols?: 2 | 3 | 4;
  className?: string;
}

/* Three columns wait for `xl`, not `sm`.
   A label track and a value in 213px — which is a third of a 640px card — puts
   two words on four lines. Stepping 1 → 2 → 3 gives each field room at every
   width, and only offers the third column where the card is actually wide.

   These are a CEILING, not the final answer. They are viewport breakpoints, and
   the question that decides the column count is how wide this card is, not how
   wide the window is — a card in a sidebar is narrow on the widest screen there
   is. `record-detail.css` measures the card itself with a container query and
   drops the count where it has to; `cols` says the most this grid should ever
   use. Outside a detail page these classes are still the whole rule. */
const colClass: Record<number, string> = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-4',
};

export function DetailFieldGrid({ children, cols = 2, className }: DetailFieldGridProps) {
  return (
    <dl data-field-grid="" className={cn('grid gap-4', colClass[cols], className)}>
      {children}
    </dl>
  );
}

export default DetailFieldGrid;
