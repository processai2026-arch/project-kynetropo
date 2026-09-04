/*
 * Kynetropo service worker.
 *
 * Scope is deliberately narrow. The one rule that must never be broken:
 * ANYTHING UNDER /api/ IS NEVER TOUCHED. Those responses are authenticated and
 * per-user; caching them could serve one salesperson another's leads, or leave
 * data readable on the device after logout. Those requests fall through to the
 * network without the worker intercepting them at all.
 *
 * What is cached:
 *   /assets/*  content-hashed by the build, therefore immutable -> cache-first
 *   icons etc. small, stable static files                       -> cache-first
 *   navigations                                                 -> network-first,
 *              falling back to the cached shell so the app opens offline
 *
 * Navigations are network-first on purpose: a deploy changes index.html, and a
 * cache-first shell would pin users to a stale build.
 */

const VERSION = 'kyn-v1';
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;

// Backoff between retries of a static asset. Three attempts in just over a
// second and a half: long enough to ride out a mobile hiccup, short enough
// that a genuinely offline user is not left staring at a blank route.
const RETRY_DELAYS = [250, 600, 1200];
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const SHELL_URL = '/index.html';

// Precache only the shell and the icons — everything else arrives on demand.
const PRECACHE = [SHELL_URL, '/icon-192.png', '/icon-512.png', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // Individually, so one 404 cannot fail the whole install.
      .then((cache) => Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => undefined))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

/** Lets a new build take over without the user force-closing the app. */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only ever deal with same-origin GETs.
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  // The API is off limits — do not intercept, do not cache, ever.
  if (url.pathname.startsWith('/api/')) return;

  // App navigations: network-first, cached shell as the offline fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(SHELL_URL, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() =>
          caches
            .match(SHELL_URL)
            .then((cached) => cached || new Response('Offline', { status: 503, statusText: 'Offline' })),
        ),
    );
    return;
  }

  // Build output is content-hashed, so a cache hit is always correct.
  const isStatic =
    url.pathname.startsWith('/assets/') ||
    /\.(?:js|css|woff2?|ttf|png|jpg|jpeg|svg|ico|webmanifest|mjs)$/.test(url.pathname);

  if (!isStatic) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      // Retry before giving up.
      //
      // A lazy route chunk that fails to load does not degrade -- the dynamic
      // import throws "Failed to fetch dynamically imported module" and the
      // whole page falls to the error boundary. On a weak mobile connection a
      // single dropped request was enough to do that, and the user was left on
      // an error screen for a file that was sitting on the server the whole
      // time. Assets are content-hashed and immutable, so asking again is
      // always safe and always for the same bytes.
      const attempt = (tries) =>
        fetch(request)
          .then((response) => {
            if (response && response.ok && response.type === 'basic') {
              const copy = response.clone();
              caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
              return response;
            }
            // A 5xx from a flaky edge is worth retrying; a 404 is not.
            if (response && response.status >= 500 && tries > 0) {
              return wait(RETRY_DELAYS[RETRY_DELAYS.length - tries]).then(() => attempt(tries - 1));
            }
            return response;
          })
          .catch((err) => {
            if (tries > 0) {
              return wait(RETRY_DELAYS[RETRY_DELAYS.length - tries]).then(() => attempt(tries - 1));
            }
            throw err;
          });

      return attempt(RETRY_DELAYS.length).catch(() => Response.error());
    }),
  );
});

/*
 * ── Push notifications ──────────────────────────────────────────────────────
 *
 * These handlers are why a notification arrives when the app is closed. The
 * push service wakes this worker, it draws the notification, and a tap brings
 * the app to the exact screen the notification is about.
 *
 * Everything here is defensive: a malformed payload must still produce a
 * notification, because a browser that receives a push and shows nothing is
 * permitted to revoke the permission entirely.
 */

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Kynetropo';
  const url = typeof data.url === 'string' && data.url.startsWith('/') ? data.url : '/sales';

  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      // Repeats about the same thing replace each other rather than stacking.
      tag: data.tag || url,
      renotify: true,
      // The url has to survive the round trip to the tap handler; notification
      // data is the only thing that does.
      data: { url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const target = (event.notification.data && event.notification.data.url) || '/sales';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Prefer a tab that is already open: focusing it and navigating keeps the
      // person in the session they already have, rather than cold-starting a
      // second copy of the app.
      for (const client of clients) {
        if ('focus' in client) {
          const focused = client.focus();
          if ('navigate' in client) {
            return Promise.resolve(focused).then(() => client.navigate(target)).catch(() => client.focus());
          }
          return focused;
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});

/*
 * The push service can retire a subscription on its own — a browser update, a
 * long silence. The event carries the replacement, and the app re-registers it
 * the next time it is opened; nothing is lost by ignoring it here beyond one
 * missed notification.
 */
self.addEventListener('pushsubscriptionchange', () => {
  // Intentionally empty: re-subscribing needs the VAPID key and a signed-in
  // session, neither of which the worker has on its own.
});
