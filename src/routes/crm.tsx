import { lazy } from "react";
import type { RouteDef } from "./types";

const Clients = lazy(() => import("@/pages/crm/Clients"));
const ClientDetail = lazy(() => import("@/pages/crm/ClientDetail"));
const ClientForm = lazy(() => import("@/pages/crm/ClientForm"));
const Projects = lazy(() => import("@/pages/crm/Projects"));
const ProjectDetail = lazy(() => import("@/pages/crm/ProjectDetail"));
const ProjectForm = lazy(() => import("@/pages/crm/ProjectForm"));

export const routes: RouteDef[] = [
  { path: "/clients", element: Clients },
  { path: "/clients/new", element: ClientForm },
  { path: "/clients/:id", element: ClientDetail },
  { path: "/clients/:id/edit", element: ClientForm },
  { path: "/projects", element: Projects },
  // ?client=ID preselects the client.
  { path: "/projects/new", element: ProjectForm },
  { path: "/projects/:id", element: ProjectDetail },
  { path: "/projects/:id/edit", element: ProjectForm },
];
