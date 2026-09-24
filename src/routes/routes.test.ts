import { describe, expect, it } from "vitest";
import { appRoutes } from "@/routes";

describe("route registry", () => {
  it("declares every path once", () => {
    const paths = appRoutes.map((r) => r.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("uses absolute paths", () => {
    for (const route of appRoutes) expect(route.path.startsWith("/"), route.path).toBe(true);
  });

  it("serves exactly the app's pages", () => {
    expect(appRoutes.map((r) => r.path).sort()).toEqual(
      [
        "/",
        "/clients", "/clients/new", "/clients/:id", "/clients/:id/edit",
        "/projects", "/projects/new", "/projects/:id", "/projects/:id/edit",
        "/bugs", "/bugs/:id", "/meetings",
        "/finance", "/amc",
        "/pitches", "/pitches/:id",
        "/reports", "/reports/:id",
        "/sales", "/sales/leads", "/sales/leads/:id", "/sales/clients", "/sales/followups",
        "/sales/meetings", "/sales/tasks", "/sales/challenges", "/sales/challenges/:id",
        "/sales/calls", "/sales/activity", "/sales/assistant", "/sales/access-control", "/sales/more", "/sales/mentions",
        "/hiring", "/employees",
        "/user-management", "/settings",
      ].sort(),
    );
  });

  it("keeps access control and mentions outside the colleague view", () => {
    const scoped = appRoutes.filter((r) => r.salesScope).map((r) => r.path);
    expect(scoped.every((p) => p.startsWith("/sales"))).toBe(true);
    expect(scoped).not.toContain("/sales/access-control");
    expect(scoped).not.toContain("/sales/mentions");
    expect(scoped).toHaveLength(13);
  });
});
