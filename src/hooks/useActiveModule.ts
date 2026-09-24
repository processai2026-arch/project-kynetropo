import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  ACTIVE_MODULE_STORAGE_KEY,
  getDefaultSection,
  resolveStoredSection,
  routeSection,
  type MenuSection,
} from "@/lib/navigation";

/**
 * Which module the app is currently in.
 *
 * This used to live as a private effect inside AppSidebar. The header now names
 * the module too, and two components deciding that independently is how a
 * sidebar headed "Sales" ends up under a header reading "CRM". One hook, one
 * answer.
 *
 * The order matters:
 *
 *  1. The route, where it belongs to a module. "/" is deliberately excluded —
 *     the dashboard belongs to no module, so landing on it must not reset the
 *     one you were working in.
 *  2. The last module used, which is what carries you across "/" and Settings.
 *  3. CRM, as the module most work starts in.
 */
export function useActiveModule(): MenuSection | null {
  const { pathname } = useLocation();
  const [section, setSection] = useState<MenuSection | null>(null);

  useEffect(() => {
    if (pathname !== "/") {
      const fromRoute = routeSection(pathname);
      if (fromRoute) {
        setSection(fromRoute);
        try {
          localStorage.setItem(ACTIVE_MODULE_STORAGE_KEY, fromRoute.label);
        } catch {
          // A private window with storage disabled must not break navigation.
        }
        return;
      }
    }

    let stored: string | null = null;
    try {
      stored = localStorage.getItem(ACTIVE_MODULE_STORAGE_KEY);
    } catch {
      stored = null;
    }
    if (stored) {
      const found = resolveStoredSection(stored);
      if (found) {
        setSection(found);
        return;
      }
    }

    setSection(getDefaultSection());
  }, [pathname]);

  return section;
}

export default useActiveModule;
