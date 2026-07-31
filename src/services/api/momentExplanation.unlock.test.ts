import { afterEach, describe, expect, it, vi } from "vitest";
import { unlockMoments } from "./momentExplanation";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: async () => "tok" }));

/* -------------------------------------------------------------------------- */
/*  Tokens are the only currency (credits retired, founder 2026-07-31), so the */
/*  wrong-currency mis-sale is gone. What remains is the split that still       */
/*  matters: a SHORTFALL is fixed by the monthly renewal or a plan change,      */
/*  while the COACH CAP is not a balance at all and no purchase lifts it — an   */
/*  upgrade nudge there is a sale that cannot deliver.                          */
/* -------------------------------------------------------------------------- */

function reply(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    })
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("unlockMoments", () => {
  it("carries the remaining balance on success", () => {
    reply(200, { unlocked: true, arc_id: "a1", tokens_remaining: 39000 });
    return expect(unlockMoments("a1")).resolves.toEqual({
      ok: true,
      tokensRemaining: 39000,
    });
  });

  it("still succeeds when the BE reports no token balance (flag off)", () => {
    reply(200, { unlocked: true, arc_id: "a1" });
    return expect(unlockMoments("a1")).resolves.toEqual({
      ok: true,
      tokensRemaining: null,
    });
  });

  it("reports a token shortfall as TOKENS, with what it needed", async () => {
    reply(402, {
      code: "INSUFFICIENT_TOKENS",
      required: 2500,
      current: 300,
      reason: "insufficient",
    });
    await expect(unlockMoments("a1")).resolves.toEqual({
      ok: false,
      reason: "insufficient_tokens",
      message: "Not enough tokens.",
      required: 2500,
      current: 300,
    });
  });

  it("reports the coach cap separately from a shortfall", async () => {
    // Same status, same endpoint, opposite remedy: waiting or upgrading, never
    // a top-up. Collapsing the two sends someone to buy what cannot help.
    reply(402, { code: "INSUFFICIENT_TOKENS", reason: "coach_cap_reached" });
    await expect(unlockMoments("a1")).resolves.toMatchObject({
      ok: false,
      reason: "coach_cap_reached",
    });
  });

  it("reads a legacy INSUFFICIENT_CREDITS 402 as a token shortfall", async () => {
    // Credits are retired (founder 2026-07-31). If an older backend or a
    // cached deploy still answers in the old code, the remedy the user needs is
    // the token one — there is no credits path left to send them down.
    reply(402, { code: "INSUFFICIENT_CREDITS" });
    await expect(unlockMoments("a1")).resolves.toMatchObject({
      ok: false,
      reason: "insufficient_tokens",
    });
  });

  it("treats an unlabelled 402 as a token shortfall", async () => {
    // Tokens are the only currency, so an ambiguous 402 has exactly one
    // sensible reading and no ambiguity left to preserve.
    reply(402, {});
    await expect(unlockMoments("a1")).resolves.toMatchObject({
      reason: "insufficient_tokens",
    });
  });

  it("surfaces the backend's own message for anything else", async () => {
    reply(500, { error: "Unlock service unavailable." });
    await expect(unlockMoments("a1")).resolves.toEqual({
      ok: false,
      reason: "error",
      message: "Unlock service unavailable.",
    });
  });
});
