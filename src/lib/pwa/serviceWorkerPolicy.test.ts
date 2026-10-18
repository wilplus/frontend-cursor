/* -------------------------------------------------------------------------- */
/*  public/sw.js — the caching policy, held (2026-08-04)                       */
/*                                                                            */
/*  The service worker had no tests, and it is the layer that turned a bug     */
/*  into an outage nobody could reload their way out of: one cache-first rule  */
/*  for every non-API GET, nothing ever evicting, so a browser holding a bad   */
/*  mix of build assets stayed broken until someone bumped the cache name.     */
/*                                                                            */
/*  sw.js cannot be imported — it is a worker script that reads `self`,        */
/*  `caches` and `fetch` off a global scope that does not exist in node. So it */
/*  is EVALUATED here against a fake scope, and the real file is the thing     */
/*  under test rather than a copy of its logic. A policy change in sw.js that  */
/*  nobody meant to make fails here.                                          */
/* -------------------------------------------------------------------------- */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import runInContext from "node:vm";
import { beforeEach, describe, expect, it } from "vitest";

const SW_SOURCE = readFileSync(
  fileURLToPath(new URL("../../../public/sw.js", import.meta.url)),
  "utf8"
);

const ORIGIN = "https://willpowerlab.com";

type Handler = (event: any) => void;

interface Scope {
  fetchHandler: Handler;
  activateHandler: Handler;
  installHandler: Handler;
  pushHandler: Handler;
  notificationClickHandler: Handler;
  /** True once the worker has committed to taking over. */
  skipWaitingCalled: () => boolean;
  /** Everything the worker actually wrote, by URL. */
  store: Map<string, string>;
  /** Every URL the worker went to the network for. */
  networkCalls: string[];
  /** Cache names that exist. The worker deletes the ones it does not own. */
  cacheNames: Set<string>;
  /** Every name the worker opened, in order. The first one IS `CACHE_NAME`. */
  cachesOpened: string[];
  setNetwork: (fn: (url: string) => any) => void;
}

/** A response the worker will consider cacheable (200 + same-origin). */
function ok(body: string, extra: { redirected?: boolean } = {}) {
  return {
    status: 200,
    ok: true,
    type: "basic",
    redirected: extra.redirected ?? false,
    headers: {},
    body,
    async blob() {
      return body;
    },
    clone() {
      return ok(body, extra);
    },
  };
}

function notFound() {
  return {
    status: 404,
    ok: false,
    type: "basic",
    redirected: false,
    headers: {},
    body: "not found",
    async blob() {
      return "not found";
    },
    clone() {
      return notFound();
    },
  };
}

/** Boot the real sw.js against a fake scope.
 *
 *  `swUrl` is the worker's OWN location, which since 2026-09-18 is where the
 *  cache name comes from: the registrar registers `/sw.js?v=<build id>` and the
 *  worker reads that back off `self.location`. Defaulting it to the versionless
 *  path keeps every policy test below describing the policy rather than the
 *  version — the two tests that care pass one explicitly. */
