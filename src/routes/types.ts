import type { ComponentType, LazyExoticComponent } from "react";

/**
 * One route, declared in its module's file (`src/routes/<module>.tsx`).
 *
 * Add or change a module's routes ONLY in its own file; `src/routes/index.ts`
 * collects every module and App.tsx renders them, so no shared file needs
 * editing.
 */
export interface RouteDef {
  /** Absolute path, e.g. "/clients/:id". */
  path: string;
  /** Always `lazy(() => import("@/pages/<module>/<Page>"))` so each page is its own chunk. */
  element: LazyExoticComponent<ComponentType>;
  /**
   * Render inside <SalesScope>, which remounts the page when you switch to a
   * colleague's view, so every fetch on it runs again for the person now selected.
   */
  salesScope?: boolean;
}
