import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { salesDashboardApi, type SalesNotification } from "@/lib/api/sales";

const POLL_MS = 60_000;
/** Alert keys already shown, so a repeated poll doesn't re-announce them. */
const SEEN_STORAGE_KEY = "kyn_sales_seen_alerts";

function loadSeen(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SEEN_STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveSeen(seen: Set<string>): void {
  try {
    // Bounded, so a long session can't grow this without limit.
    sessionStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify([...seen].slice(-200)));
  } catch {
    /* Private mode or storage disabled — in-memory only is fine. */
  }
}

function canNotify(): boolean {
  return typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted";
}

/** Raises a real OS notification, falling back to an in-app toast. */
function announce(item: SalesNotification, navigate: (url: string) => void): void {
  if (canNotify()) {
    try {
      const n = new Notification(item.title, {
        body: item.body,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: item.key, // collapses duplicates in the tray
      });
      n.onclick = () => {
        window.focus();
        navigate(item.url);
        n.close();
      };
      return;
    } catch {
      /* Some browsers throw when constructing from a page; fall through. */
    }
  }

  const show = item.severity === "urgent" ? toast.warning : toast.info;
  show(item.title, {
    description: item.body,
    action: { label: "Open", onClick: () => navigate(item.url) },
  });
}

/**
 * Polls the server for things the salesperson needs to know about — follow-ups
 * due or overdue, meetings starting soon, challenges appearing or running out —
 * and announces anything not already seen.
 *
 * The server decides what is due, using its own clock; this hook only decides
 * what has already been shown. Notifications appear while the app is open. True
 * background delivery would need Web Push (VAPID keys and a push service),
 * which is not set up — so nothing here claims to work when the app is closed.
 */
export function useSalesNotifications(enabled: boolean, navigate: (url: string) => void): void {
  const seenRef = useRef<Set<string>>(loadSeen());
  const navRef = useRef(navigate);
  navRef.current = navigate;
  /** First poll only records what exists; it must not fire a burst of alerts. */
  const primedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let timer: number | undefined;

    const poll = async () => {
      try {
        const { items } = await salesDashboardApi.notifications();
        if (cancelled) return;

        const fresh = items.filter((i) => !seenRef.current.has(i.key));
        for (const item of fresh) seenRef.current.add(item.key);
        saveSeen(seenRef.current);

        if (primedRef.current) {
          // Urgent first, and never more than three at once.
          [...fresh]
            .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "urgent" ? -1 : 1))
            .slice(0, 3)
            .forEach((item) => announce(item, navRef.current));
        } else {
          primedRef.current = true;
        }
      } catch {
        /* Offline or a transient failure — the next tick tries again. */
      } finally {
        if (!cancelled) timer = window.setTimeout(poll, POLL_MS);
      }
    };

    void poll();
    // Coming back to the app is the moment a salesperson most wants to be current.
    const onVisible = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled]);
}

/**
 * Asks for notification permission once, on a real user gesture.
 * Browsers reject (and users resent) prompts fired on page load.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}
