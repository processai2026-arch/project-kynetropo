import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

/**
 * "Leave this page? Your unsaved changes will be discarded."
 *
 * ── Why this is an interceptor and not useBlocker ────────────────────────────
 * react-router's useBlocker only exists on a data router (createBrowserRouter).
 * This app runs <BrowserRouter> with a nested <Routes> under /*, and AuthProvider
 * sits inside the router because it navigates — converting all thirty routes to
 * a data router to gain one dialog is a large change with a large blast radius.
 *
 * So navigation is caught where it starts: a capture-phase click listener on
 * the document, which runs before React's own handlers and therefore before
 * <Link>, the tab strip, the sidebar, the module launcher and the search
 * palette can call navigate(). Blocking there covers every in-app path without
 * each of those components having to know this exists.
 *
 * ── What it covers, and what it does not ─────────────────────────────────────
 *   in-app navigation   — this dialog
 *   reload / tab close  — the browser's own dialog, via beforeunload. Browsers
 *                         refuse to let a page style or word that one, which is
 *                         deliberate on their part and not something we can
 *                         work around.
 *   browser Back        — NOT covered. Intercepting popstate means pushing a
 *                         sentinel entry and unwinding it afterwards, which
 *                         breaks ordinary back navigation when it goes wrong.
 *                         That one wants the data-router migration.
 */

interface GuardApi {
  /** Register/clear this page's dirty flag. Keyed so two forms cannot clobber. */
  setDirty: (key: string, dirty: boolean) => void;
  /**
   * Ask before navigating from code. Resolves true when it is safe to go.
   *
   * For the navigation a click listener cannot see: a command palette answers
   * Enter as well as a click, and a keypress is not a click on anything.
   */
  confirmLeave: () => Promise<boolean>;
}

const UnsavedChangesContext = createContext<GuardApi | null>(null);

/**
 * The guard, for code that navigates from a keypress rather than a click.
 *
 * Resolves true when there is no provider, so a component rendered outside one
 * — a test, a story — still navigates instead of hanging.
 */
export function useConfirmLeave(): () => Promise<boolean> {
  const ctx = useContext(UnsavedChangesContext);
  return useCallback(() => ctx?.confirmLeave() ?? Promise.resolve(true), [ctx]);
}

/**
 * Declare that this page has unsaved edits.
 *
 * Clears itself on unmount, so navigating away after saving — or after the
 * dialog was accepted — never leaves a stale flag behind to block the next
 * page for no reason.
 */
export function useUnsavedChanges(dirty: boolean, key: string): void {
  const ctx = useContext(UnsavedChangesContext);
  useEffect(() => {
    ctx?.setDirty(key, dirty);
  }, [ctx, key, dirty]);
  useEffect(() => () => ctx?.setDirty(key, false), [ctx, key]);
}

/** An anchor that this router will handle, rather than a download or an external link. */
function internalLinkFrom(target: EventTarget | null): HTMLAnchorElement | null {
  if (!(target instanceof Element)) return null;
  const anchor = target.closest("a");
  if (!anchor || !(anchor instanceof HTMLAnchorElement)) return null;
  if (anchor.target === "_blank" || anchor.hasAttribute("download")) return null;
  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#") || /^[a-z]+:/i.test(href)) return null;
  if (anchor.origin !== window.location.origin) return null;
  return anchor;
}

export function UnsavedChangesProvider({ children }: { children: React.ReactNode }) {
  const dirtyKeys = useRef(new Set<string>());
  /**
   * What to do once the question is answered.
   *
   * `replay` is the click that was blocked — re-clicking is the only thing
   * right for a link, a tab and a search hit alike, since each navigates
   * differently. `resolve` is a promise a caller is waiting on.
   */
  const [pending, setPending] = useState<
    { replay?: HTMLElement; resolve?: (ok: boolean) => void } | null
  >(null);
  // Set while replaying the click the dialog just approved, so the listener
  // lets that one through instead of asking again forever.
  const bypass = useRef(false);

  const setDirty = useCallback((key: string, dirty: boolean) => {
    if (dirty) dirtyKeys.current.add(key);
    else dirtyKeys.current.delete(key);
  }, []);

  const confirmLeave = useCallback(() => {
    if (dirtyKeys.current.size === 0) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => setPending({ resolve }));
  }, []);

  useEffect(() => {
    const onClickCapture = (e: MouseEvent) => {
      if (bypass.current || dirtyKeys.current.size === 0) return;
      // Modified clicks open a new tab, which leaves this page as it is —
      // there is nothing to lose, so there is nothing to ask about.
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (!(e.target instanceof Element)) return;

      const anchor = internalLinkFrom(e.target);
      // Anything that navigates without being a link says so itself. Buttons
      // in the tab strip, module launcher and search palette call navigate()
      // in their own handler, which this listener cannot see.
      const marked = e.target.closest<HTMLElement>("[data-navigates]");
      const trigger = anchor ?? marked;
      if (!trigger) return;

      // Staying on the page you are already on is not leaving it.
      if (anchor && anchor.pathname === window.location.pathname) return;

      e.preventDefault();
      e.stopPropagation();
      setPending({ replay: trigger });
    };

    // Capture phase, so this runs before React's delegated handlers get to
    // call navigate(). On the bubble phase the navigation has already happened.
    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
  }, []);

  // Reload and tab close. The browser shows its own wording here; a custom
  // string has been ignored by every major engine for years.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyKeys.current.size === 0) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const stay = () => {
    pending?.resolve?.(false);
    setPending(null);
  };

  const discard = () => {
    const { replay, resolve } = pending ?? {};
    setPending(null);
    dirtyKeys.current.clear();
    resolve?.(true);
    if (!replay) return;
    bypass.current = true;
    replay.click();
    // Cleared on a later tick: the click above is synchronous, but a handler
    // that defers its navigate() would otherwise be blocked on the way out.
    setTimeout(() => { bypass.current = false; }, 0);
  };

  return (
    <UnsavedChangesContext.Provider value={{ setDirty, confirmLeave }}>
      {children}
      {/* Esc or a backdrop click means "I did not mean to leave", so it takes
          the same path as Stay here rather than resolving a waiting caller's
          promise as true. */}
      <Dialog open={pending !== null} onOpenChange={(open) => { if (!open) stay(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Leave this page?
            </DialogTitle>
            <DialogDescription>
              If you leave, your unsaved changes will be discarded.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-start">
            {/* Staying is the safe answer, so it leads and carries the weight.
                Discarding is the one that loses work, so it is the quiet
                option — the reverse would make losing work the default. */}
            <Button onClick={stay}>Stay here</Button>
            <Button variant="outline" onClick={discard}>Leave &amp; discard changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </UnsavedChangesContext.Provider>
  );
}
