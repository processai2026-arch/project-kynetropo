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

  watchForNewBuild();

  // A newly activated worker takes control — reload once so the fresh build is
  // actually running. The guard stops this from looping.
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  });
}

/**
 * Picks up a deploy in an app that was left open.
 *
 * sw.js itself does not change between deploys, so the worker never reports an
 * update: an installed app kept in the background would run the old build until
 * it was closed for good. Instead, whenever the app comes back to the screen (at
 * most once a minute), index.html is fetched fresh and its entry script compared
 * with the one running; a different one means a new build, and the page reloads.
 * Never on a form, where a reload would throw away what was typed.
 */
function watchForNewBuild(): void {
  const entry = /\/assets\/index-[\w-]+\.js/;
  const running = Array.from(document.scripts).map((s) => s.src.match(entry)?.[0]).find(Boolean);
  if (!running) return;

  let lastCheck = Date.now();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || Date.now() - lastCheck < 60_000) return;
    lastCheck = Date.now();
    if (/\/(new|edit|convert)$/.test(window.location.pathname)) return;
    fetch("/index.html", { cache: "no-store" })
      .then((res) => (res.ok ? res.text() : ""))
      .then((html) => {
        const latest = html.match(entry)?.[0];
        if (latest && latest !== running) window.location.reload();
      })
      .catch(() => {
        /* Offline or a hiccup: try again next time the app comes back. */
      });
  });
}
