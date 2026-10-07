import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("server-only", () => ({}));

const calls = vi.hoisted(() => [] as Array<{ path: string; init: Record<string, unknown> }>);
vi.mock("@/app/api/_lib/backend", async () => {
  const actual = await vi.importActual<typeof import("@/app/api/_lib/backend")>("@/app/api/_lib/backend");
  return {
    ...actual,
    callBackend: vi.fn(async (path: string, init: Record<string, unknown>) => {
      calls.push({ path, init });
      return NextResponse.json({ outcome: "done" }, { status: 200 });
    }),
  };
});

describe("/api/v2/user/confidence-practice/[practiceId]/attempts/[attemptId]/check", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("relays an empty check body to the encoded attempt path", async () => {
    const { POST } = await import("./route");
    const practiceId = "prac/a b";
    const attemptId = "att/x y";
    const res = await POST(
      new NextRequest("http://localhost/api/v2/user/confidence-practice/check", { method: "POST" }),
      { params: { practiceId, attemptId } },
    );
    expect(res.status).toBe(200);
    const call = calls[calls.length - 1];
    expect(call.path).toBe(
      `/v2/user/confidence-practice/${encodeURIComponent(practiceId)}/attempts/${encodeURIComponent(attemptId)}/check`,
    );
    expect(call.init.method).toBe("POST");
    expect(JSON.parse(String(call.init.body))).toEqual({});
  });
});
