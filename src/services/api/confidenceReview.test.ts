import { afterEach, describe, expect, it, vi } from "vitest";
import { submitConfidenceReview } from "./confidenceReview";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: async () => "tok" }));

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("submitConfidenceReview", () => {
  it("posts { ai_correct } as a real boolean and reads saved:true", async () => {
    const fn = mockFetch(200, { saved: true, snippet_id: "s1", ai_correct: false });
    const r = await submitConfidenceReview({ snippetId: "s1", aiCorrect: false });
    expect(r).toEqual({ saved: true });
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/v2/user/snippets/s1/confidence-review");
    expect(JSON.parse(String(init.body))).toEqual({ ai_correct: false });
  });

  it("carries model_version only when the surface provides one", async () => {
    const fn = mockFetch(200, { saved: true });
    await submitConfidenceReview({
      snippetId: "s1",
      aiCorrect: true,
      modelVersion: "shadow-2026-08-01",
    });
    const [, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      ai_correct: true,
      model_version: "shadow-2026-08-01",
    });
  });

  it("REFUSES a non-boolean flag without a network call — a coerced label would fabricate training data", async () => {
    const fn = mockFetch(200, { saved: true });
    const r = await submitConfidenceReview({
      snippetId: "s1",
      // Runtime junk a buggy caller could pass despite the compile-time type.
      aiCorrect: "true" as unknown as boolean,
    });
    expect(r).toEqual({ saved: false });
    expect(fn).not.toHaveBeenCalled();
  });

  it("non-2xx and thrown fetch both degrade to saved:false (fire-and-forget)", async () => {
    mockFetch(401, { code: "UNAUTHENTICATED" });
    expect(await submitConfidenceReview({ snippetId: "s1", aiCorrect: true }))
      .toEqual({ saved: false });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("net"); }));
    expect(await submitConfidenceReview({ snippetId: "s1", aiCorrect: true }))
      .toEqual({ saved: false });
  });

  it("saved is strictly compared — a truthy non-true echo is not a save", async () => {
    mockFetch(200, { saved: "yes" });
    expect(await submitConfidenceReview({ snippetId: "s1", aiCorrect: true }))
      .toEqual({ saved: false });
  });
});
