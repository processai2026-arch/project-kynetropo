import { createContext, useCallback, useContext, useMemo, useState, Fragment, type ReactNode } from "react";
import { setSalesViewAs } from "@/lib/api/sales";

/**
 * Looking at a colleague's work, without being able to touch it.
 *
 * The team is meant to see each other's pipelines — but "every lead at once"
 * answers a different question from "what is Naresh actually working on?".
 * Picking a name narrows the whole module to that person: their dashboard
 * numbers, their leads, their diary, their tasks, their challenges.
 *
 * Read-only is enforced on the server, not here: the parameter is only ever
 * honoured on a GET, and a write that carries it is refused outright. What
 * this file does is make the app agree with that — hiding the buttons that
 * would be refused, rather than offering them and failing at the last step.
 *
 * The selection is deliberately kept in sessionStorage rather than the URL:
 * it survives a refresh (so a reloaded page does not silently snap back to
 * your own figures) but never leaks into a link someone else opens, where it
 * would show them a view they did not ask for.
 */

export interface ViewAsPerson {
  user_id: number;
  name: string;
}

const STORAGE_KEY = "kyn_sales_view_as";

function readStored(): ViewAsPerson | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ViewAsPerson;
    return typeof parsed?.user_id === "number" && parsed.user_id > 0 ? parsed : null;
  } catch {
    // A private window, or storage the browser refuses. Your own view is the
    // right thing to fall back to.
    return null;
  }
}

// Set before the first render so the very first request already carries it.
setSalesViewAs(readStored()?.user_id ?? null);

interface ViewAsContext {
  viewAs: ViewAsPerson | null;
  setViewAs: (person: ViewAsPerson | null) => void;
}

const Ctx = createContext<ViewAsContext>({ viewAs: null, setViewAs: () => undefined });

export function SalesViewAsProvider({ children }: { children: ReactNode }) {
  const [viewAs, setState] = useState<ViewAsPerson | null>(() => readStored());

  const setViewAs = useCallback((person: ViewAsPerson | null) => {
    // The API module variable first, synchronously: the re-render this state
    // change triggers is what refetches, and it must already be looking at the
    // new person by then.
    setSalesViewAs(person?.user_id ?? null);
    try {
      if (person) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(person));
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* Storage refused — the selection still works for this page. */
    }
    setState(person);
  }, []);

  const value = useMemo(() => ({ viewAs, setViewAs }), [viewAs, setViewAs]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSalesViewAs(): ViewAsContext {
  return useContext(Ctx);
}

/**
 * Wraps a sales route so switching person reloads it.
 *
 * Every sales page fetches in an effect that runs once on mount. Rather than
 * thread the selection through each page's dependency list — where one missed
 * entry means a screen quietly showing the wrong person's data — the key
 * remounts the page, and every fetch on it runs again from scratch.
 */
export function SalesScope({ children }: { children: ReactNode }) {
  const { viewAs } = useSalesViewAs();
  return <Fragment key={viewAs?.user_id ?? 0}>{children}</Fragment>;
}
