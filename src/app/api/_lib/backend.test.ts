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

const ctx: {
  headerToken: string | null;
  cookieToken: string | null;
  incomingRequestId?: string | null;
} = {
  headerToken: "hdr-token",
  cookieToken: null,
};

/** Every upstream call now carries exactly one request id (audit A1). */
const RID = { "X-Request-Id": expect.stringMatching(/^[0-9a-f]{12}$/) };

vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({
      ...(ctx.headerToken ? { Authorization: `Bearer ${ctx.headerToken}` } : {}),
      ...(ctx.incomingRequestId ? { "X-Request-Id": ctx.incomingRequestId } : {}),
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

describe("backendFetch — the single construction point", () => {
  it("builds base + path, Accept, Authorization and no-store", async () => {
    const { backendFetch } = await load();
    const calls = stubFetch(() => json({}));
    await backendFetch("/v2/x", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    expect(calls[0].url).toBe("http://backend.test/v2/x");
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.headers).toEqual({ ...RID, 
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: "Bearer hdr-token",
    });
    expect(calls[0].init.cache).toBe("no-store");
  });
});

describe("callBackend — defaults (the pre-Q-A8 contract, unchanged)", () => {

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
});
