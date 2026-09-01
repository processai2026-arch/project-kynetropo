import { useEffect, useState } from "react";
import { salesDashboardApi } from "@/lib/api/sales";

export interface TeamMember {
  user_id: number;
  name: string;
  email: string;
  /** Somebody else on the team answers to this same name. */
  ambiguous: boolean;
}

/**
 * Flags every name held by more than one account.
 *
 * Worked out once here rather than in each picker, so the challenge form, the
 * task form and the @ menu all draw the same conclusion about who needs their
 * email shown.
 */
function flagNamesakes(rows: { user_id: number; name: string; email: string }[]): TeamMember[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const key = r.name.trim().toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return rows.map((r) => ({ ...r, ambiguous: (counts.get(r.name.trim().toLowerCase()) ?? 0) > 1 }));
}

/** The email, but only when the name alone does not identify the person. */
export function namesakeHint(person: TeamMember): string | null {
  return person.ambiguous && person.email ? person.email : null;
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
        cache = flagNamesakes(
          rows
            .map((r) => ({ user_id: r.user_id, name: r.name ?? "", email: r.email ?? "" }))
            .filter((r) => r.name !== ""),
        );
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
