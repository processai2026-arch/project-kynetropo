import { useQuery } from "@tanstack/react-query";
import { salesAccessApi } from "@/lib/api/sales";
import { useSalesViewAs } from "@/hooks/useSalesViewAs";
import type { SalesMe } from "@/types/sales";

/**
 * The permissions that survive while looking at a colleague's work.
 *
 * Everything that ends in .view (and view_all) is about reading; everything
 * else — create, edit, assign, convert, complete, accept, manage — would act
 * as the real caller on somebody else's record, which is exactly what the
 * server refuses. Keeping the rule to one line means a permission added later
 * is read-only by default while viewing, which is the safe way round.
 */
function readOnly(permissions: string[]): string[] {
  return permissions.filter((p) => p.endsWith(".view") || p.endsWith(".view_all"));
}

/**
 * The caller's own sales permissions, used to decide what to render.
 *
 * This is a convenience only — it is NOT the security boundary. Every sales
 * endpoint re-checks the permission and the record-level access server-side,
 * so hiding a button here never becomes the thing that keeps a user out.
 */
export function useSalesAccess() {
  const { data, isLoading, error } = useQuery<SalesMe>({
    queryKey: ["sales", "me"],
    queryFn: salesAccessApi.me,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const { viewAs } = useSalesViewAs();
  const granted = data?.permissions ?? [];
  const permissions = viewAs ? readOnly(granted) : granted;

  const can = (permission: string) => permissions.includes(permission);
  const canAny = (...list: string[]) => list.some((p) => permissions.includes(p));

  return {
    me: data,
    /** The colleague being viewed, or null when looking at your own work. */
    viewAs,
    loading: isLoading,
    error: error instanceof Error ? error : null,
    permissions,
    can,
    canAny,
    // Not while viewing: the admin affordances (deleting anyone's comment,
    // seeing deleted ones) are edits, and this is a reading session.
    isSalesAdmin: !viewAs && (data?.is_admin ?? false),
    /** Set when a missed challenge destroyed this user's access to the app. */
    lockout: data?.lockout ?? null,
    /** No sales permission at all — the module should not be offered. */
    hasNoAccess: !isLoading && !error && permissions.length === 0,
  };
}
