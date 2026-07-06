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
  it("200 → success with credits_remaining", async () => {
    mockFetch(200, { unlocked: true, arc_id: "a", credits_remaining: 12 });
    const r = await unlockArc("a");
    expect(r).toEqual({ ok: true, alreadyPaid: false, creditsRemaining: 12 });
  });

  it("409 already-paid → treated as success (idempotent double-tap)", async () => {
    mockFetch(409, { code: "ARC_ALREADY_PAID" });
    const r = await unlockArc("a");
    expect(r).toEqual({ ok: true, alreadyPaid: true, creditsRemaining: null });
  });

  it("402 → insufficient, with required/current/checkout_endpoint", async () => {
    mockFetch(402, {
      code: "INSUFFICIENT_CREDITS",
      required: 25,
      current: 4,
      checkout_endpoint: "/api/stripe/checkout",
    });
    const r = await unlockArc("a");
    expect(r).toEqual({
      ok: false,
      reason: "insufficient",
      required: 25,
      current: 4,
      checkoutEndpoint: "/api/stripe/checkout",
    });
  });

  it("402 missing fields → falls back to the credits peg + null endpoint", async () => {
    mockFetch(402, {});
    const r = await unlockArc("a");
    expect(r).toMatchObject({
      ok: false,
      reason: "insufficient",
      required: ARC_UNLOCK_CREDITS,
      current: null,
      checkoutEndpoint: null,
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
