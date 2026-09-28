/**
 * The exposure-receipt leg exists and forwards the acknowledgement as it
 * came (G-1, audit 2026-09-22). Before this file the client posted here and
 * every call 404ed against Next.js, so no receipt was ever recorded.
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

  it("relays the backend strictly: a non-JSON upstream becomes UPSTREAM_NON_JSON at its status", async () => {
    const { POST } = await import("./route");
    await POST(
      new NextRequest("http://localhost/api/v2/learning-exposures/ack", {
        method: "POST",
        body: JSON.stringify(BODY),
      }),
    );
    const relay = calls[calls.length - 1].init.relay as (
      upstream: Response,
    ) => Promise<Response>;
    const answered = await relay(new Response("<html>bad gateway</html>", { status: 502 }));
    expect(answered.status).toBe(502);
    expect(await answered.json()).toEqual({
      code: "UPSTREAM_NON_JSON",
      error: "Unexpected backend response (HTTP 502).",
    });
    const empty = await relay(new Response("", { status: 200 }));
    expect(await empty.json()).toEqual({});
  });

  it("adds nothing of its own to the payload", async () => {
    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost/api/v2/learning-exposures/ack", {
      method: "POST",
      body: "",
    });
    await POST(req);
    expect(String(calls[calls.length - 1].init.body)).toBe("{}");
  });
});
