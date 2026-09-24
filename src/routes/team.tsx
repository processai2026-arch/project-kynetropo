import { lazy } from "react";
import type { RouteDef } from "./types";

const Hiring = lazy(() => import("@/pages/team/Hiring"));
const Employees = lazy(() => import("@/pages/team/Employees"));

export const routes: RouteDef[] = [
  { path: "/hiring", element: Hiring },
  { path: "/employees", element: Employees },
];
