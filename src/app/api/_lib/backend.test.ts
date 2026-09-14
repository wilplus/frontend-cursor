/**
 * The one BFF→backend helper (audit Q-A8, Phase 4).
 *
 * Two things are pinned here. First, the pre-Q-A8 behaviour of callBackend
 * for a route that passes nothing: the 59 routes migrated before this phase
 * must see no change. Second, the copy-preserving knobs the 90 routes
 * migrated in this phase rely on: `failures`, `relay`, `token`.
 *
 * `server-only` is a Next.js bundler alias, not a package; `next/headers` needs
 * a request scope. Both are mocked, so the helper runs as plain Node.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const ctx: { headerToken: string | null; cookieToken: string | null } = {
  headerToken: "hdr-token",
  cookieToken: null,
};

vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers(ctx.headerToken ? { Authorization: `Bearer ${ctx.headerToken}` } : {}),
  cookies: async () => ({ getAll: () => [], set: () => {} }),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: ctx.cookieToken ? { id: "u1" } : null } }),
      getSession: async () => ({
        data: { session: ctx.cookieToken ? { access_token: ctx.cookieToken } : null },
      }),
    },
  }),
}));

type Recorded = { url: string; init: RequestInit & { headers?: Record<string, string> } };

function stubFetch(
  respond: (url: string, init: RequestInit) => Response | Promise<Response>
): Recorded[] {
  const calls: Recorded[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init: (init ?? {}) as Recorded["init"] });
    return respond(url, init ?? {});
  }) as typeof fetch;
  return calls;
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });

async function load() {
  vi.resetModules();
  return import("@/app/api/_lib/backend");
}

const realFetch = globalThis.fetch;

beforeEach(() => {
  ctx.headerToken = "hdr-token";
  ctx.cookieToken = null;
  process.env.BACKEND_URL = "http://backend.test";
  delete process.env.BACKEND_URL_INTERNAL;
  delete process.env.NEXT_PUBLIC_API_URL;
  delete process.env.NEXT_PUBLIC_BACKEND_URL;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

describe("backendFetch — the single construction point", () => {
  it("builds base + path, Accept, Authorization and no-store", async () => {
    const { backendFetch } = await load();
    const calls = stubFetch(() => json({}));
    await backendFetch("/v2/x", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    expect(calls[0].url).toBe("http://backend.test/v2/x");
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.headers).toEqual({
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: "Bearer hdr-token",
    });
    expect(calls[0].init.cache).toBe("no-store");
  });

  it("prefers BACKEND_URL_INTERNAL and strips trailing slashes", async () => {
    process.env.BACKEND_URL_INTERNAL = "http://internal.test/";
    const { backendFetch, getBackendUrl } = await load();
    expect(getBackendUrl()).toBe("http://internal.test");
    const calls = stubFetch(() => json({}));
    await backendFetch("/v2/x");
    expect(calls[0].url).toBe("http://internal.test/v2/x");
  });

  it("token: null sends no Authorization even when the request carries one", async () => {
    const { backendFetch } = await load();
    const calls = stubFetch(() => json({}));
    await backendFetch("/v2/x", { token: null });
    expect(calls[0].init.headers).toEqual({ Accept: "application/json" });
  });

  it("a route's own Accept wins over the default", async () => {
    const { backendFetch } = await load();
    const calls = stubFetch(() => json({}));
    await backendFetch("/v2/x", { headers: { Accept: "text/event-stream" } });
    expect(calls[0].init.headers).toEqual({
      Accept: "text/event-stream",
      Authorization: "Bearer hdr-token",
    });
  });

  it("throws BackendNotConfiguredError with no base URL", async () => {
    delete process.env.BACKEND_URL;
    const { backendFetch, BackendNotConfiguredError } = await load();
    await expect(backendFetch("/v2/x")).rejects.toBeInstanceOf(BackendNotConfiguredError);
  });

  it("falls back to the cookie session when no header token is attached", async () => {
    ctx.headerToken = null;
    ctx.cookieToken = "cookie-token";
    const { getAccessToken } = await load();
    expect(await getAccessToken()).toBe("cookie-token");
  });
});

describe("callBackend — defaults (the pre-Q-A8 contract, unchanged)", () => {
  it("passes status, body and Server-Timing through", async () => {
    const { callBackend } = await load();
    stubFetch(() => json({ a: 1 }, 404, { "Server-Timing": "db;dur=3" }));
    const res = await callBackend("/v2/x");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ a: 1 });
    expect(res.headers.get("Server-Timing")).toBe("db;dur=3");
  });

  it("401 UNAUTHENTICATED with the shared copy when signed out", async () => {
    ctx.headerToken = null;
    const { callBackend } = await load();
    const calls = stubFetch(() => json({}));
    const res = await callBackend("/v2/x");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ code: "UNAUTHENTICATED", error: "Authentication required." });
    expect(calls).toHaveLength(0);
  });

  it("requireAuth: false forwards without a token", async () => {
    ctx.headerToken = null;
    const { callBackend } = await load();
    const calls = stubFetch(() => json({ ok: 1 }));
    const res = await callBackend("/v2/x", { requireAuth: false });
    expect(res.status).toBe(200);
    expect(calls[0].init.headers).toEqual({ Accept: "application/json" });
  });

  it("502 BACKEND_UNAVAILABLE with no base URL", async () => {
    delete process.env.BACKEND_URL;
    const { callBackend } = await load();
    const res = await callBackend("/v2/x");
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" });
  });

  it("502 PROXY_ERROR with the generic copy when fetch throws", async () => {
    const { callBackend } = await load();
    stubFetch(() => {
      throw new TypeError("fetch failed");
    });
    const res = await callBackend("/v2/x");
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ code: "PROXY_ERROR", error: "Something went wrong on our end." });
  });

  it("a non-JSON upstream body is relayed as { error: text } at the upstream status", async () => {
    const { callBackend } = await load();
    stubFetch(() => new Response("<html>bad</html>", { status: 502 }));
    const res = await callBackend("/v2/x");
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "<html>bad</html>" });
  });
});

describe("callBackend — route-owned envelopes", () => {
  const F = {
    unauthenticated: { status: 401, body: { error: "Not authenticated" } },
    notConfigured: { status: 502, body: { error: "Backend URL is not configured." } },
    unreachable: { status: 502, body: { code: "PROXY_ERROR", error: "Ideal-text service unavailable." } },
    timeout: { status: 504, body: { code: "UPSTREAM_TIMEOUT", error: "Re-cut took too long. Try again in a moment." } },
  };

  it("unauthenticated", async () => {
    ctx.headerToken = null;
    const { callBackend } = await load();
    const res = await callBackend("/v2/x", { failures: F });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Not authenticated" });
  });

  it("notConfigured", async () => {
    delete process.env.BACKEND_URL;
    const { callBackend } = await load();
    const res = await callBackend("/v2/x", { failures: F });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "Backend URL is not configured." });
  });

  it("unreachable, fixed envelope", async () => {
    const { callBackend } = await load();
    stubFetch(() => {
      throw new TypeError("fetch failed");
    });
    const res = await callBackend("/v2/x", { failures: F });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual(F.unreachable.body);
  });

  it("unreachable, built from the error", async () => {
    const { callBackend } = await load();
    stubFetch(() => {
      throw new TypeError("fetch failed");
    });
    const res = await callBackend("/v2/x", {
      failures: {
        unreachable: (err) => ({
          status: 500,
          body: { code: "FETCH_ERROR", error: err instanceof Error ? err.message : "?" },
        }),
      },
    });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ code: "FETCH_ERROR", error: "fetch failed" });
  });

  it("unreachable: rethrow hands the error to the route", async () => {
    const { callBackend } = await load();
    stubFetch(() => {
      throw new TypeError("fetch failed");
    });
    await expect(callBackend("/v2/x", { failures: { unreachable: "rethrow" } })).rejects.toThrow("fetch failed");
  });

  it("timeout catches AbortError only; other errors stay unreachable", async () => {
    const { callBackend } = await load();
    stubFetch(() => {
      throw new DOMException("aborted", "AbortError");
    });
    const res = await callBackend("/v2/x", { failures: F });
    expect(res.status).toBe(504);
    expect(await res.json()).toEqual(F.timeout.body);
    stubFetch(() => {
      throw new TypeError("fetch failed");
    });
    const res2 = await callBackend("/v2/x", { failures: F });
    expect(await res2.json()).toEqual(F.unreachable.body);
  });

  it("without a timeout envelope an abort is handled as unreachable", async () => {
    const { callBackend } = await load();
    stubFetch(() => {
      throw new DOMException("aborted", "AbortError");
    });
    const res = await callBackend("/v2/x", { failures: { unreachable: F.unreachable } });
    expect(await res.json()).toEqual(F.unreachable.body);
  });

  it("notConfigured wins over rethrow", async () => {
    delete process.env.BACKEND_URL;
    const { callBackend } = await load();
    const res = await callBackend("/v2/x", { failures: { unreachable: "rethrow" } });
    expect(res.status).toBe(502);
  });

  it("token: a resolved token skips the lookup; null demands none when requireAuth is off", async () => {
    ctx.headerToken = null;
    const { callBackend } = await load();
    const calls = stubFetch(() => json({}));
    await callBackend("/v2/x", { token: "pre-resolved" });
    expect(calls[0].init.headers).toEqual({ Accept: "application/json", Authorization: "Bearer pre-resolved" });
    await callBackend("/v2/x", { token: null, requireAuth: false });
    expect(calls[1].init.headers).toEqual({ Accept: "application/json" });
    const res = await callBackend("/v2/x", { token: null });
    expect(res.status).toBe(401);
  });

  it("a FormData body rides through untouched, with no Content-Type set here", async () => {
    const { callBackend } = await load();
    const calls = stubFetch(() => json({}));
    const form = new FormData();
    form.append("file", new Blob(["abc"]), "a.txt");
    await callBackend("/v2/x", { method: "POST", body: form });
    expect(calls[0].init.body).toBe(form);
    expect(calls[0].init.headers).toEqual({ Accept: "application/json", Authorization: "Bearer hdr-token" });
  });

  it("the caller's signal is forwarded", async () => {
    const { callBackend } = await load();
    const calls = stubFetch(() => json({}));
    const controller = new AbortController();
    await callBackend("/v2/x", { signal: controller.signal });
    expect(calls[0].init.signal).toBe(controller.signal);
  });
});

describe("relays", () => {
  it("relayStrict: bare or {} for an empty body, non-JSON mapped, JSON passed through", async () => {
    const { relayStrict } = await load();
    const bare = relayStrict({ empty: "bare" });
    const r1 = await bare(new Response(null, { status: 204 }));
    expect(r1.status).toBe(204);
    expect(await r1.text()).toBe("");
    const obj = relayStrict({ empty: "object", code: "UPSTREAM_NON_JSON" });
    const r2 = await obj(new Response("", { status: 200 }));
    expect(await r2.json()).toEqual({});
    const r3 = await obj(new Response("<html>", { status: 200 }));
    expect(r3.status).toBe(502);
    expect(await r3.json()).toEqual({ code: "UPSTREAM_NON_JSON", error: "Unexpected backend response (HTTP 200)." });
    const r4 = await bare(new Response("<html>", { status: 404 }));
    expect(r4.status).toBe(404);
    expect(await r4.json()).toEqual({ error: "Unexpected backend response (HTTP 404)." });
    const r5 = await bare(new Response('{"a":[1]}', { status: 409 }));
    expect(r5.status).toBe(409);
    expect(await r5.json()).toEqual({ a: [1] });
    const custom = relayStrict({ empty: "object", code: "UPSTREAM_NON_JSON", message: (s) => `Unexpected response (HTTP ${s}).` });
    expect(await (await custom(new Response("x", { status: 500 }))).json()).toEqual({ code: "UPSTREAM_NON_JSON", error: "Unexpected response (HTTP 500)." });
    const guarded = relayStrict({ empty: "object", bareStatuses: [204] });
    const r6 = await guarded(new Response(null, { status: 204 }));
    expect(r6.status).toBe(204);
    expect(await r6.text()).toBe("");
  });

  it("relayLenient: {} for anything not JSON; the bare guard is opt-in", async () => {
    const { relayLenient } = await load();
    const plain = relayLenient();
    expect(await (await plain(new Response("", { status: 200 }))).json()).toEqual({});
    expect(await (await plain(new Response("<html>", { status: 502 }))).json()).toEqual({});
    const r = await plain(new Response('{"b":2}', { status: 201 }));
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({ b: 2 });
    await expect(plain(new Response(null, { status: 204 }))).rejects.toThrow();
    const guarded = relayLenient({ bareStatuses: [204, 205, 304] });
    expect((await guarded(new Response(null, { status: 204 }))).status).toBe(204);
  });

  it("relayLegacy: the former proxyJson envelope", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://public.test";
    const { relayLegacy } = await load();
    const relay = relayLegacy("/user/profile");
    const r1 = await relay(new Response("", { status: 500, statusText: "Internal" }));
    expect(r1.status).toBe(500);
    expect(await r1.json()).toEqual({ code: "HTTP_500", error: "Internal" });
    const r2 = await relay(new Response("", { status: 200 }));
    expect(await r2.json()).toBeNull();
    const r3 = await relay(new Response("<html>nope</html>", { status: 404 }));
    expect(r3.status).toBe(404);
    expect(await r3.json()).toEqual({
      code: "NOT_FOUND",
      error: "Backend route not found: /user/profile. The endpoint may not be implemented yet.",
    });
    const r4 = await relay(new Response("<title>x</title>", { status: 500 }));
    expect(await r4.json()).toEqual({ code: "HTML_ERROR_RESPONSE", error: "Backend returned HTML (status 500)." });
    const r5 = await relay(new Response("not json", { status: 200 }));
    expect(r5.status).toBe(500);
    expect(await r5.json()).toEqual({ code: "INVALID_RESPONSE", error: "Backend returned an invalid response." });
    const r6 = await relay(new Response('{"x":1}', { status: 502 }));
    expect(r6.status).toBe(502);
    expect(await r6.json()).toEqual({
      code: "BACKEND_UNAVAILABLE",
      error:
        "Backend server is not responding. Please check:\n1. Is your Flask backend running?\n2. Is NEXT_PUBLIC_API_URL set correctly? (Current: http://public.test)\n3. Can you reach the backend URL directly?",
    });
    const r7 = await relay(new Response('{"ok":true}', { status: 200 }));
    expect(await r7.json()).toEqual({ ok: true });
    // A bodiless status cannot be JSON-serialised; proxyJson's catch turned
    // that into FETCH_ERROR, and so does this.
    const r8 = await relay(new Response(null, { status: 204 }));
    expect(r8.status).toBe(500);
    expect((await r8.json()).code).toBe("FETCH_ERROR");
  });
});
