import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readWillabProfile, writeWillabProfile } from "./willabProfile";

type WinShim = {
  window?: { localStorage: Pick<Storage, "getItem" | "setItem" | "removeItem"> };
};

const KEY = "willab.profile";
const ls = () => (globalThis as unknown as WinShim).window!.localStorage;

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

describe("willabProfile store", () => {
  it("round-trips a written profile", () => {
    writeWillabProfile({ domain: "sales", goal: "sound steady on pricing" });
    expect(readWillabProfile()).toEqual({
      domain: "sales",
      goal: "sound steady on pricing",
    });
  });

  it("returns null when nothing is stored", () => {
    expect(readWillabProfile()).toBeNull();
  });

  it("defaults a missing goal to an empty string", () => {
    ls().setItem(KEY, JSON.stringify({ domain: "sales" }));
    expect(readWillabProfile()).toEqual({ domain: "sales", goal: "" });
  });

  it("returns null on malformed JSON", () => {
    ls().setItem(KEY, "{ not json");
    expect(readWillabProfile()).toBeNull();
  });

  it("returns null when the domain is absent", () => {
    ls().setItem(KEY, JSON.stringify({ goal: "no domain" }));
    expect(readWillabProfile()).toBeNull();
  });
});
