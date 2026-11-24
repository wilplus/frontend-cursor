/*
STORY   As a speaker, I can request an AI example on the exact clip I heard in my chat.
OUTCOME O1  The chat proxy sends the specific fragment and recognized AI audio request and keeps the response private.
PROVES  O1 -> "passes an AI audio request for the cited Take through to the backend"
*/
import { NextRequest, NextResponse } from "next/server";
import { expect, it, vi } from "vitest";
import { callBackend } from "@/app/api/_lib/backend";
import { GET } from "./route";

vi.mock("server-only", () => ({}));
vi.mock("@/app/api/_lib/backend", () => ({ callBackend: vi.fn() }));

it("passes an AI audio request for the cited Take through to the backend", async () => {
  vi.mocked(callBackend).mockResolvedValue(NextResponse.json({ practice_id: "exact-practice" }));
  const req = new NextRequest("https://app.example/api/v2/user/lounge/moment/clip?take_session_id=take-2&intervention=ai_audio");
  const response = await GET(req, { params: { snippetId: "clip" } });
  expect(callBackend).toHaveBeenCalledWith("/v2/user/lounge/moment/clip?take_session_id=take-2&intervention=ai_audio", { method: "GET" });
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(await response.json()).toEqual({ practice_id: "exact-practice" });
});
