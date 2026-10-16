import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/auth-client", () => ({
  getAuthToken: async () => "token",
}));

import { fetchTokenBalanceShared, forgetSharedTokenBalance } from "./tokens";

/* -------------------------------------------------------------------------- */
/*  The header's chip and the Lounge's top-up card each read the balance;     */
/*  a signed-in open must cost the balance endpoint one request, not one per  */
/*  wallet (founder 2026-10-16). A spend drops the shared read, so the chip   */
/*  never re-serves the number from before the purchase.                      */
/* -------------------------------------------------------------------------- */

const ready = {
  ok: true,
  json: async () => ({ enabled: true, available: true, balance: 120 }),
};

describe("the shared balance read", () => {
  afterEach(() => {
    forgetSharedTokenBalance();
    vi.unstubAllGlobals();
  });

  it("serves every wallet from one request, until a spend drops it", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ready);
    vi.stubGlobal("fetch", fetchMock);
    const [a, b] = await Promise.all([fetchTokenBalanceShared(), fetchTokenBalanceShared()]);
    expect(a.kind).toBe("ready");
    expect(b).toBe(a);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    forgetSharedTokenBalance();
    await fetchTokenBalanceShared();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not share an unreadable balance: the next wallet asks again", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    expect((await fetchTokenBalanceShared()).kind).toBe("unknown");
    await fetchTokenBalanceShared();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
