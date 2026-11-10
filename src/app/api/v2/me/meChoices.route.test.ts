/*
STORY    As a newcomer, I want my "Join" / "Not now" answer to the community
         offer and my speaking-match switch saved, so that the choice I make
         is the one the backend keeps.
OUTCOME
  O1  The community-offer answer is sent (POST) to the backend with its body.
  O2  The speaking-match switch is sent (POST) to the backend with its body.
PROVES   O1 -> "relays the community-offer answer with its body"
         O2 -> "relays the speaking-match switch with its body"
*/
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("server-only", () => ({}));

const calls = vi.hoisted(() => [] as Array<{ path: string; init: Record<string, unknown> }>);
vi.mock("@/app/api/_lib/backend", async () => {
  const actual = await vi.importActual<typeof import("@/app/api/_lib/backend")>("@/app/api/_lib/backend");
  return {
    ...actual,
    callBackend: vi.fn(async (path: string, init: Record<string, unknown>) => {
      calls.push({ path, init });
      return NextResponse.json({}, { status: 200 });
    }),
  };
});

const post = (body: unknown) =>
  new NextRequest("http://localhost/api/v2/me/x", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });

describe("/api/v2/me choices reach the backend with their body", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it("relays the community-offer answer with its body", async () => {
    const { POST } = await import("./community-offer/route");
    const body = { id: "c1", answer: "not_now" };
    const res = await POST(post(body), { params: {} });
    expect(res.status).toBe(200);
    expect(calls[0].path).toBe("/v2/me/community-offer");
    expect(calls[0].init.method).toBe("POST");
    expect(JSON.parse(String(calls[0].init.body))).toEqual(body);
  });

  it("relays the speaking-match switch with its body", async () => {
    const { POST } = await import("./speaking-match/route");
    const res = await POST(post({ on: false }), { params: {} });
    expect(res.status).toBe(200);
    expect(calls[0].path).toBe("/v2/me/speaking-match");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ on: false });
  });
});
