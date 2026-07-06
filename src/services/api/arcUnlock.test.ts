import { afterEach, describe, expect, it, vi } from "vitest";
import { unlockArc, ARC_UNLOCK_CREDITS } from "./arcUnlock";

vi.mock("@/lib/api/auth-client", () => ({
  getAuthToken: async () => "tok",
}));

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    }))
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("unlockArc", () => {
  it("200 fresh unlock → success with credits_remaining", async () => {
    mockFetch(200, { unlocked: true, arc_id: "a", credits_remaining: 12 });
    const r = await unlockArc("a");
    expect(r).toEqual({ ok: true, alreadyPaid: false, creditsRemaining: 12 });
  });

  it("200 already_entitled pre-check → success, alreadyPaid, no credits charged", async () => {
    mockFetch(200, { already_entitled: true, arc_id: "a" });
    const r = await unlockArc("a");
    expect(r).toEqual({ ok: true, alreadyPaid: true, creditsRemaining: null });
  });

  it("409 already-paid (raced) → treated as success", async () => {
    mockFetch(409, { code: "ARC_ALREADY_PAID", arc_id: "a" });
    const r = await unlockArc("a");
    expect(r).toEqual({ ok: true, alreadyPaid: true, creditsRemaining: null });
  });

  it("402 → insufficient with required/current (no checkout_endpoint key ever)", async () => {
    mockFetch(402, { code: "INSUFFICIENT_CREDITS", required: 25, current: 4 });
    const r = await unlockArc("a");
    expect(r).toEqual({
      ok: false,
      reason: "insufficient",
      required: 25,
      current: 4,
    });
    // The BE never sends checkout_endpoint; the result must not surface one.
    expect("checkoutEndpoint" in (r as object)).toBe(false);
  });

  it("402 missing fields → falls back to the credits peg", async () => {
    mockFetch(402, {});
    const r = await unlockArc("a");
    expect(r).toEqual({
      ok: false,
      reason: "insufficient",
      required: ARC_UNLOCK_CREDITS,
      current: null,
    });
  });

  it("404 (route not shipped yet) → error, so the caller can fall back", async () => {
    mockFetch(404, null);
    const r = await unlockArc("a");
    expect(r).toMatchObject({ ok: false, reason: "error" });
  });

  it("network throw → error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      })
    );
    const r = await unlockArc("a");
    expect(r).toMatchObject({ ok: false, reason: "error" });
  });
});
