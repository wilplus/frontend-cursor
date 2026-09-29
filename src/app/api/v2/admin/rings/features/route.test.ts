/**
 * The rings panel's BFF legs forward to the backend through callBackend with
 * the strict relay and no envelope of their own (rings, the backend rings migration). One
 * read and one write are exercised here; every leg's envelope is pinned in
 * bffEnvelopes.golden.json.
 */
import { describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("server-only", () => ({}));

const calls: Array<{ path: string; init: Record<string, unknown> }> = [];
vi.mock("@/app/api/_lib/backend", async () => {
  const actual = await vi.importActual<typeof import("@/app/api/_lib/backend")>("@/app/api/_lib/backend");
  return {
    ...actual,
    callBackend: vi.fn(async (path: string, init: Record<string, unknown>) => {
      calls.push({ path, init });
      return NextResponse.json({ features: [] }, { status: 200 });
    }),
  };
});

describe("/api/v2/admin/rings/*", () => {
  it("lists features through the backend with no-store and the strict relay", async () => {
    const { GET } = await import("./route");
    const res = await GET(new NextRequest("http://localhost/api/v2/admin/rings/features"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const call = calls[calls.length - 1];
    expect(call.path).toBe("/v2/admin/rings/features");
    expect(call.init.method).toBe("GET");
    expect(call.init.requireAuth).toBeUndefined();
    expect(call.init.failures).toBeUndefined();
    const relay = call.init.relay as (upstream: Response) => Promise<Response>;
    const answered = await relay(new Response("<html>bad gateway</html>", { status: 502 }));
    expect(await answered.json()).toEqual({ code: "UPSTREAM_NON_JSON", error: "Unexpected backend response (HTTP 502)." });
  });

  it("a kill forwards the body verbatim to the feature's kill leg", async () => {
    const { POST } = await import("./[feature]/kill/route");
    const req = new NextRequest("http://localhost/api/v2/admin/rings/features/exercise_service_ui/kill", {
      method: "POST",
      body: JSON.stringify({ killed: true }),
    });
    await POST(req, { params: { feature: "exercise_service_ui" } });
    const call = calls[calls.length - 1];
    expect(call.path).toBe("/v2/admin/rings/features/exercise_service_ui/kill");
    expect(call.init.method).toBe("POST");
    expect(JSON.parse(String(call.init.body))).toEqual({ killed: true });
  });

  it("the people list forwards only allowlisted query keys", async () => {
    const { GET } = await import("../people/route");
    await GET(new NextRequest("http://localhost/api/v2/admin/rings/people?search=ola&region=PL&evil=1&limit=20"));
    const call = calls[calls.length - 1];
    expect(call.path).toBe("/v2/admin/rings/people?search=ola&region=PL&limit=20");
  });
});
