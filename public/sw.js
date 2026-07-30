// Bumping the cache name forces every browser to drop the previous SW
// version and reinstall fresh — that's important after the auth-bypass
// added below, otherwise users keep running the old SW that still
// intercepts /auth/* navigations. (v4: push + notificationclick handlers for
// the opt-in Life Panel reminders, founder decision 2026-07-30.)
const CACHE_NAME = "willab-shell-v4";
const SHELL_ASSETS = ["/", "/manifest.webmanifest", "/icon"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  // Auth flows: never intercept. OAuth callback chains (LinkedIn →
  // Supabase → /auth/callback → /auth/oauth-complete) carry single-use
  // state tokens; any SW-level fetch/replay can cause Supabase to see
  // the same state twice and reject with "flow_state_already_used".
  // Letting the browser handle /auth/* directly removes the SW from
  // the OAuth network path entirely.
  try {
    const authUrl = new URL(request.url);
    if (authUrl.pathname.startsWith("/auth/")) {
      return; // browser handles directly, no SW interception
    }
  } catch {
    /* URL parse failed — fall through to normal handling */
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match("/")) || Response.error();
      })
    );
    return;
  }

  // Never cache API: homework/admin state must always be fresh (PWA was serving stale JSON on phone).
  try {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      event.respondWith(fetch(request));
      return;
    }
  } catch {
    event.respondWith(fetch(request));
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== "basic") {
            return response;
          }
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone).catch(() => {});
          });
          return response;
        })
        .catch(() => cached || Response.error());
    })
  );
});

// Life Panel reminders (founder decision 2026-07-30) — OPT-IN ONLY. A push
// only ever arrives because the user enabled a reminder slot in the panel
// settings; the backend sends nothing to anyone who did not. Payload is
// {title, body, url}; anything malformed degrades to a plain card pointing
// at today's check-in.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = typeof data.title === "string" && data.title ? data.title : "WillpowerLab";
  const body = typeof data.body === "string" ? data.body : "";
  const url = typeof data.url === "string" && data.url ? data.url : "/panel/today";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      data: { url },
      icon: "/icon",
      badge: "/icon",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url =
    (event.notification.data && event.notification.data.url) || "/panel/today";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windows) => {
        for (const client of windows) {
          if ("focus" in client) {
            if ("navigate" in client) {
              client.navigate(url).catch(() => {});
            }
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      })
  );
});

