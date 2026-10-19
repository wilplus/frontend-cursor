/**
 * STORY    As a speaker, I want every app-to-server call to carry my sign-in
 *          and fail with a plain message, so that I never see a broken
 *          screen or someone else's data.
 * OUTCOME
 *   O1  Signed in: the backend gets my token and its answer reaches me as is.
 *   O2  Signed out: 401 with the shared words, and no backend call at all.
 *   O3  The backend unreachable: 502 with the generic words.
 *   O4  A guest token never rides on an account's call; a signed-out
 *       guest's own token does.
 *   O5  A route's own knobs win: `failures` (its words), `relay` (its
 *       answer shape), `token: null` (no sign-in sent).
 * PROVES   O1 -> "a signed-in call carries the token and passes the answer through"
 *          O2 -> "401 UNAUTHENTICATED with the shared copy when signed out"
 *          O3 -> "502 PROXY_ERROR with the generic copy when fetch throws"
 *          O4 -> "an account never sends the guest token along",
 *                "a signed-out guest sends its own token"
 *          O5 -> "failures: a route keeps its own words",
 *                "relay: a route shapes its own answer",
 *                "token: null sends no sign-in"
 * WHY      The one BFF->backend helper (audit Q-A8); ~150 routes rely on it.
 *
 * `server-only` and `next/headers` are mocked so the helper runs as plain Node.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const ctx: {
  headerToken: string | null;
  cookieToken: string | null;
} = {
  headerToken: "hdr-token",
  cookieToken: null,
};

vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({
      ...(ctx.headerToken ? { Authorization: `Bearer ${ctx.headerToken}` } : {}),
    }),
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

describe("callBackend — the shared contract", () => {
  it("a signed-in call carries the token and passes the answer through", async () => {
    const { callBackend } = await load();
    const calls = stubFetch(() => json({ hello: "speaker" }, 409));
    const res = await callBackend("/v2/x", { method: "POST", body: "{}" });
    expect(calls[0].url).toBe("http://backend.test/v2/x");
    expect(calls[0].init.headers?.Authorization).toBe("Bearer hdr-token");
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ hello: "speaker" });
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

  it("502 PROXY_ERROR with the generic copy when fetch throws", async () => {
    const { callBackend } = await load();
    stubFetch(() => {
      throw new TypeError("fetch failed");
    });
    const res = await callBackend("/v2/x");
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ code: "PROXY_ERROR", error: "Something went wrong on our end." });
  });
});

describe("callBackend — guestOwnerFrom (Phase 0.6: a guest reads its own page)", () => {
  const GUEST = "3f1c2a54-9b7e-4c1d-8a2f-6e5d4c3b2a10." + "s".repeat(43);
  const from = (token: string | null) => ({
    headers: new Headers(token ? { "X-Willab-Guest-Owner": token } : {}),
  });

  it("an account never sends the guest token along", async () => {
    const { callBackend } = await load();
    const calls = stubFetch(() => json({ ok: 1 }));
    await callBackend("/v2/x", { guestOwnerFrom: from(GUEST) });
    expect(calls[0].init.headers?.Authorization).toBe("Bearer hdr-token");
    expect(calls[0].init.headers?.["X-Willab-Guest-Owner"]).toBeUndefined();
  });

  it("a signed-out guest sends its own token", async () => {
    ctx.headerToken = null;
    const { callBackend } = await load();
    const calls = stubFetch(() => json({ ok: 1 }));
    const res = await callBackend("/v2/x", { guestOwnerFrom: from(GUEST) });
    expect(res.status).toBe(200);
    expect(calls[0].init.headers?.["X-Willab-Guest-Owner"]).toBe(GUEST);
    expect(calls[0].init.headers?.Authorization).toBeUndefined();
  });
});

describe("callBackend — a route's own knobs", () => {
  it("failures: a route keeps its own words", async () => {
    ctx.headerToken = null;
    const { callBackend } = await load();
    stubFetch(() => json({}));
    const res = await callBackend("/v2/x", {
      failures: { unauthenticated: { status: 401, body: { error: "Please sign in." } } },
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Please sign in." });
  });

  it("relay: a route shapes its own answer", async () => {
    const { callBackend, failure } = await load();
    stubFetch(() => json({ raw: true }, 500));
    const res = await callBackend("/v2/x", {
      relay: async (upstream) => failure({ status: 503, body: { error: `was ${upstream.status}` } }),
    });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "was 500" });
  });

  it("token: null sends no sign-in", async () => {
    const { callBackend } = await load();
    const calls = stubFetch(() => json({ ok: 1 }));
    const res = await callBackend("/v2/x", { token: null, requireAuth: false });
    expect(res.status).toBe(200);
    expect(calls[0].init.headers?.Authorization).toBeUndefined();
  });
});
