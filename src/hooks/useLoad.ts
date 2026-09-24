import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "@/lib/api/errors";

/**
 * Load one resource for a detail/print page: `useEffect + useState`, the
 * mpTV-erp data pattern, with a stale-response guard and `reload()`.
 */
export function useLoad<T>(loader: () => Promise<{ data: T }>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const reload = useCallback(async () => {
    const mine = ++seq.current;
    setLoading(true);
    try {
      const res = await loader();
      if (mine === seq.current) {
        setData(res.data);
        setError(null);
      }
    } catch (e) {
      if (mine === seq.current) setError(errorMessage(e));
    } finally {
      if (mine === seq.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, setData, loading, error, reload };
}

export default useLoad;
