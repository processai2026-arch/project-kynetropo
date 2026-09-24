import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import "@/styles/record-detail.css";

/**
 * The wrapper every detail page opens with.
 *
 * ## Why a wrapper and not a prop on each page
 *
 * Reading one record is a different activity from browsing a list of them, and
 * the Operator page has always said so out loud: a deeper blue, panels with a
 * gradient heading, fields written beside their labels. Every other detail page
 * was built from the generic page kit, so the same job looked like two
 * different products depending on which module you came from.
 *
 * Putting the difference on one class means a page opts in by wrapping, and
 * nothing about its contents has to change: the panels, fields and figures it
 * already renders are restyled where they stand. It also means the skin can
 * never leak — a list page that does not wrap simply never matches the
 * selectors in `record-detail.css`.
 *
 * `space-y-6` is here because every page it replaces already opened with it,
 * and a wrapper that silently dropped the page's own rhythm would be a worse
 * kind of surprise than one that keeps it.
 */
export function RecordDetailPage({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("record-detail space-y-6", className)}>{children}</div>;
}

export default RecordDetailPage;
