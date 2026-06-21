import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearStrongSidesAnchor,
  readStrongSidesAnchor,
  writeStrongSidesAnchor,
} from "./strongSidesAnchor";

type GlobalShim = {
  localStorage?: Pick<Storage, "getItem" | "setItem" | "removeItem">;
};

beforeEach(() => {
  const store = new Map<string, string>();
  (globalThis as unknown as GlobalShim).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
  };
});

afterEach(() => {
  delete (globalThis as unknown as GlobalShim).localStorage;
});

describe("strongSidesAnchor (handoff F — survives reload)", () => {
  it("returns null when nothing is stored", () => {
    expect(readStrongSidesAnchor()).toBeNull();
  });

  it("round-trips the anchor timestamp", () => {
    const ts = "2026-06-21T10:00:00.000Z";
    writeStrongSidesAnchor(ts);
    expect(readStrongSidesAnchor()).toBe(ts);
  });

  it("a new write re-anchors (overwrites the prior timestamp)", () => {
    writeStrongSidesAnchor("2026-06-21T10:00:00.000Z");
    writeStrongSidesAnchor("2026-06-21T11:30:00.000Z");
    expect(readStrongSidesAnchor()).toBe("2026-06-21T11:30:00.000Z");
  });

  it("clears the anchor", () => {
    writeStrongSidesAnchor("2026-06-21T10:00:00.000Z");
    clearStrongSidesAnchor();
    expect(readStrongSidesAnchor()).toBeNull();
  });

  it("treats an empty stored value as absent", () => {
    writeStrongSidesAnchor("");
    expect(readStrongSidesAnchor()).toBeNull();
  });
});
