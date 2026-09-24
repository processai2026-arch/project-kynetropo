import { lazy } from "react";
import type { RouteDef } from "./types";

const OpsReports = lazy(() => import("@/pages/reports/OpsReports"));
const OpsReportView = lazy(() => import("@/pages/reports/OpsReportView"));

export const routes: RouteDef[] = [
  { path: "/reports", element: OpsReports },
  { path: "/reports/:id", element: OpsReportView },
];