function bootWorker(swUrl: string = `${ORIGIN}/sw.js`): Scope {
  const handlers: Record<string, Handler> = {};
  const store = new Map<string, string>();
  const cacheNames = new Set<string>(["willab-shell-v4", "some-other-cache"]);
  const cachesOpened: string[] = [];
  const networkCalls: string[] = [];
  let network = (url: string) => ok(`fresh:${url}`);

  /** The real Cache API resolves a string key against the worker's scope, so
   *  `cache.match("/")` finds the entry stored for the absolute URL. The fake
   *  has to do the same or it tests its own shortcut rather than sw.js. */
  const keyOf = (req: any) =>
    new URL(typeof req === "string" ? req : req.url, ORIGIN).toString();

  const cacheFor = () => ({
    match: async (req: any) => {
      const hit = store.get(keyOf(req));
      return hit ? ok(hit) : undefined;
    },
    put: async (req: any, res: any) => {
      // The real Cache API REFUSES a redirected response. Modelling that is
      // the only way this suite can see the install bug it exists to catch.
      if (res?.redirected) {
        throw new TypeError("Cache.put() encountered a redirected response");
      }
      store.set(keyOf(req), res.body);
    },
    addAll: async (urls: string[]) => {
      // Atomic, exactly like the real thing: any failure rejects the lot.
      const responses = urls.map((u) => network(new URL(u, ORIGIN).toString()));
      for (const r of responses) {
        if (r?.redirected) {
          throw new TypeError("Cache.put() encountered a redirected response");
        }
        if (r?.ok === false) throw new TypeError("Request failed");
      }
      urls.forEach((u, i) => store.set(keyOf(u), responses[i].body));
    },
  });

  let skipWaiting = false;
  const scope: any = {
    // A real ServiceWorkerGlobalScope always has one, and it is the script URL
    // the page registered — query string included.
    location: { href: swUrl },
    addEventListener: (name: string, fn: Handler) => {
      handlers[name] = fn;
    },
    skipWaiting: () => {
      skipWaiting = true;
    },
    clients: { claim: () => {} },
    registration: {
      navigationPreload: { enable: async () => {} },
    },
  };

  const sandbox: any = {
    self: scope,
    caches: {
      open: async (name: string) => {
        // `caches.open` CREATES the cache if it is absent, so a name the worker
        // has opened is a name `caches.keys()` reports — which is what makes
        // "activate deletes everything else but keeps its own" observable.
        cachesOpened.push(name);
        cacheNames.add(name);
        return cacheFor();
      },
      keys: async () => [...cacheNames],
      delete: async (name: string) => cacheNames.delete(name),
      // Deliberately absent from the policy: the worker must scope reads to
      // its OWN cache, not search every cache on the origin.
      match: async () => {
        throw new Error("sw.js must not use the global caches.match");
      },
    },
    fetch: async (req: any) => {
      const url = typeof req === "string" ? req : req.url;
      networkCalls.push(url);
      return network(url);
    },
    Response: { error: () => ({ status: 0, type: "error", body: "" }) },
    URL,
    setTimeout,
  };
  sandbox.globalThis = sandbox;

  runInContext.createContext(sandbox);
  runInContext.runInContext(SW_SOURCE, sandbox);

  return {
    fetchHandler: handlers.fetch,
    activateHandler: handlers.activate,
    installHandler: handlers.install,
    pushHandler: handlers.push,
    notificationClickHandler: handlers.notificationclick,
    skipWaitingCalled: () => skipWaiting,
    store,
    networkCalls,
    cacheNames,
    cachesOpened,
    setNetwork: (fn) => {
      network = fn;
    },
  };
}

/** How many times the last request called `waitUntil`.
 *
 *  This is the only way to observe "the background refresh was KEPT ALIVE".
 *  A revalidation promise that is merely created still settles here, because
 *  nothing in a test harness kills an idle worker the way a phone does — so
 *  asserting on the refreshed VALUE alone cannot tell a real
 *  stale-while-revalidate from a cache-first that happens to fire a fetch it
 *  never waits for. The browser can and will kill that one mid-flight. */
let lastWaitUntilCount = 0;

/** Drive one request through the worker and return what the page received. */
async function request(
  sw: Scope,
  url: string,
  init: { mode?: string; method?: string; preload?: any; destination?: string; range?: boolean } = {}
) {
  const req = {
    url,
    method: init.method ?? "GET",
    mode: init.mode ?? "cors",
    destination: init.destination ?? "",
    headers: { has: (name: string) => init.range === true && name.toLowerCase() === "range" },
  };
  let responded: Promise<any> | null = null;
  const pending: Promise<any>[] = [];
  lastWaitUntilCount = 0;

  sw.fetchHandler({
    request: req,
    preloadResponse: Promise.resolve(init.preload),
    respondWith: (p: Promise<any>) => {
      responded = Promise.resolve(p);
    },
    waitUntil: (p: Promise<any>) => {
      lastWaitUntilCount += 1;
      pending.push(Promise.resolve(p).catch(() => {}));
    },
  });

  // `null` means the worker declined to intercept: the browser handles it.
  if (responded === null) {
    await Promise.all(pending);
    return null;
  }
  const result = await responded;
  await Promise.all(pending);
  return result;
}

describe("the service worker caching policy", () => {
  let sw: Scope;
  beforeEach(() => {
    sw = bootWorker();
  });

  it("never intercepts the API AT ALL — it stands aside, like /auth/*", async () => {
    // STRONGER THAN "never cached" (2026-09-17). The worker used to answer an
    // API GET with `respondWith(fetch(request))`. Nothing was cached, so the
    // old name was true — but calling respondWith means the worker OWNS the
    // response, and a network failure then reaches the page as an SW error
    // ("Response served by service worker is an error") instead of an
    // ordinary failed request: no status code to read, and callers that
    // discriminate on status — the part-lock route returns two different 409s
    // that mean opposite things — cannot tell them apart. Seen on a phone,
    // on two GETs the server never refused.
    //
    // So the rule is now the same one /auth/* gets: do not touch it. The
    // browser performs the request itself and its failures stay legible.
    expect(
      await request(sw, "https://willpowerlab.com/api/v2/life/state")
    ).toBeNull();
    expect(sw.networkCalls).toHaveLength(0);
    expect([...sw.store.keys()]).not.toContain(
      "https://willpowerlab.com/api/v2/life/state"
    );
  });

  it("never intercepts media: audio, video, or any Range read", async () => {
    // Players read byte ranges (206) and must see their own errors to ask for
    // a fresh signed link (founder 2026-10-08). Same-origin or not, cached
    // copy or not, the worker stands aside.
    sw.store.set(`${ORIGIN}/clip.webm`, "cached clip");
    expect(await request(sw, `${ORIGIN}/clip.webm`, { destination: "audio" })).toBeNull();
    expect(await request(sw, `${ORIGIN}/coach.mp4`, { destination: "video" })).toBeNull();
    expect(await request(sw, `${ORIGIN}/clip.webm`, { range: true })).toBeNull();
    expect(sw.networkCalls).toHaveLength(0);
  });
});

