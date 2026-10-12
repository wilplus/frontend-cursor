import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearPendingSend,
  getPendingSend,
  setPendingSend,
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
    setPendingSend("project-1", "take-1");
    expect(getPendingSend()).toEqual({
      projectId: "project-1",
      takeId: "take-1",
    });
    clearPendingSend();
    expect(getPendingSend()).toBeNull();
  });

});

