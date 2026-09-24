import { lazy } from "react";
import type { RouteDef } from "./types";

const Dashboard = lazy(() => import("@/pages/dashboard/Dashboard"));

export const routes: RouteDef[] = [
  { path: "/", element: Dashboard },
];
