import { lazy } from "react";
import type { RouteDef } from "./types";

const Bugs = lazy(() => import("@/pages/delivery/Bugs"));
const BugDetail = lazy(() => import("@/pages/delivery/BugDetail"));
const Meetings = lazy(() => import("@/pages/delivery/Meetings"));

export const routes: RouteDef[] = [
  { path: "/bugs", element: Bugs },
  { path: "/bugs/:id", element: BugDetail },
  { path: "/meetings", element: Meetings },
];
