/**
 * Open-page tabs for the header strip.
 *
 * The list logic lives here rather than inside the component so the awkward
 * parts — which tab to land on after closing the one you are looking at, which
 * one to drop when the strip is full — are testable without rendering a router.
 */

export interface WorkspaceTab {
  /** Route path. Also the identity of the tab: one tab per path. */
  url: string;
  title: string;
  /**
   * Kept through eviction, and held at the front of the strip.
   *
   * The strip is short on purpose, so anything you need all day would keep
   * being pushed off it. Pinning is how you say "not this one".
   */
  pinned?: boolean;
  /** Epoch ms of the last visit — what decides which tab goes when one must. */
  visitedAt?: number;
}

/**
 * How many unpinned pages stay open at once.
 *
 * A strip that grows forever becomes its own navigation problem: past a
 * handful the tabs are narrower than their labels and finding one is slower
 * than using the sidebar. Four is what fits without scrolling on a laptop.
 *
 * Pinned tabs sit outside this count. Pinning is deliberate, so the number of
 * them is the operator's business, not ours.
 */
export const MAX_TABS = 4;

export const TABS_STORAGE_KEY = "eco_workspace_tabs";

/** Pinned first, each group keeping the order it already had. */
function pinnedFirst(tabs: WorkspaceTab[]): WorkspaceTab[] {
  return [...tabs.filter((t) => t.pinned), ...tabs.filter((t) => !t.pinned)];
}

/**
 * Drop unpinned tabs until the strip is back within the cap.
 *
 * Least recently *visited* goes, not oldest opened: a page you keep coming
 * back to would otherwise be evicted for the crime of having been opened
 * first. `keepUrl` is the page on screen, which can never be the one dropped.
 */
function evict(tabs: WorkspaceTab[], keepUrl?: string): WorkspaceTab[] {
  let next = tabs;
  for (;;) {
    const loose = next.filter((t) => !t.pinned);
    if (loose.length <= MAX_TABS) return next;
    const droppable = loose.filter((t) => t.url !== keepUrl);
    // Everything left is either pinned or on screen — there is nothing this
    // is allowed to take, so the strip stays over the cap rather than
    // closing the page being looked at.
    if (droppable.length === 0) return next;
    const oldest = droppable.reduce((a, b) => ((a.visitedAt ?? 0) <= (b.visitedAt ?? 0) ? a : b));
    next = next.filter((t) => t.url !== oldest.url);
  }
}

/**
 * Record a visit.
 *
 * Revisiting an open page moves nothing: a strip that reordered itself under
 * the pointer would make the tab you were aiming for slide away. New pages are
 * appended after the pinned block, so the strip reads in the order you opened
 * things.
 */
export function openTab(tabs: WorkspaceTab[], tab: WorkspaceTab, now: number = Date.now()): WorkspaceTab[] {
  const known = tabs.some((t) => t.url === tab.url);
  const next = known
    // Keep the position and the pin, but let a renamed page (a receipt id
    // resolving late) correct its own label.
    ? tabs.map((t) => (t.url === tab.url ? { ...t, title: tab.title, visitedAt: now } : t))
    : [...tabs, { ...tab, visitedAt: now }];
  return evict(next, tab.url);
}

export function closeTab(tabs: WorkspaceTab[], url: string): WorkspaceTab[] {
  return tabs.filter((t) => t.url !== url);
}

/**
 * Whether the strip is worth drawing.
 *
 * One tab, and it is the page you are on: the strip would only be repeating
 * the heading. A pin changes that — closing the last unpinned tab beside a
 * pinned one used to hide the whole strip, which looked exactly like the pin
 * had been closed too. Anything pinned keeps the strip on screen.
 */
export function shouldShowTabs(tabs: WorkspaceTab[]): boolean {
  return tabs.length > 1 || tabs.some((t) => t.pinned);
}

/**
 * Pin or unpin one tab.
 *
 * Pinning moves it to the front, which is the only reordering the strip ever
 * does — and it happens because you asked for it, not while you are aiming at
 * something. Unpinning can put the strip back over the cap, so the same
 * eviction runs afterwards.
 */
export function setPinned(
  tabs: WorkspaceTab[],
  url: string,
  pinned: boolean,
  keepUrl?: string,
): WorkspaceTab[] {
  const marked = tabs.map((t) => (t.url === url ? { ...t, pinned } : t));
  return evict(pinnedFirst(marked), keepUrl);
}

/**
 * Clear the strip, keeping the page in view and anything pinned.
 *
 * Dropping every tab including the open one would leave the strip empty while
 * that page is still on screen — and the next render would put its tab
 * straight back, so the button would look broken. Pinned tabs survive because
 * surviving is the whole point of pinning them; Clear all would otherwise be
 * a one-click undo of every pin.
 */
export function clearOthers(tabs: WorkspaceTab[], keepUrl: string): WorkspaceTab[] {
  return tabs.filter((t) => t.url === keepUrl || t.pinned);
}

/**
 * Where to go when the tab being closed is the one on screen.
 *
 * Falls to the right-hand neighbour first — closing a run of tabs left to right
 * then keeps working without the selection jumping backwards each time — and to
 * the left only at the end of the strip. Null means nothing is left to show.
 */
export function neighbourOf(tabs: WorkspaceTab[], url: string): string | null {
  const i = tabs.findIndex((t) => t.url === url);
  if (i === -1) return null;
  const right = tabs[i + 1];
  if (right) return right.url;
  const left = tabs[i - 1];
  return left ? left.url : null;
}

/** Read the strip back after a reload, ignoring anything malformed. */
export function readStoredTabs(raw: string | null): WorkspaceTab[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const tabs = parsed
      .filter(
        (t): t is WorkspaceTab =>
          !!t &&
          typeof (t as WorkspaceTab).url === "string" &&
          typeof (t as WorkspaceTab).title === "string",
      )
      .map((t) => ({
        url: t.url,
        title: t.title,
        pinned: t.pinned === true,
        visitedAt: typeof t.visitedAt === "number" ? t.visitedAt : 0,
      }));
    // A strip stored before the cap came down, or before pinning existed, is
    // trimmed on the way in rather than left oversized until the next visit.
    return evict(pinnedFirst(tabs));
  } catch {
    return [];
  }
}
