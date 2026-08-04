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
  /** Everything the worker actually wrote, by URL. */
  store: Map<string, string>;
  /** Every URL the worker went to the network for. */
  networkCalls: string[];
  /** Cache names that exist. The worker deletes the ones it does not own. */
  cacheNames: Set<string>;
  setNetwork: (fn: (url: string) => any) => void;
}

/** A response the worker will consider cacheable (200 + same-origin). */
function ok(body: string) {
  return {
    status: 200,
    type: "basic",
    body,
    clone() {
      return ok(body);
    },
  };
}

function bootWorker(): Scope {
  const handlers: Record<string, Handler> = {};
  const store = new Map<string, string>();
  const cacheNames = new Set<string>(["willab-shell-v4", "some-other-cache"]);
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
      store.set(keyOf(req), res.body);
    },
    addAll: async (urls: string[]) => {
      for (const u of urls) store.set(keyOf(u), `precached:${u}`);
    },
  });

  const scope: any = {
    addEventListener: (name: string, fn: Handler) => {
      handlers[name] = fn;
    },
    skipWaiting: () => {},
    clients: { claim: () => {} },
    registration: {
      navigationPreload: { enable: async () => {} },
    },
  };

  const sandbox: any = {
    self: scope,
    caches: {
      open: async () => cacheFor(),
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
    store,
    networkCalls,
    cacheNames,
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
  init: { mode?: string; method?: string; preload?: any } = {}
) {
  const req = { url, method: init.method ?? "GET", mode: init.mode ?? "cors" };
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

interface SwResponse {
  status: number;
  type: string;
  body: string;
}

/** `request` for the cases that expect the worker to ANSWER. Declining to
 *  intercept is a legitimate outcome (see the /auth/ test), so it has to be
 *  ruled out explicitly rather than read as an empty body. */
async function respondedTo(
  sw: Scope,
  url: string,
  init: { mode?: string; method?: string; preload?: any } = {}
): Promise<SwResponse> {
  const res = await request(sw, url, init);
  if (res === null) {
    throw new Error(`the worker declined to intercept ${url}`);
  }
  return res as SwResponse;
}

describe("the service worker caching policy", () => {
  let sw: Scope;
  beforeEach(() => {
    sw = bootWorker();
  });

  it("never intercepts the OAuth chain", async () => {
    // Single-use state tokens: an SW-level replay makes Supabase reject the
    // second sight of the same state with "flow_state_already_used".
    expect(await request(sw, "https://willpowerlab.com/auth/callback")).toBeNull();
    expect(sw.networkCalls).toHaveLength(0);
  });

  it("never serves the API from a cache", async () => {
    await request(sw, "https://willpowerlab.com/api/v2/life/state");
    await request(sw, "https://willpowerlab.com/api/v2/life/state");
    // Twice asked, twice fetched, nothing stored. User state is never replayed.
    expect(sw.networkCalls).toHaveLength(2);
    expect([...sw.store.keys()]).not.toContain(
      "https://willpowerlab.com/api/v2/life/state"
    );
  });

  /* ---------------------------------------------------------------------- */
  /*  (3) HTML — the rule that makes a bad deploy fixable by deploying       */
  /* ---------------------------------------------------------------------- */

  it("goes to the network first for a navigation, even with a cached copy", async () => {
    sw.store.set("https://willpowerlab.com/", "STALE HTML");
    sw.setNetwork(() => ok("FRESH HTML"));

    const res = await respondedTo(sw, "https://willpowerlab.com/", { mode: "navigate" });

    // The whole point: a stale document is how a browser ends up running last
    // week's JS. Fix the server, refresh, done.
    expect(res.body).toBe("FRESH HTML");
  });

  it("falls back to the cached shell only when the network fails", async () => {
    sw.store.set("https://willpowerlab.com/", "OFFLINE SHELL");
    sw.setNetwork(() => {
      throw new Error("offline");
    });

    const res = await respondedTo(sw, "https://willpowerlab.com/panel/today", {
      mode: "navigate",
    });
    expect(res.body).toBe("OFFLINE SHELL");
  });

  it("uses the preloaded navigation response when the browser supplies one", async () => {
    const res = await respondedTo(sw, "https://willpowerlab.com/", {
      mode: "navigate",
      preload: ok("PRELOADED"),
    });
    expect(res.body).toBe("PRELOADED");
    // Preload already made the request; making it again would double it.
    expect(sw.networkCalls).toHaveLength(0);
  });

  /* ---------------------------------------------------------------------- */
  /*  (4) Hashed build output — cache-first, and safe because of the hash    */
  /* ---------------------------------------------------------------------- */

  it("serves a hashed chunk from cache without touching the network", async () => {
    const chunk = "https://willpowerlab.com/_next/static/chunks/4020-abc123.js";
    await request(sw, chunk);
    expect(sw.networkCalls).toEqual([chunk]);

    await request(sw, chunk);
    // Still one. The URL contains a hash of the bytes, so a second look-up
    // cannot discover different content and must not cost a round trip.
    expect(sw.networkCalls).toEqual([chunk]);
  });

  /* ---------------------------------------------------------------------- */
  /*  (5) Stable URLs with changing content — the bucket that used to freeze */
  /* ---------------------------------------------------------------------- */

  it("serves an unhashed asset from cache but refreshes it in the background", async () => {
    const icon = "https://willpowerlab.com/icon";
    sw.store.set(icon, "OLD ICON");
    sw.setNetwork(() => ok("NEW ICON"));

    // First read is instant and stale — that is the deal.
    expect((await respondedTo(sw, icon)).body).toBe("OLD ICON");
    // The refresh is held open past the response. Without this the browser is
    // free to kill the worker mid-revalidation and the entry never updates,
    // which is cache-first wearing a new hat.
    expect(lastWaitUntilCount).toBeGreaterThan(0);
    // And it did revalidate, so the NEXT read is fresh. Under the old
    // cache-first rule this stayed "OLD ICON" until someone bumped the cache.
    expect(sw.store.get(icon)).toBe("NEW ICON");
    expect((await respondedTo(sw, icon)).body).toBe("NEW ICON");
  });

  it("fetches an unhashed asset it has never seen", async () => {
    sw.setNetwork(() => ok("FIRST"));
    expect(
      (await respondedTo(sw, "https://willpowerlab.com/brand/logo.svg")).body
    ).toBe("FIRST");
  });

  it("does not cache a failed or cross-origin response as if it succeeded", async () => {
    const url = "https://willpowerlab.com/brand/missing.svg";
    sw.setNetwork(() => ({ status: 404, type: "basic", body: "nope", clone: () => ({}) }));
    await request(sw, url);
    // A 404 stored under a real URL is a broken asset pinned for everyone.
    expect(sw.store.has(url)).toBe(false);
  });

  /* ---------------------------------------------------------------------- */
  /*  Activation — what makes a cache-name bump actually rescue anyone       */
  /* ---------------------------------------------------------------------- */

  it("deletes every cache it does not own, so a bump is a real flush", async () => {
    const pending: Promise<any>[] = [];
    sw.activateHandler({ waitUntil: (p: Promise<any>) => pending.push(p) });
    await Promise.all(pending);

    expect(sw.cacheNames.has("willab-shell-v4")).toBe(false);
    expect(sw.cacheNames.has("some-other-cache")).toBe(false);
  });

  it("reads only from its own cache, never the whole origin", async () => {
    // The sandbox throws if sw.js calls the global `caches.match`. Searching
    // every cache is what would let a version this worker just deleted keep
    // answering, which is a cache bump that does not bump anything.
    await request(sw, "https://willpowerlab.com/icon");
    await request(sw, "https://willpowerlab.com/_next/static/chunks/x-1.js");
    await request(sw, "https://willpowerlab.com/", { mode: "navigate" });
  });
});
