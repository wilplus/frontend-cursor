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
      return NextResponse.json({ take_session_id: "t", community_ids: [], none: false }, { status: 200 });
    }),
  };
});

describe("/api/v2/user/takes/[takeSessionId]/share", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("relays the share body to the encoded take path", async () => {
    const { PUT } = await import("./route");
    const takeSessionId = "take/id 1";
    const body = { general: true, community_ids: ["c/1"], none: false };
    const res = await PUT(
      new NextRequest("http://localhost/api/v2/user/takes/share", {
        method: "PUT",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      }),
      { params: { takeSessionId } },
    );
    expect(res.status).toBe(200);
    const call = calls[calls.length - 1];
    expect(call.path).toBe(`/v2/user/takes/${encodeURIComponent(takeSessionId)}/share`);
    expect(call.init.method).toBe("PUT");
    expect(JSON.parse(String(call.init.body))).toEqual(body);
  });
});
