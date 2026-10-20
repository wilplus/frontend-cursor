/*
STORY    As a speaker, I want to be able to cancel my own account deletion,
         and nobody to reach the erase-my-data route through the app, so
         that deletion is safe both ways.
OUTCOME
  O1  Cancelling one's own deletion (POST with a valid deletion id) reaches
      the backend and is never cached.
  O2  The cancel is refused (404, nothing sent) as a GET, with a bad id, or
      with a wrong path.
  O3  The status read and "terminate" still go through; data-rights,
      data-export and trick names are 404 with nothing sent.
PROVES   O1 -> "forwards a cancel of one's own account deletion"
         O2 -> "forwards the cancel only as a POST, and only with a UUID"
         O3 -> "still forwards what it did, and still nothing else"
WHY      Founder's Wave 3 answers 2026-10-05 (N48.4 Q14 A).
*/
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("server-only", () => ({}));

const calls: Array<{ path: string; init: Record<string, unknown> }> = [];
vi.mock("@/app/api/_lib/backend", () => ({
  callBackend: vi.fn(async (path: string, init: Record<string, unknown>) => {
    calls.push({ path, init });
    return NextResponse.json({ ok: true }, { status: 200 });
  }),
}));

const PURGE = "0f8fad5b-d9cb-469f-a165-70867728950e";

async function send(method: "GET" | "POST", path: string[]) {
  const { GET, POST } = await import("./route");
  const request = new NextRequest(
    `http://localhost/api/v2/processing-authorization/${path.join("/")}`,
    { method, ...(method === "POST" ? { body: "{}" } : {}) },
  );
  return (method === "GET" ? GET : POST)(request, { params: { path } });
}

beforeEach(() => {
  calls.length = 0;
});

describe("the processing-authorization lane", () => {
  it("forwards a cancel of one's own account deletion", async () => {
    const response = await send("POST", ["deletion", PURGE, "cancel"]);
    expect(response.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0].path).toBe(`/v2/processing-authorization/deletion/${PURGE}/cancel`);
    expect(calls[0].init.method).toBe("POST");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("forwards the cancel only as a POST, and only with a UUID", async () => {
    for (const [method, path] of [
      ["GET", ["deletion", PURGE, "cancel"]],
      ["POST", ["deletion", "not-a-uuid", "cancel"]],
      ["POST", ["deletion", `${PURGE}x`, "cancel"]],
      ["POST", ["deletion", PURGE]],
      ["POST", ["deletion", PURGE, "cancel", "more"]],
    ] as const) {
      const response = await send(method, [...path]);
      expect(response.status, `${method} ${path.join("/")}`).toBe(404);
    }
    expect(calls).toHaveLength(0);
  });

  it("still forwards what it did, and still nothing else", async () => {
    expect((await send("GET", [])).status).toBe(200);
    expect((await send("POST", ["terminate"])).status).toBe(200);
    for (const path of [["data-rights"], ["data-export"], ["constructor"], ["__proto__"]]) {
      expect((await send("POST", path)).status, path.join("/")).toBe(404);
      expect((await send("GET", path)).status, path.join("/")).toBe(404);
    }
    expect(calls.map((c) => c.path)).toEqual([
      "/v2/processing-authorization",
      "/v2/processing-authorization/terminate",
    ]);
  });
});
