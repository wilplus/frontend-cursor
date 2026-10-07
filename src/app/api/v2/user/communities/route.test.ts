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
      return NextResponse.json({ communities: [] }, { status: 200 });
    }),
  };
});

describe("/api/v2/user/communities", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("lists communities with GET and no body", async () => {
    const { GET } = await import("./route");
    const res = await GET(new NextRequest("http://localhost/api/v2/user/communities"));
    expect(res.status).toBe(200);
    const call = calls[calls.length - 1];
    expect(call.path).toBe("/v2/user/communities");
    expect(call.init.method).toBe("GET");
    expect(call.init.body).toBeUndefined();
  });

  it("creates a community and forwards the body", async () => {
    const { POST } = await import("./route");
    const body = { name: "North/West", pass_code: "p a/ss" };
    const res = await POST(
      new NextRequest("http://localhost/api/v2/user/communities", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(200);
    const call = calls[calls.length - 1];
    expect(call.path).toBe("/v2/user/communities");
    expect(call.init.method).toBe("POST");
    expect(JSON.parse(String(call.init.body))).toEqual(body);
  });
});
