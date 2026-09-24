import { lazy } from "react";
import type { RouteDef } from "./types";

const Pitches = lazy(() => import("@/pages/growth/Pitches"));
const PitchDetail = lazy(() => import("@/pages/growth/PitchDetail"));

export const routes: RouteDef[] = [
  { path: "/pitches", element: Pitches },
  { path: "/pitches/:id", element: PitchDetail },
];
