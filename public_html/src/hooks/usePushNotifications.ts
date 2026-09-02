import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";

/**
 * Notifications that arrive when the app is closed.
 *
 * The in-app alerts only exist while a tab is open and polling. This registers
 * the browser with its own push service, so the server can reach the person
 * afterwards — a task assigned at 9pm arrives at 9pm.
 *
 * Three things have to line up, and any of them can be missing: the browser
 * must support push at all, the user must grant permission, and the server must
 * have VAPID keys configured. The status below says which one is in the way,
 * because "notifications aren't working" is otherwise unanswerable.
 */

export type PushState =
  | "unsupported"   // this browser cannot do it
  | "unconfigured"  // the server has no keys
  | "denied"        // blocked in browser settings
  | "off"           // available, not yet turned on
  | "on";           // subscribed

interface Envelope<T> {
  data: T;
}

/** The VAPID key travels as base64url; PushManager wants raw bytes. */
function urlBase64ToUint8Array(value: string): Uint8Array {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function keyToBase64(sub: PushSubscription, name: "p256dh" | "auth"): string {
  const key = sub.getKey(name);
  if (!key) return "";
  const bytes = new Uint8Array(key);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function supported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function usePushNotifications() {
  const [state, setState] = useState<PushState>("off");
  const [busy, setBusy] = useState(false);
  const [publicKey, setPublicKey] = useState("");

  useEffect(() => {
    let live = true;
    if (!supported()) {
      setState("unsupported");
      return;
    }

    void (async () => {
      try {
        const res = await apiFetch<Envelope<{ enabled: boolean; public_key: string }>>("/admin/push/key");
        if (!live) return;
        if (!res.data.enabled || !res.data.public_key) {
          setState("unconfigured");
          return;
        }
        setPublicKey(res.data.public_key);

        if (Notification.permission === "denied") {
          setState("denied");
          return;
        }
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (!live) return;
        setState(existing && Notification.permission === "granted" ? "on" : "off");
      } catch {
        // A server that cannot answer is treated as not configured rather than
        // broken: the button then says so instead of failing on being pressed.
        if (live) setState("unconfigured");
      }
    })();

    return () => {
      live = false;
    };
  }, []);

  const enable = useCallback(async (): Promise<PushState> => {
    if (!supported() || !publicKey) return state;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        const next: PushState = permission === "denied" ? "denied" : "off";
        setState(next);
        return next;
      }

      const reg = await navigator.serviceWorker.ready;
      // Reuse the existing subscription where there is one: re-subscribing
      // generates a new endpoint and orphans the row already on the server.
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }));

      await apiFetch("/admin/push/subscribe", {
        method: "POST",
        body: JSON.stringify({
          endpoint: sub.endpoint,
          p256dh: keyToBase64(sub, "p256dh"),
          auth: keyToBase64(sub, "auth"),
        }),
      });

      setState("on");
      return "on";
    } catch {
      setState("off");
      return "off";
    } finally {
      setBusy(false);
    }
  }, [publicKey, state]);

  const disable = useCallback(async (): Promise<void> => {
    if (!supported()) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        // Tell the server first: unsubscribing locally loses the endpoint, and
        // the row would then sit there failing forever.
        await apiFetch("/admin/push/unsubscribe", {
          method: "POST",
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => undefined);
        await sub.unsubscribe().catch(() => undefined);
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  }, []);

  /** Sends one to this account, so the whole chain can be proved in a tap. */
  const sendTest = useCallback(async (): Promise<string> => {
    const res = await apiFetch<{ message?: string }>("/admin/push/test", { method: "POST" });
    return res.message ?? "Sent";
  }, []);

  return { state, busy, enable, disable, sendTest };
}

/**
 * Keeps the server's copy of this device fresh.
 *
 * A subscription can be replaced by the browser without the app being told, and
 * a shared device must follow whoever is signed in now. Re-registering on
 * startup costs one request and prevents both.
 */
export function useKeepPushRegistered(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || !supported() || Notification.permission !== "granted") return;
    let live = true;

    void (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!sub || !live) return;
        await apiFetch("/admin/push/subscribe", {
          method: "POST",
          body: JSON.stringify({
            endpoint: sub.endpoint,
            p256dh: keyToBase64(sub, "p256dh"),
            auth: keyToBase64(sub, "auth"),
          }),
        });
      } catch {
        /* Not being able to refresh is not worth telling anyone about. */
      }
    })();

    return () => {
      live = false;
    };
  }, [enabled]);
}
