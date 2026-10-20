// @vitest-environment jsdom
/*
STORY    As a speaker, I want my balance read once per page and re-read after
         I spend, so that the number I see is never from before a purchase.
OUTCOME
  O1  Wallets reading at the same time share one balance request.
  O2  A spend anywhere in the app (the tokens-spent window event) drops the
      shared read: the wallet asks the server again and shows the new number.
  O3  An unreadable balance is not shared: the next wallet asks again.
PROVES   O1 -> "serves every wallet from one request"
         O2 -> "a spend makes the wallet read the balance again"
         O3 -> "does not share an unreadable balance: the next wallet asks again"
WHY      Founder 2026-10-16: one balance request per open, not one per wallet.
*/
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/auth-client", () => ({
  getAuthToken: async () => "token",
}));

import { useTokenWallet } from "@/hooks/useTokenWallet";
import { WILLAB_TOKENS_SPENT_EVENT } from "@/lib/willabWindowEvents";
import {
  fetchTokenBalanceShared,
  forgetSharedTokenBalance,
  resetTokenPricesCache,
} from "./tokens";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ready = (balance: number) => ({
  ok: true,
  status: 200,
  json: async () => ({ enabled: true, available: true, balance }),
});

describe("the shared balance read", () => {
  afterEach(() => {
    forgetSharedTokenBalance();
    resetTokenPricesCache();
    vi.unstubAllGlobals();
  });

  it("serves every wallet from one request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ready(120));
    vi.stubGlobal("fetch", fetchMock);
    const [a, b] = await Promise.all([fetchTokenBalanceShared(), fetchTokenBalanceShared()]);
    expect(a.kind).toBe("ready");
    expect(b).toBe(a);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("a spend makes the wallet read the balance again", async () => {
    const balances = [120, 80];
    const balanceReads = vi.fn(async () => ready(balances.shift() ?? 80));
    vi.stubGlobal("fetch", vi.fn(async (url: string) =>
      String(url).includes("/balance")
        ? balanceReads()
        : new Response(JSON.stringify({ enabled: true, actions: {}, bands: [], tiers: {} })),
    ));

    function Chip() {
      const { balance } = useTokenWallet(true);
      return createElement("span", null, balance.kind === "ready" ? String(balance.balance) : "-");
    }
    const container = document.createElement("div");
    const root = createRoot(container);
    const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    try {
      act(() => root.render(createElement(Chip)));
      await flush();
      expect(container.textContent).toBe("120");
      // Another wallet in the same window is still served the shared read.
      await fetchTokenBalanceShared();
      expect(balanceReads).toHaveBeenCalledTimes(1);

      act(() => { window.dispatchEvent(new Event(WILLAB_TOKENS_SPENT_EVENT)); });
      await flush();
      expect(balanceReads).toHaveBeenCalledTimes(2);
      expect(container.textContent).toBe("80");
    } finally {
      act(() => root.unmount());
    }
  });

  it("does not share an unreadable balance: the next wallet asks again", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    expect((await fetchTokenBalanceShared()).kind).toBe("unknown");
    await fetchTokenBalanceShared();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
