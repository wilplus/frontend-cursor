// Bumping the cache name forces every browser to drop the previous SW
// version and reinstall fresh — that's important after the auth-bypass
// added below, otherwise users keep running the old SW that still
// intercepts /auth/* navigations. (v4: push + notificationclick handlers for
// the opt-in Life Panel reminders, founder decision 2026-07-30.)
//
// v5 (2026-08-04) — THE BUMP IS PART OF THE FIX, not housekeeping. The old
// fetch handler was cache-first for every non-API GET with nothing ever
// evicting, so a browser holding a bad mix of build assets could not be
// talked out of it by a reload: a cache-name bump was the ONLY flush there
// was. That is why the module-scope throw in life/menu (fixed in the same
// change) read to users as "the app is gone" rather than "the app is broken
// until someone deploys". `activate` deletes every cache whose name is not
// this one, so the new name empties the old contents.
//
// The policy below replaces the one-size-fits-all rule that made the bump
// necessary in the first place, so this should be the last bump that has to
// rescue anybody rather than just tidy up.
const CACHE_NAME = "willab-shell-v5";
const SHELL_ASSETS = ["/", "/manifest.webmanifest", "/icon"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Navigation preload recovers most of what network-first costs on HTML:
      // the browser starts the navigation request in parallel with booting
      // this worker, instead of after it. Without it, every navigation pays
      // SW startup before the request even leaves. Not supported everywhere,
      // hence the guard — where it is missing we simply fetch as normal.
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable().catch(() => {});
      }
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })()
  );
  self.clients.claim();
});

/* ────────────────────────────────────────────────────────────────────────
   CACHING POLICY — sorted by whether a URL's content can change (2026-08-04)

   One policy for everything is what got us here. The right question per
   request is not "how fresh do we want this" but "CAN this URL's bytes
   change?", because that decides whether staleness is even possible.

     1. /auth/*        never intercepted. OAuth state tokens are single-use.
     2. /api/*         network only. User state is never served from a cache.
     3. navigations    NETWORK-FIRST, cache only as an offline fallback.
                       HTML names which JS to load, so a stale document is
                       how a browser ends up running last week's app. This
                       is also what makes a bad deploy fixable: fix the
                       server, refresh, done — no cache bump, no waiting.
     4. /_next/static/ CACHE-FIRST. The filename contains a hash of the
                       bytes, so the same URL cannot ever mean different
                       content. Staleness is impossible by construction, and
                       network-first here would buy nothing while adding a
                       round trip to every chunk on every load.
     5. everything else STALE-WHILE-REVALIDATE. Icons, images, the manifest,
                       the pdf worker: stable URLs whose content CAN change.
                       Cache-first meant they were frozen until someone
                       bumped the cache name. Serve the cached copy for
                       speed, refresh it in the background, converge next
                       load. They are not load-bearing enough to block paint
                       on, which is exactly why they are not (3).

   Reads are scoped to `caches.open(CACHE_NAME)` rather than the global
   `caches.match`, which searches EVERY cache including old versions this
   worker has not deleted yet. That is what makes a cache-name bump take
   effect immediately instead of eventually.
   ──────────────────────────────────────────────────────────────────────── */

/** Content-addressed build output: the hash in the filename IS the version. */
function isImmutableBuildAsset(url) {
  return url.pathname.startsWith("/_next/static/");
}

/** Store a response, if it is one we are allowed to replay.
 *  `basic` excludes opaque cross-origin responses, whose status we cannot
 *  even read — caching those would mean caching failures as successes. */
async function putInCache(request, response) {
  if (!response || response.status !== 200 || response.type !== "basic") return;
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  } catch {
    /* Quota, or a response that cannot be cloned. Never fatal to the page. */
  }
}

async function cachedCopy(request) {
  try {
    const cache = await caches.open(CACHE_NAME);
    return await cache.match(request);
  } catch {
    return undefined;
  }
}

/** (3) Network-first. The cache is the OFFLINE answer, not the fast path. */
async function navigateNetworkFirst(event) {
  try {
    // Started by the browser in parallel with this worker booting.
    const preloaded = await event.preloadResponse;
    if (preloaded) return preloaded;
    return await fetch(event.request);
  } catch {
    // Offline, or the network failed. `/` is the precached app shell; the
    // client router takes it from there.
    return (
      (await cachedCopy(event.request)) ||
      (await cachedCopy("/")) ||
      Response.error()
    );
  }
}

/** (4) Cache-first, safe only because the URL is content-addressed. */
async function immutableCacheFirst(event) {
  const cached = await cachedCopy(event.request);
  if (cached) return cached;
  try {
    const response = await fetch(event.request);
    event.waitUntil(putInCache(event.request, response));
    return response;
  } catch {
    return Response.error();
  }
}

/** (5) Serve now, refresh for next time. */
async function staleWhileRevalidate(event) {
  const cached = await cachedCopy(event.request);

  const revalidate = fetch(event.request)
    .then(async (response) => {
      await putInCache(event.request, response);
      return response;
    })
    .catch(() => null);

  if (cached) {
    // `waitUntil` is what keeps the refresh alive after we have already
    // answered — without it the worker can be killed mid-revalidation and
    // the entry never updates, which is cache-first wearing a new hat.
    event.waitUntil(revalidate);
    return cached;
  }

  return (await revalidate) || Response.error();
}

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return; // Cannot classify it, so do not touch it.
  }

  // (1) Auth flows: never intercept. OAuth callback chains (LinkedIn →
  // Supabase → /auth/callback → /auth/oauth-complete) carry single-use
  // state tokens; any SW-level fetch/replay can cause Supabase to see
  // the same state twice and reject with "flow_state_already_used".
  // Letting the browser handle /auth/* directly removes the SW from
  // the OAuth network path entirely.
  if (url.pathname.startsWith("/auth/")) return;

  // (2) Never cache API: homework/admin state must always be fresh (PWA was
  // serving stale JSON on phone).
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(navigateNetworkFirst(event));
    return;
  }

  if (isImmutableBuildAsset(url)) {
    event.respondWith(immutableCacheFirst(event));
    return;
  }

  event.respondWith(staleWhileRevalidate(event));
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