/* -------------------------------------------------------------------------- */
/*  INSTALL — the rescue path, which must never be blockable                   */
/*                                                                            */
/*  v5 shipped a correct caching policy that reached nobody: install used      */
/*  `cache.addAll`, which is atomic, and `cache.put` rejects a redirected      */
/*  response. All three shell assets run through the middleware, which         */
/*  redirects. So the install failed, the worker never activated, and every    */
/*  browser stayed pinned to the worker it already had — through every reload  */
/*  and every deploy. These tests exist so that cannot come back.              */
/* -------------------------------------------------------------------------- */

/** Run the install handler and report whether it survived. */
async function install(sw: Scope) {
  const pending: Promise<any>[] = [];
  sw.installHandler({ waitUntil: (p: Promise<any>) => pending.push(p) });
  try {
    await Promise.all(pending);
    return { installed: true as const };
  } catch (err) {
    return { installed: false as const, err };
  }
}

describe("the install, since v9 (founder 2026-10-18, Q6): no code, no `/`", () => {
  it("installs without precaching `/` — a signed-in `/` is a 307 to /chat, so the precache rendered the Lounge twice", async () => {
    const sw = bootWorker(`${ORIGIN}/sw.js?v=build-1`);
    sw.setNetwork((url) =>
      url === `${ORIGIN}/` ? ok("the lounge", { redirected: true }) : ok(`fresh:${url}`)
    );
    expect(await install(sw)).toEqual({ installed: true });
    expect(sw.skipWaitingCalled()).toBe(true);
    // The worker fetches its precache list by path; `/` is not on it.
    expect(sw.networkCalls).toEqual(["/manifest.webmanifest", "/icon"]);
    expect([...sw.store.keys()]).not.toContain(`${ORIGIN}/`);
    // The manifest and the icon are still precached, best-effort.
    expect(sw.store.get(`${ORIGIN}/manifest.webmanifest`)).toBe("fresh:/manifest.webmanifest");
  });
});

describe("build output is never intercepted (v9, founder 2026-10-18, Q6)", () => {
  let sw: Scope;
  beforeEach(() => {
    sw = bootWorker(`${ORIGIN}/sw.js?v=build-1`);
  });

  it("stands aside for /_next/static/*: the browser's HTTP cache keeps it across deploys, this worker's did not", async () => {
    // Even a copy an older worker left behind is not served: the browser owns
    // the request from the first byte.
    sw.store.set(`${ORIGIN}/_next/static/chunks/app/chat/page-abc123.js`, "stale chunk");
    expect(
      await request(sw, `${ORIGIN}/_next/static/chunks/app/chat/page-abc123.js`, {
        destination: "script",
      })
    ).toBeNull();
    expect(await request(sw, `${ORIGIN}/_next/static/css/app-def456.css`, { destination: "style" })).toBeNull();
    expect(sw.networkCalls).toHaveLength(0);
    // And nothing new is ever written for one.
    expect([...sw.store.keys()].filter((k) => k.includes("/_next/static/"))).toEqual([
      `${ORIGIN}/_next/static/chunks/app/chat/page-abc123.js`,
    ]);
  });

  it("still answers a navigation network-first and keeps the last one as the offline fallback", async () => {
    sw.setNetwork((url) => ok(`fresh:${url}`));
    expect(await request(sw, `${ORIGIN}/chat`, { mode: "navigate" })).toMatchObject({
      body: `fresh:${ORIGIN}/chat`,
    });
    expect(sw.store.get(`${ORIGIN}/chat`)).toBe(`fresh:${ORIGIN}/chat`);

    // Offline: the copy stored on the way past, with no `/` precache to lean on.
    sw.setNetwork(() => {
      throw new Error("offline");
    });
    expect(await request(sw, `${ORIGIN}/chat`, { mode: "navigate" })).toMatchObject({
      body: `fresh:${ORIGIN}/chat`,
    });
  });

  it("the push handlers are still registered", () => {
    expect(sw.pushHandler).toBeTypeOf("function");
    expect(sw.notificationClickHandler).toBeTypeOf("function");
  });
});
