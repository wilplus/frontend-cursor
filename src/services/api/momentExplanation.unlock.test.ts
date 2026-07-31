import { afterEach, describe, expect, it, vi } from "vitest";
import { unlockMoments } from "./momentExplanation";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: async () => "tok" }));

/* -------------------------------------------------------------------------- */
/*  The unlock 402 is the one place the FE can charge someone for the wrong    */
/*  thing. Credits and tokens are DIFFERENT CURRENCIES: the credit-pack        */
/*  checkout does not add tokens, so routing a token-poor user there takes     */
/*  their money for something that cannot unlock anything. And the coach cap   */
/*  is not a balance at all — no purchase lifts it, so an upgrade nudge there  */
/*  is a sale that cannot deliver.                                             */
/*                                                                            */
/*  Each test below is one of those mis-sales.                                 */
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

  it("keeps the legacy credits 402 on the credits path", async () => {
    // The live behaviour while the flag is off. A credit top-up genuinely
    // fixes this one, so it is the only 402 allowed to reach the pack page.
    reply(402, { code: "INSUFFICIENT_CREDITS" });
    await expect(unlockMoments("a1")).resolves.toMatchObject({
      ok: false,
      reason: "insufficient_credits",
    });
  });

  it("treats an unlabelled 402 as credits, not tokens", async () => {
    // Ambiguous payloads stay on today's path. Guessing "tokens" would strand
    // a credits user with a renewal date that has nothing to do with them.
    reply(402, {});
    await expect(unlockMoments("a1")).resolves.toMatchObject({
      reason: "insufficient_credits",
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
