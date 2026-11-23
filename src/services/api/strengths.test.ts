/*
STORY    As a speaker, I want the server's refusal to delete a Take with
         history to reach me unchanged, so my project's history stays whole.
OUTCOME  O1  The signed-in deletion route preserves TAKE_HAS_LINEAGE and its
             explanation, with one request for the exact presentation/Take.
PROVES   O1 -> "preserves the server's history refusal for the requested Take"
WHY      Never 5 and App Model SET-07. The retired strengths client is gone;
         this stable story path now checks the surviving public BFF boundary.
*/
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ Authorization: "Bearer owner-token" }),
  cookies: async () => ({ getAll: () => [], set: () => undefined }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Take deletion protects history", () => {
  it("preserves the server's history refusal for the requested Take", async () => {
    vi.stubEnv("BACKEND_URL_INTERNAL", "https://backend.test");
    const refusal = {
      code: "TAKE_HAS_LINEAGE",
      error: "This take can't be deleted on its own. It's part of your project's history.",
    };
    const fetch = vi.fn(async () => Response.json(refusal, { status: 409 }));
    vi.stubGlobal("fetch", fetch);
    vi.resetModules();
    const { DELETE } = await import(
      "@/app/api/v2/user/presentations/[presentationId]/takes/[takeNumber]/route"
    );
    const response = await DELETE(new NextRequest("https://app.test"), {
      params: { presentationId: "presentation-1", takeNumber: "2" },
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual(refusal);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      "https://backend.test/v2/user/presentations/presentation-1/takes/2",
      expect.objectContaining({
        method: "DELETE",
        headers: expect.objectContaining({ Authorization: "Bearer owner-token" }),
      }),
    );
  });
});
