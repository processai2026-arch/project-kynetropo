import { useEffect, useState } from "react";
import { salesDashboardApi } from "@/lib/api/sales";

export interface TeamMember {
  user_id: number;
  name: string;
}

/**
 * The people on this team, for @mentions and task assignment.
 *
 * Cached at module scope rather than per component: a lead page can mount half
 * a dozen comment threads at once, and every one of them wants the same list of
 * colleagues. One request serves all of them, and the promise is shared so
 * simultaneous mounts do not each fire their own.
 *
 * A failure resolves to an empty list rather than throwing — not knowing your
 * colleagues' names should cost you the @ picker, not the comment box.
 */
let cache: TeamMember[] | null = null;
let inflight: Promise<TeamMember[]> | null = null;

export function loadTeamMembers(): Promise<TeamMember[]> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = salesDashboardApi
      .assignableUsers()
      .then((rows) => {
        cache = rows.map((r) => ({ user_id: r.user_id, name: r.name ?? "" })).filter((r) => r.name !== "");
        return cache;
      })
      .catch(() => [])
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Drops the cache — call after someone is added or renamed. */
export function invalidateTeamMembers(): void {
  cache = null;
}

export function useTeamMembers(enabled = true): TeamMember[] {
  const [members, setMembers] = useState<TeamMember[]>(cache ?? []);

  useEffect(() => {
    if (!enabled || cache) return;
    let cancelled = false;
    void loadTeamMembers().then((rows) => {
      if (!cancelled) setMembers(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return cache ?? members;
}
