import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/auth-client", () => ({
  getAuthToken: async () => "token",
}));

import {
  fetchTokenPricesRead,
  resetTokenPricesCache,
  subscribeTokenPrices,
  type TokenPricesRead,
} from "./tokens";

/* -------------------------------------------------------------------------- */
/*  The price list is remembered across page loads (founder 2026-10-18): the  */
/*  next open paints the last published list with no round trip, the read    */
/*  still goes out behind the paint, and only a DIFFERENT answer replaces     */
/*  what is on screen. A blip keeps the list; the flag turned off removes it. */
/* -------------------------------------------------------------------------- */

class MemoryStorage {
  private rows = new Map<string, string>();
  getItem(key: string): string | null {
    return this.rows.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.rows.set(key, value);
  }
  removeItem(key: string): void {
    this.rows.delete(key);
  }
}

const v1 = {
  enabled: true,
  price_version: "v1",
  actions: { chat: 150 },
  bands: [{ action: "take_short", max_seconds: 120, price: 1000 }],
  tiers: {},
};
const v2 = { ...v1, price_version: "v2", actions: { chat: 200 } };

function answering(body: unknown) {
  return vi.fn().mockResolvedValue({ ok: true, text: async () => JSON.stringify(body) });
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("the remembered price list", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { localStorage: new MemoryStorage() });
    vi.stubGlobal("localStorage", window.localStorage);
  });
  afterEach(() => {
    resetTokenPricesCache();
    vi.unstubAllGlobals();
  });

  it("is kept from a live read and served first on the next open, then confirmed behind it", async () => {
    vi.stubGlobal("fetch", answering(v1));
    expect((await fetchTokenPricesRead()).kind).toBe("ready");
    expect(localStorage.getItem("willab.tokenPrices")).toContain('"v1"');

    // A new page: memory is empty, the store is not. The fetch is slow and
    // the list is on screen before it answers.
    resetMemoryOnly();
    let release: (v: unknown) => void = () => {};
    const slow = vi.fn().mockReturnValue(new Promise((r) => (release = r)));
    vi.stubGlobal("fetch", slow);
    const heard: TokenPricesRead[] = [];
    const unsubscribe = subscribeTokenPrices((r) => heard.push(r));

    const first = await fetchTokenPricesRead();
    expect(first.kind).toBe("ready");
    expect(first.kind === "ready" && first.prices.actions.chat).toBe(150);
    expect(slow).toHaveBeenCalledTimes(1);

    // The same list comes back: nobody is told, nothing re-renders.
    release({ ok: true, text: async () => JSON.stringify(v1) });
    await flush();
    expect(heard).toEqual([]);
    unsubscribe();
  });

  it("replaces the shown list when the backend publishes a new one", async () => {
    localStorage.setItem("willab.tokenPrices", JSON.stringify(v1));
    vi.stubGlobal("fetch", answering(v2));
    const heard: TokenPricesRead[] = [];
    const unsubscribe = subscribeTokenPrices((r) => heard.push(r));

    const first = await fetchTokenPricesRead();
    expect(first.kind === "ready" && first.prices.priceVersion).toBe("v1");
    await flush();
    expect(heard).toHaveLength(1);
    expect(heard[0].kind === "ready" && heard[0].prices.actions.chat).toBe(200);
    // And the next page starts from the new list.
    expect(localStorage.getItem("willab.tokenPrices")).toContain('"v2"');
    unsubscribe();
  });

  it("keeps the shown list through a blip, and drops it when pricing is turned off", async () => {
    localStorage.setItem("willab.tokenPrices", JSON.stringify(v1));
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const heard: TokenPricesRead[] = [];
    const unsubscribe = subscribeTokenPrices((r) => heard.push(r));
    expect((await fetchTokenPricesRead()).kind).toBe("ready");
    await flush();
    expect(heard).toEqual([]);
    expect(localStorage.getItem("willab.tokenPrices")).toContain('"v1"');

    resetMemoryOnly();
    vi.stubGlobal("fetch", answering({ enabled: false }));
    expect((await fetchTokenPricesRead()).kind).toBe("ready");
    await flush();
    expect(heard).toEqual([{ kind: "off" }]);
    expect(localStorage.getItem("willab.tokenPrices")).toBeNull();
    unsubscribe();
  });

  it("never serves a copy the parser rejects", async () => {
    localStorage.setItem("willab.tokenPrices", "{not json");
    vi.stubGlobal("fetch", answering(v1));
    expect((await fetchTokenPricesRead()).kind).toBe("ready");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

/** A new page load: the memoised read is gone, the stored copy is not. */
function resetMemoryOnly() {
  const kept = localStorage.getItem("willab.tokenPrices");
  resetTokenPricesCache();
  if (kept) localStorage.setItem("willab.tokenPrices", kept);
}
