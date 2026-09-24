/**
 * Service worker registration.
 *
 * Registered only in a production build served over HTTPS (or localhost) — a
 * worker in dev would cache the dev server's modules and cause very confusing
 * stale-code bugs.
 *
 * Every failure path is swallowed: the app must work identically whether or not
 * the worker registers. Installability is a convenience, never a dependency.
 */
export function registerServiceWorker(): void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  // Vite replaces import.meta.env.DEV at build time.
  if (import.meta.env.DEV) return;

  const secure = window.isSecureContext || window.location.hostname === "localhost";
  if (!secure) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        // When a new build is waiting, activate it rather than leaving the user
        // pinned to the old one until every tab closes.
        const promote = () => {
          const waiting = registration.waiting;
          if (waiting) waiting.postMessage("SKIP_WAITING");
        };
        promote();
        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) promote();
          });
        });
      })
      .catch(() => {
        /* Registration is best-effort; the app works without it. */
      });
  });

  // A newly activated worker takes control — reload once so the fresh build is
  // actually running. The guard stops this from looping.
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  });
}
