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
      return NextResponse.json({ recorded: true }, { status: 200 });
    }),
  };
});

describe("/api/v2/user/communities/answers", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("relays the clip answer body", async () => {
    const { POST } = await import("./route");
    const body = { clip_id: "clip/a b", value: "yes" };
    const res = await POST(
      new NextRequest("http://localhost/api/v2/user/communities/answers", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(200);
    const call = calls[calls.length - 1];
    expect(call.path).toBe("/v2/user/communities/answers");
    expect(call.init.method).toBe("POST");
    expect(JSON.parse(String(call.init.body))).toEqual(body);
  });
});
