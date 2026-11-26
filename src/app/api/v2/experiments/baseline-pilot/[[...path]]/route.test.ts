/*
STORY    Only an invited speaker can read pilot data through the signed-in app.
OUTCOME
  O1  Collection keeps the signed-in identity and removes private evaluation data from responses.
  O2  A saved recording is replayed through the exact authorized source, including byte ranges.
PROVES   O1,O2 -> "the signed-in baseline transport"
*/
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const backend = vi.hoisted(() => ({ call: vi.fn(), upstream: null as Response | null }));
vi.mock("server-only", () => ({}));
vi.mock("@/app/api/_lib/backend", async () => {
  const { relayAudio } = await import("@/app/api/_lib/envelopes");
  return { callBackend: backend.call, relayAudio };
});
import { GET, PUT } from "./route";

const root = "https://example.test/api/v2/experiments/baseline-pilot";
const audioPath = ["runs", "11111111-1111-4111-8111-111111111111", "steps", "quiet", "audio"];

describe("the signed-in baseline transport", () => {
  beforeEach(() => {
    backend.call.mockReset().mockImplementation((_path, options) => options.relay(backend.upstream));
    backend.upstream = null;
  });

  it("forwards the language and limits the browser to participant fields", async () => {
    backend.upstream = Response.json({
      entry_allowed: false, predictions: [{ score: 0.9 }],
      disclosure: { version: "v1", recording: "Dwa nagrania.", purpose: "Próba.", use: "Prywatne.", score: 1 },
      runs: {
        initial: { id: audioPath[1], mode: "initial", protocol_version: "p1", created_at: "yesterday", completed_at: null,
          next_step: { id: "quiet", prompt: "Opowiedz o rutynie.", state: "valence", intended_energy: "low", features: [1] } },
        on_demand: null, refresh: null,
      },
    });
    const result = await GET(new NextRequest(root + "?language=pl&include=predictions"), { params: {} });
    expect(backend.call).toHaveBeenCalledWith("/v2/experiments/baseline-pilot?language=pl",
      expect.objectContaining({ method: "GET", redirect: "error" }));
    expect(backend.call.mock.lastCall?.[1]).not.toHaveProperty("token");
    expect(result.headers.get("cache-control")).toBe("private, no-store");
    const data = await result.json();
    expect(data).not.toHaveProperty("predictions");
    expect(data.disclosure).not.toHaveProperty("score");
    expect(data.runs.initial.next_step).toEqual({ id: "quiet", prompt: "Opowiedz o rutynie.", state: "valence" });
  });

  it("rejects unrelated API paths and cross-origin writes", async () => {
    expect((await GET(new NextRequest(root + "/predictions"), { params: { path: ["predictions"] } })).status).toBe(404);
    const path = [...audioPath.slice(0, -1), "report"];
    const request = new NextRequest(root + "/" + path.join("/"), { method: "PUT", headers: { "Sec-Fetch-Site": "same-site" } });
    expect((await PUT(request, { params: { path } })).status).toBe(404);
    expect(backend.call).not.toHaveBeenCalled();
  });

  it("relays a private audio range and redacts an upstream denial", async () => {
    const request = new NextRequest(root + "/" + audioPath.join("/"), { headers: { Range: "bytes=0-2" } });
    backend.upstream = new Response("abc", { status: 206, headers: { "Content-Type": "audio/webm", "Content-Range": "bytes 0-2/42" } });
    const audio = await GET(request, { params: { path: audioPath } });
    expect(audio.status).toBe(206);
    expect(audio.headers.get("content-range")).toBe("bytes 0-2/42");
    expect(await audio.text()).toBe("abc");
    expect(backend.call.mock.lastCall?.[1].headers).toEqual({ Range: "bytes=0-2" });
    backend.upstream = Response.json({ score: 123 }, { status: 404 });
    const denied = await GET(request, { params: { path: audioPath } });
    expect(denied.status).toBe(404);
    expect(await denied.json()).toEqual({ code: "PILOT_REQUEST_FAILED" });
  });
});
