/**
 * The corpus row's playback leg (backend PR #920): one GET through
 * callBackend to the coach playback route, the backend's answer relayed as
 * it came, and never cacheable — the URL inside is a signed credential.
 */
import { describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("server-only", () => ({}));

const calls: Array<{ path: string; init: Record<string, unknown> }> = [];
let answer: () => NextResponse = () => NextResponse.json({}, { status: 200 });
vi.mock("@/app/api/_lib/backend", async () => {
  const actual = await vi.importActual<typeof import("@/app/api/_lib/backend")>(
    "@/app/api/_lib/backend",
  );
  return {
    ...actual,
    callBackend: vi.fn(async (path: string, init: Record<string, unknown>) => {
      calls.push({ path, init });
      return answer();
    }),
  };
});

const SNIPPET = "20000000-0000-4000-8000-000000000001";
const req = () => new Request(`http://localhost/api/v2/coach/corpus/clips/${SNIPPET}/playback`);

describe("GET /api/v2/coach/corpus/clips/[snippetId]/playback", () => {
  it("forwards to the backend route and relays its body, uncacheable", async () => {
    const body = {
      snippet_id: SNIPPET,
      url: "https://media.example/parent.wav?sig=1",
      start_offset_ms: 1000,
      duration_ms: 4000,
      expires_in_s: 900,
    };
    answer = () => NextResponse.json(body, { status: 200 });
    const { GET } = await import("./route");
    const res = await GET(req(), { params: { snippetId: SNIPPET } });
    expect(calls.at(-1)?.path).toBe(`/v2/coach/corpus/clips/${SNIPPET}/playback`);
    expect(calls.at(-1)?.init.method).toBe("GET");
    // Auth is callBackend's default; nothing of the route's own.
    expect(calls.at(-1)?.init.requireAuth).toBeUndefined();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(body);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store, max-age=0");
  });

  it("passes the backend's refusals through at their status", async () => {
    const { GET } = await import("./route");
    for (const [status, code] of [[404, "NOT_FOUND"], [410, "PHASE2_DISABLED"], [503, "PLAYBACK_UNAVAILABLE"], [403, "FORBIDDEN"]] as const) {
      answer = () => NextResponse.json({ code }, { status });
      const res = await GET(req(), { params: { snippetId: SNIPPET } });
      expect(res.status).toBe(status);
      expect(await res.json()).toEqual({ code });
      expect(res.headers.get("Cache-Control")).toBe("private, no-store, max-age=0");
    }
  });

  it("refuses a non-UUID id without calling the backend", async () => {
    const { GET } = await import("./route");
    const before = calls.length;
    const res = await GET(req(), { params: { snippetId: "../../admin" } });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ code: "INVALID_INPUT" });
    expect(calls.length).toBe(before);
  });
});
