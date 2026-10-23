import { useEffect, useState } from "react";

/**
 * Installing the app (Kynetropo in the Start menu / on the home screen) — the same as Diamond Fencing.
 *
 * Chrome and Edge fire `beforeinstallprompt` once, early, when the site can be
 * installed — often before the header has mounted — so it is caught here at
 * import time (main.tsx imports this module) and kept until someone presses
 * Install. Safari has no such event: there it is Share → Add to Home Screen.
 */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // we show our own button instead of the browser's mini bar
    deferred = e as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

/** Already running as the installed app (its own window), not in a browser tab. */
export function isInstalledApp(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

/** `canInstall` is true only while the browser offers an install and we are not already the app. */
export function useInstallApp(): { canInstall: boolean; install: () => Promise<boolean> } {
  const [, rerender] = useState(0);
  useEffect(() => {
    const l = () => rerender((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  const install = async () => {
    const e = deferred;
    if (!e) return false;
    await e.prompt();
    const { outcome } = await e.userChoice;
    // The event can be used once; Chrome fires a fresh one if the person may try again.
    deferred = null;
    notify();
    return outcome === "accepted";
  };

  return { canInstall: !!deferred && !isInstalledApp(), install };
}
