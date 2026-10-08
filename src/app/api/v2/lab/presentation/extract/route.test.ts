import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const calls = vi.hoisted(() => [] as Array<{ path: string; init: Record<string, unknown> }>);
let sessionToken: string | null = null;
vi.mock("@/app/api/_lib/backend", async () => {
  const actual = await vi.importActual<typeof import("@/app/api/_lib/backend")>("@/app/api/_lib/backend");
  return {
    ...actual,
    getAccessToken: vi.fn(async () => sessionToken),
    backendFetch: vi.fn(async (path: string, init: Record<string, unknown>) => {
      calls.push({ path, init });
      return new Response(JSON.stringify({ slides: [] }), { status: 200 });
    }),
  };
});

function upload(headers: Record<string, string> = {}): NextRequest {
  const form = new FormData();
  form.append("file", new Blob(["%PDF"], { type: "application/pdf" }), "deck.pdf");
  return new NextRequest("http://localhost/api/v2/lab/presentation/extract", {
    method: "POST",
    body: form,
    headers,
  });
}

afterEach(() => {
  calls.length = 0;
  sessionToken = null;
});

/* The deck could not be uploaded (2026-10-08): the backend's processing gate
   covers /v2/lab/, and this proxy dropped the guest owner token, so a guest's
   deck was refused before the parser ran. */
describe("/api/v2/lab/presentation/extract", () => {
  it("forwards a guest's owner token", async () => {
    const { POST } = await import("./route");
    const res = await POST(upload({ "X-Willab-Guest-Owner": "guest.token" }));
    expect(res.status).toBe(200);
    const call = calls[calls.length - 1];
    expect(call.path).toBe("/v2/lab/presentation/extract");
    expect(call.init.headers).toEqual({ "X-Willab-Guest-Owner": "guest.token" });
  });

  it("sends no guest header when none came in", async () => {
    sessionToken = "tok";
    const { POST } = await import("./route");
    await POST(upload());
    const call = calls[calls.length - 1];
    expect(call.init.headers).toBeUndefined();
    expect(call.init.token).toBe("tok");
  });
});
