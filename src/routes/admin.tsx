import { lazy } from "react";
import type { RouteDef } from "./types";

const UserManagement = lazy(() => import("@/pages/admin/UserManagement"));
const Settings = lazy(() => import("@/pages/admin/Settings"));

export const routes: RouteDef[] = [
  { path: "/user-management", element: UserManagement },
  { path: "/settings", element: Settings },
];
