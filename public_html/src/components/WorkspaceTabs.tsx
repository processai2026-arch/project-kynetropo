import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Pin, PinOff, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { routeIcon, routeTitle } from "@/lib/navigation";
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  clearOthers,
  closeTab as closeTabIn,
  neighbourOf,
  openTab,
  readStoredTabs,
  setPinned,
  shouldShowTabs,
  TABS_STORAGE_KEY,
  type WorkspaceTab,
} from "@/lib/workspaceTabs";

/**
 * The strip of open pages under the header.
 *
 * Navigating anywhere leaves a tab behind, so getting back to a page you were
 * halfway through is one click rather than a trip through the module menu —
 * the thing the sidebar alone is bad at, because it only ever shows one
 * section at a time.
 *
 * State is local to the header: nothing else needs to read it, so a context
 * would only add indirection.
 */
export function WorkspaceTabs() {
  const location = useLocation();
  const navigate = useNavigate();
  const [tabs, setTabs] = useState<WorkspaceTab[]>(() =>
    readStoredTabs(typeof window === "undefined" ? null : sessionStorage.getItem(TABS_STORAGE_KEY)),
  );
  const activeRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  /** Whether the strip actually overflows, so the arrows stay hidden until needed. */
  const [overflowing, setOverflowing] = useState(false);

  const path = location.pathname;

  // Record the visit. Runs after navigation, so the tab for the page you are
  // on always exists — including on a cold load straight into a deep link.
  useEffect(() => {
    setTabs((prev) => openTab(prev, { url: path, title: routeTitle(path) }));
  }, [path]);

  useEffect(() => {
    try {
      sessionStorage.setItem(TABS_STORAGE_KEY, JSON.stringify(tabs));
    } catch {
      // A full or disabled sessionStorage must not break navigation.
    }
  }, [tabs]);

  // Keep the open page's tab in view when the strip has scrolled — reopening a
  // page from the sidebar should not leave its tab off the left edge.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [path, tabs.length]);

  // Arrows appear only once the strip is wider than the space for it — two
  // dead controls flanking four tabs would be worse than none.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const check = () => setOverflowing(el.scrollWidth > el.clientWidth + 2);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tabs.length]);

  /**
   * Jump roughly ten tabs.
   *
   * Sized from the ten tabs nearest the start rather than a fixed pixel step,
   * because tab widths follow their labels — "Reports" and "Other Components"
   * are not the same size, so a fixed step would land mid-tab on one strip and
   * skip whole tabs on another. Falls back to one visible width if the strip
   * is somehow empty.
   */
  const jump = (direction: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const kids = Array.from(el.children) as HTMLElement[];
    const step = kids.slice(0, 10).reduce((sum, k) => sum + k.offsetWidth, 0) || el.clientWidth;
    el.scrollBy({ left: direction * step, behavior: "smooth" });
  };

  const close = (url: string) => {
    // Work out where to go *before* dropping it, while the neighbours are
    // still in the list.
    const goTo = url === path ? neighbourOf(tabs, url) : null;
    setTabs((prev) => closeTabIn(prev, url));
    if (url === path) navigate(goTo ?? "/");
  };

  /**
   * Keep this page on the strip, or stop keeping it.
   *
   * The page in view is passed through so unpinning — which can put the strip
   * back over its cap — cannot evict the tab you are looking at.
   */
  const togglePin = (tab: WorkspaceTab) =>
    setTabs((prev) => setPinned(prev, tab.url, !tab.pinned, path));

  // One tab, and it is the page you are on: the strip would only be telling
  // you what the heading already says. A pinned tab keeps it on screen — the
  // strip vanishing as the last unpinned tab closed looked exactly like the
  // pin had been closed along with it.
  if (!shouldShowTabs(tabs)) return null;

  return (
    <div className="flex h-11 items-stretch border-t border-border bg-muted/40">
      {overflowing && (
        <button
          type="button"
          onClick={() => jump(-1)}
          aria-label="Scroll tabs left"
          title="Earlier tabs"
          className="flex shrink-0 items-center border-r border-border/70 px-1.5 text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}

      <div ref={scrollerRef} className="flex flex-1 items-stretch overflow-x-auto eco-tabstrip pl-2 md:pl-4">
        {tabs.map((tab, i) => {
          const active = tab.url === path;
          const prevActive = i > 0 && tabs[i - 1].url === path;
          const Icon = routeIcon(tab.url);
          return (
            /* Right-click is where a tab's own actions belong: the strip is
               narrow, and a menu button on every tab would cost more width
               than the labels. */
            <ContextMenu key={tab.url}>
            <ContextMenuTrigger asChild>
            <div
              ref={active ? activeRef : undefined}
              className={cn(
                "group relative flex shrink-0 items-center text-xs transition-colors",
                // Flat tabs, not chips. The open one lifts onto the card
                // surface and is underlined in the brand — that reads as "this
                // one is in front" the way a row of outlined boxes never did,
                // because a box around every tab gives none of them primacy.
                active
                  ? "bg-card text-foreground font-semibold"
                  : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
              )}
            >
              {/* Hairline between tabs, suppressed either side of the open one
                  so the raised tab isn't fenced in by rules. */}
              {i > 0 && !active && !prevActive && (
                <span aria-hidden className="absolute left-0 top-1/2 h-4 w-px -translate-y-1/2 bg-border" />
              )}
              {active && (
                <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />
              )}
              <button
                type="button"
                // Navigates by calling navigate(), not by being a link, so the
                // unsaved-changes guard cannot see it without being told.
                data-navigates=""
                onClick={() => navigate(tab.url)}
                className="flex items-center gap-1.5 py-2.5 pl-3 pr-1.5"
                // The hint is on the tooltip because a right-click menu is
                // invisible otherwise, and this strip drops the oldest page
                // once five are open — pinning is the answer to that.
                title={tab.pinned ? `${tab.title} (pinned)` : `${tab.title}
Right-click to pin`}
              >
                {/* The same glyph the sidebar gives this page, so a tab is
                    recognised by shape before its label is read — which is
                    what makes a long strip scannable rather than a wall of
                    similar-length words. */}
                <Icon className={cn("h-3.5 w-3.5 shrink-0", active && "text-primary")} />
                <span className="block max-w-[10rem] truncate">{tab.title}</span>
                {/* A pin is a state, so it is on the tab and not only in the
                    menu — otherwise the one difference that matters here
                    would be invisible until you right-clicked. */}
                {tab.pinned && <Pin className="h-3 w-3 shrink-0 rotate-45 text-primary" aria-label="Pinned" />}
              </button>
              {/* No close button on a pinned tab. You asked for it to stay, so
                  it does not sit one stray click from being gone — unpin from
                  the menu, or close it from there deliberately. */}
              {!tab.pinned && (
                <button
                  type="button"
                  onClick={() => close(tab.url)}
                  aria-label={`Close ${tab.title}`}
                  title={`Close ${tab.title}`}
                  className={cn(
                    "mr-2 rounded p-0.5 transition-colors hover:bg-destructive/10 hover:text-destructive",
                    // Kept out of the way until the tab is pointed at, so a row
                    // of tabs reads as labels rather than close buttons.
                    active ? "opacity-70" : "opacity-0 group-hover:opacity-70",
                  )}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
              {tab.pinned && <span className="mr-2" />}
            </div>
            </ContextMenuTrigger>
            <ContextMenuContent className="w-56">
              <ContextMenuItem onSelect={() => togglePin(tab)} className="gap-2">
                {tab.pinned
                  ? <><PinOff className="h-4 w-4" /> Unpin this tab</>
                  : <><Pin className="h-4 w-4" /> Pin this tab</>}
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onSelect={() => close(tab.url)} className="gap-2">
                <X className="h-4 w-4" /> Close
              </ContextMenuItem>
              {/* Lands on the tab you kept, the way a browser does. Closing
                  others while standing on one of them would drop the tab for
                  the page still on screen. */}
              <ContextMenuItem
                onSelect={() => {
                  setTabs((prev) => clearOthers(prev, tab.url));
                  if (tab.url !== path) navigate(tab.url);
                }}
                className="gap-2"
              >
                <X className="h-4 w-4" /> Close others
              </ContextMenuItem>
            </ContextMenuContent>
            </ContextMenu>
          );
        })}
      </div>

      {overflowing && (
        <button
          type="button"
          onClick={() => jump(1)}
          aria-label="Scroll tabs right"
          title="Later tabs"
          className="flex shrink-0 items-center border-l border-border/70 px-1.5 text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

      {/* Pinned outside the scrolling row: with many tabs open — exactly
          when this is wanted — a button that scrolled away with them would be
          unreachable without first scrolling to the end. */}
      <div className="flex shrink-0 items-center border-l border-border/70 pl-2 pr-2 md:pr-4">
        <button
          type="button"
          onClick={() => setTabs((prev) => clearOthers(prev, path))}
          title="Close every tab except the page you are on and anything pinned"
          className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          Clear all
        </button>
      </div>
    </div>
  );
}
