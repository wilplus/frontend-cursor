/*
STORY    As the founder shaping AI Audio, I want the spoken version I just
         recorded to play back when the conversion succeeds.
OUTCOME
  O1  A successful speech-to-speech answer is the MP3 itself, not an empty
      JSON stand-in.
PROVES   O1 -> "plays the MP3 the conversion returned"
*/
import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const mp3 = new Uint8Array([0xff, 0xfb, 0x90, 0x64]);
vi.mock("@/app/api/_lib/backend", async () => {
  const actual = await vi.importActual<typeof import("@/app/api/_lib/backend")>("@/app/api/_lib/backend");
  return {
    ...actual,
    callBackend: vi.fn(async (_path: string, init: { relay?: (upstream: Response) => Promise<Response> }) => {
      const upstream = new Response(mp3, { status: 200, headers: { "content-type": "audio/mpeg" } });
      return init.relay ? init.relay(upstream) : upstream;
    }),
  };
});

afterEach(() => { vi.resetModules(); });

it("plays the MP3 the conversion returned", async () => {
  const { POST } = await import("./route");
  const form = new FormData();
  form.append("audio", new Blob([mp3], { type: "audio/webm" }), "line.webm");
  form.append("action", "revoice");
  const request = new NextRequest("http://localhost/api/v2/user/speaking-calibration/take/clip/coach", {
    method: "POST", body: form,
  });
  const response = await POST(request, { params: { take: "take", snippet: "clip" } });
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toMatch(/^audio\/mpeg/);
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(mp3);
});
