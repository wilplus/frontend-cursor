import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ Authorization: "Bearer tok" }),
  cookies: async () => ({ getAll: () => [], set: () => undefined }),
}));

/* A CHANGED JUDGEMENT (founder QA1 A, D-FW-9). The backend answers a
   different Confident Voice answer with 200 and `revised: true` (migration
   0440); the BFF relays that body as it came, so the sheet can read it. */
describe("/api/v2/user/takes/[takeSessionId]/feedback-response", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function post(upstreamStatus: number, upstreamBody: Record<string, unknown>) {
    vi.stubEnv("BACKEND_URL_INTERNAL", "http://backend.test");
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(upstreamBody), {
        status: upstreamStatus,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await import("./route");
    const sent = { feedback_id: "cv-1", feedback_family: "confident_voice", response: "no" };
    const res = await POST(
      new NextRequest("http://localhost/api/v2/user/takes/t/feedback-response", {
        method: "POST",
        body: JSON.stringify(sent),
        headers: { "Content-Type": "application/json" },
      }),
      { params: { takeSessionId: "take 1" } },
    );
    return { res, fetchMock, sent };
  }

  it("passes the 200 revised body through unchanged", async () => {
    const revised = {
      saved: true,
      revised: true,
      feedback_id: "cv-1",
      feedback_family: "confident_voice",
      response: "no",
      follow_up: "library_video",
    };
    const { res, fetchMock, sent } = await post(200, revised);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(revised);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`http://backend.test/v2/user/takes/${encodeURIComponent("take 1")}/feedback-response`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual(sent);
  });

  it("still relays a rewrite's 409 as it came", async () => {
    const final = { code: "RESPONSE_ALREADY_FINAL", error: "This response is already final." };
    const { res } = await post(409, final);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual(final);
  });
});
