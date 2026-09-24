import type { RouteDef } from "./types";
import { routes as dashboard } from "./dashboard";
import { routes as crm } from "./crm";
import { routes as delivery } from "./delivery";
import { routes as finance } from "./finance";
import { routes as growth } from "./growth";
import { routes as reports } from "./reports";
import { routes as sales } from "./sales";
import { routes as team } from "./team";
import { routes as admin } from "./admin";

export type { RouteDef } from "./types";

/**
 * Every module's routes. Nobody edits this file to add a page — add the route
 * to your module's own file. React Router ranks by specificity, so order does
 * not matter ("/sales/leads" always beats "/sales/:x").
 */
export const appRoutes: RouteDef[] = [
  ...dashboard,
  ...crm,
  ...delivery,
  ...finance,
  ...growth,
  ...reports,
  ...sales,
  ...team,
  ...admin,
];
