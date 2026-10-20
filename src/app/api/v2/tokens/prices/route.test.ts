/*
STORY    As a speaker, I want the token price list to load fast and always
         match what the backend said, so that I see correct prices.
OUTCOME
  O1  The backend is asked once; later reads are served from a copy that
      is exactly the backend's answer.
  O2  A signed-out read is still refused while a copy is held.
  O3  The "prices switched off" answer is kept too, but an error is never
      kept: the next read asks the backend again.
PROVES   O1 -> "asks the backend once and answers the next reads from its copy, as the backend said it"
         O2 -> "still refuses a signed-out read while it holds a copy"
         O3 -> "keeps the flag-off body too, and never an error"
WHY      Founder 2026-10-18: the price list is the same for everyone.
*/
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("server-only", () => ({}));

const ctx: { token: string | null; upstream: () => NextResponse } = {
  token: "token",
  upstream: () => NextResponse.json({ enabled: true, price_version: "v1" }),
};
const calls: string[] = [];
vi.mock("@/app/api/_lib/backend", async () => {
  const actual = await vi.importActual<typeof import("@/app/api/_lib/backend")>(
    "@/app/api/_lib/backend",
  );
  return {
    ...actual,
    getAccessToken: vi.fn(async () => ctx.token),
    callBackend: vi.fn(async (path: string) => {
      calls.push(path);
      if (!ctx.token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      return ctx.upstream();
    }),
  };
});

const get = async () => {
  const { GET } = await import("./route");
  return GET(new NextRequest("http://localhost/api/v2/tokens/prices"));
};

describe("GET /api/v2/tokens/prices", () => {
  beforeEach(() => {
    vi.resetModules();
    calls.length = 0;
    ctx.token = "token";
    ctx.upstream = () => NextResponse.json({ enabled: true, price_version: "v1" });
  });

  it("asks the backend once and answers the next reads from its copy, as the backend said it", async () => {
    const first = await get();
    expect(first.status).toBe(200);
    const second = await get();
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ enabled: true, price_version: "v1" });
    expect(second.headers.get("Server-Timing")).toContain("copy");
    expect(calls).toEqual(["/v2/tokens/prices"]);
  });

  it("still refuses a signed-out read while it holds a copy", async () => {
    await get();
    ctx.token = null;
    const res = await get();
    expect(res.status).toBe(401);
    expect(calls).toHaveLength(1);
  });

  it("keeps the flag-off body too, and never an error", async () => {
    ctx.upstream = () => NextResponse.json({ enabled: false });
    await get();
    expect(await (await get()).json()).toEqual({ enabled: false });
    expect(calls).toHaveLength(1);

    vi.resetModules();
    calls.length = 0;
    ctx.upstream = () => NextResponse.json({ error: "down" }, { status: 502 });
    expect((await get()).status).toBe(502);
    expect((await get()).status).toBe(502);
    expect(calls).toHaveLength(2);
  });
});
