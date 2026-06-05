import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearPendingSend,
  clearInsightsReady,
  clearReviewPending,
  getInsightsReady,
  getPendingSend,
  getReviewPending,
  hasReviewPending,
  setInsightsReady,
  setPendingSend,
  setReviewPending,
} from "./sendStatus";

type WinShim = {
  window?: { localStorage: Pick<Storage, "getItem" | "setItem" | "removeItem"> };
};

beforeEach(() => {
  const store = new Map<string, string>();
  (globalThis as unknown as WinShim).window = {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    },
  };
});

afterEach(() => {
  delete (globalThis as unknown as WinShim).window;
});

describe("sendStatus — pending send", () => {
  it("round-trips and clears", () => {
    expect(getPendingSend()).toBeNull();
    setPendingSend("sess-1");
    expect(getPendingSend()).toBe("sess-1");
    clearPendingSend();
    expect(getPendingSend()).toBeNull();
  });
});

describe("sendStatus — review pending flag", () => {
  it("sets, reads, clears", () => {
    expect(hasReviewPending()).toBe(false);
    setReviewPending();
    expect(hasReviewPending()).toBe(true);
    clearReviewPending();
    expect(hasReviewPending()).toBe(false);
  });

  it("stores the in-review session id and reads it back", () => {
    setReviewPending("sess-9");
    expect(hasReviewPending()).toBe(true);
    expect(getReviewPending()).toBe("sess-9");
    clearReviewPending();
    expect(getReviewPending()).toBeNull();
  });

  it("pending without an id (legacy) is flagged but has no session id", () => {
    setReviewPending();
    expect(hasReviewPending()).toBe(true);
    expect(getReviewPending()).toBeNull();
  });
});

describe("sendStatus — insights ready", () => {
  it("round-trips the published session id and clears", () => {
    expect(getInsightsReady()).toBeNull();
    setInsightsReady("sess-pub");
    expect(getInsightsReady()).toBe("sess-pub");
    clearInsightsReady();
    expect(getInsightsReady()).toBeNull();
  });
});
