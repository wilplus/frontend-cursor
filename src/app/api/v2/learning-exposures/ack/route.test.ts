/*
STORY    As the founder, I want every "the speaker saw this" receipt the app
         sends to reach the backend unchanged, so that the records of what
         each speaker was shown are complete.
OUTCOME
  O1  The receipt is POSTed to the backend's receipt route exactly as sent,
      and the speaker must be signed in.
PROVES   O1 -> "forwards the acknowledgement verbatim to the backend ack route"
WHY      Audit 2026-09-22 (G-1): before this route every receipt was lost.
*/
import { describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("server-only", () => ({}));

const calls: Array<{ path: string; init: Record<string, unknown> }> = [];
vi.mock("@/app/api/_lib/backend", async () => {
  const actual = await vi.importActual<typeof import("@/app/api/_lib/backend")>(
    "@/app/api/_lib/backend",
  );
  return {
    ...actual,
    callBackend: vi.fn(async (path: string, init: Record<string, unknown>) => {
      calls.push({ path, init });
      return NextResponse.json({ acknowledged: true }, { status: 200 });
    }),
  };
});

const BODY = {
  presentation_id: "11111111-1111-4111-8111-111111111111",
  acknowledgement_token: "22222222-2222-4222-8222-222222222222",
  actor_role: "owner",
  render_instance_id: "33333333-3333-4333-8333-333333333333",
  client_rendered_at: "2026-09-28T12:00:00.000Z",
};

describe("POST /api/v2/learning-exposures/ack", () => {
  it("forwards the acknowledgement verbatim to the backend ack route", async () => {
    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost/api/v2/learning-exposures/ack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(BODY),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0].path).toBe("/v2/learning-exposures/ack");
    expect(calls[0].init.method).toBe("POST");
    expect(JSON.parse(String(calls[0].init.body))).toEqual(BODY);
    // Auth is demanded (callBackend's default, not overridden) and the
    // failure envelopes are the helper's own: nothing minted here.
    expect(calls[0].init.requireAuth).toBeUndefined();
    expect(calls[0].init.failures).toBeUndefined();
  });
});
