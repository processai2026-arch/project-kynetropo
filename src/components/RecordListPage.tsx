import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import "@/styles/record-list.css";

/**
 * The wrapper every list page opens with.
 *
 * Browsing a register is a different activity from reading one record, and the
 * Operators list has always said so: a taller row, one card holding the filters
 * and the pager, a tinted disc against anything with a name. Every other list
 * was on the generic table kit.
 *
 * A page opts in by wrapping, and nothing about its table has to change — the
 * skin restyles the `th` and `td` it already renders. Which is also why the
 * skin cannot leak: a page that does not wrap never matches the selectors.
 */
export function RecordListPage({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("record-list space-y-6", className)}>{children}</div>;
}

export default RecordListPage;
