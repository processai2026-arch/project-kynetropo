import { useQuery } from "@tanstack/react-query";
import { salesAccessApi } from "@/lib/api/sales";
import type { SalesMe } from "@/types/sales";

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

  const permissions = data?.permissions ?? [];

  const can = (permission: string) => permissions.includes(permission);
  const canAny = (...list: string[]) => list.some((p) => permissions.includes(p));

  return {
    me: data,
    loading: isLoading,
    error: error instanceof Error ? error : null,
    permissions,
    can,
    canAny,
    isSalesAdmin: data?.is_admin ?? false,
    /** No sales permission at all — the module should not be offered. */
    hasNoAccess: !isLoading && !error && permissions.length === 0,
  };
}
