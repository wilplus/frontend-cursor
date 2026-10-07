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
      return NextResponse.json({ clips: [] }, { status: 200 });
    }),
  };
});

describe("/api/v2/user/communities/queue", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads the queue with GET and no body", async () => {
    const { GET } = await import("./route");
    const res = await GET(new NextRequest("http://localhost/api/v2/user/communities/queue"));
    expect(res.status).toBe(200);
    const call = calls[calls.length - 1];
    expect(call.path).toBe("/v2/user/communities/queue");
    expect(call.init.method).toBe("GET");
    expect(call.init.body).toBeUndefined();
  });
});
