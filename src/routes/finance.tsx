import { lazy } from "react";
import type { RouteDef } from "./types";

const Finance = lazy(() => import("@/pages/finance/Finance"));
const AMC = lazy(() => import("@/pages/finance/AMC"));

export const routes: RouteDef[] = [
  { path: "/finance", element: Finance },
  { path: "/amc", element: AMC },
];
