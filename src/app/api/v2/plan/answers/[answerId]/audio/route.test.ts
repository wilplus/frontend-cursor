/*
STORY    As a speaker on Safari, I want my own voice answers to play when I
         tap them, so that I can hear what I told Will.
OUTCOME
  O1  The player's byte-range request reaches the backend, and the part it
      answers comes back as a part: 206 with its Content-Range, which
      Safari needs before it plays anything.
PROVES   O1 -> "relays a byte range as a byte range"
WHY      The founder's voice bubbles didn't play in Safari on a Mac
         (backend N262 item 4); docs/flows/the-plan.md §6.
*/
import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const calls: Array<{ path: string; init: Record<string, unknown> }> = [];
vi.mock("@/app/api/_lib/backend", async () => {
  const actual = await vi.importActual<typeof import("@/app/api/_lib/backend")>("@/app/api/_lib/backend");
  return {
    ...actual,
    callBackend: vi.fn(async (path: string, init: Record<string, unknown>) => {
      calls.push({ path, init });
      const upstream = new Response(new Uint8Array([1, 2]), {
        status: 206,
        headers: { "Content-Type": "audio/mp4", "Content-Range": "bytes 0-1/4200" },
      });
      return (init.relay as (r: Response) => Promise<Response>)(upstream);
    }),
  };
});

describe("GET /api/v2/plan/answers/[answerId]/audio", () => {
  it("relays a byte range as a byte range", async () => {
    const { GET } = await import("./route");
    const req = new NextRequest("http://localhost/api/v2/plan/answers/a-1/audio", {
      headers: { Range: "bytes=0-1" },
    });
    const res = await GET(req, { params: { answerId: "a-1" } });
    expect(calls[0].path).toBe("/v2/plan/answers/a-1/audio");
    expect(calls[0].init.headers).toEqual({ Range: "bytes=0-1" });
    expect(res.status).toBe(206);
    expect(res.headers.get("Content-Range")).toBe("bytes 0-1/4200");
    expect(res.headers.get("Accept-Ranges")).toBe("bytes");
    expect(res.headers.get("Content-Type")).toBe("audio/mp4");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2]));
  });
});
