import { lazy } from "react";
import type { RouteDef } from "./types";

// Sales (lead → call → follow-up → meeting → onboarding → customer, + challenges)
const SalesDashboard = lazy(() => import("@/pages/sales/SalesDashboard"));
const SalesLeads = lazy(() => import("@/pages/sales/SalesLeads"));
const SalesLeadDetail = lazy(() => import("@/pages/sales/SalesLeadDetail"));
const SalesClients = lazy(() => import("@/pages/sales/SalesClients"));
const SalesFollowUps = lazy(() => import("@/pages/sales/SalesFollowUps"));
const SalesMeetings = lazy(() => import("@/pages/sales/SalesMeetings"));
const SalesChallenges = lazy(() => import("@/pages/sales/SalesChallenges"));
const SalesChallengeDetail = lazy(() => import("@/pages/sales/SalesChallengeDetail"));
const SalesCallHistory = lazy(() => import("@/pages/sales/SalesCallHistory"));
const SalesActivity = lazy(() => import("@/pages/sales/SalesActivity"));
const SalesAccessControl = lazy(() => import("@/pages/sales/SalesAccessControl"));
const SalesTasks = lazy(() => import("@/pages/sales/SalesTasks"));
const SalesMore = lazy(() => import("@/pages/sales/SalesMore"));
const SalesAssistant = lazy(() => import("@/pages/sales/SalesAssistant"));
const SalesMentions = lazy(() => import("@/pages/sales/SalesMentions"));

export const routes: RouteDef[] = [
  { path: "/sales", element: SalesDashboard, salesScope: true },
  { path: "/sales/leads", element: SalesLeads, salesScope: true },
  { path: "/sales/leads/:id", element: SalesLeadDetail, salesScope: true },
  // Converted leads. A row opens /sales/leads/:id — same record.
  { path: "/sales/clients", element: SalesClients, salesScope: true },
  { path: "/sales/followups", element: SalesFollowUps, salesScope: true },
  { path: "/sales/meetings", element: SalesMeetings, salesScope: true },
  { path: "/sales/tasks", element: SalesTasks, salesScope: true },
  { path: "/sales/challenges", element: SalesChallenges, salesScope: true },
  { path: "/sales/challenges/:id", element: SalesChallengeDetail, salesScope: true },
  { path: "/sales/calls", element: SalesCallHistory, salesScope: true },
  { path: "/sales/activity", element: SalesActivity, salesScope: true },
  { path: "/sales/assistant", element: SalesAssistant, salesScope: true },
  { path: "/sales/access-control", element: SalesAccessControl },
  { path: "/sales/more", element: SalesMore, salesScope: true },
  // Deliberately outside SalesScope: your mentions are yours, and looking at a
  // colleague's work does not mean reading their post.
  { path: "/sales/mentions", element: SalesMentions },
];
