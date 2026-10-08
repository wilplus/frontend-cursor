import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ getAll: () => [], set: () => undefined }),
}));

/* One published Journal post, for the Feedback walk's "More about
   self-modeling theory" (D-FW-18, JP1 A). Public: no token is sent; any
   failure is a 404 the walk reads as "no link". */
describe("/api/v2/journal/posts/[slug]", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function get(upstream: () => Promise<Response>) {
    vi.stubEnv("BACKEND_URL_INTERNAL", "http://backend.test");
    const fetchMock = vi.fn(upstream);
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await import("./route");
    const res = await GET(new NextRequest("http://localhost/api/v2/journal/posts/x"), {
      params: { slug: "why-we-ask-you-to-judge-honestly" },
    });
    return { res, fetchMock };
  }

  it("relays a published post from the public backend read, with no token", async () => {
    const post = { slug: "why-we-ask-you-to-judge-honestly", title: "Why we ask you to judge honestly", body: "Words." };
    const { res, fetchMock } = await get(async () => new Response(JSON.stringify(post), { status: 200 }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(post);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://backend.test/v2/journal/posts/why-we-ask-you-to-judge-honestly");
    expect(new Headers(init.headers).get("Authorization")).toBeNull();
  });

  it("a draft, a missing post or an unreachable backend is a 404", async () => {
    expect((await get(async () => new Response("{}", { status: 404 }))).res.status).toBe(404);
    vi.resetModules();
    expect((await get(async () => new Response("{}", { status: 500 }))).res.status).toBe(404);
    vi.resetModules();
    expect((await get(async () => Promise.reject(new Error("down")))).res.status).toBe(404);
  });
});
