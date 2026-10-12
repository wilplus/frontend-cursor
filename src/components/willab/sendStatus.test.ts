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

  it("rejects the retired bare-session handoff", () => {
    window.localStorage.setItem("willab.pending_send", "sess-legacy");
    expect(getPendingSend()).toBeNull();
  });
});

describe("sendStatus — no step rides the sign-up any more", () => {
  it("drops a stored 'See next steps' step: the button is gone (Q-B10 A)", () => {
    window.localStorage.setItem(
      "willab.pending_send",
      JSON.stringify({ projectId: "p1", takeId: "t1", then: "journey_next_steps" }),
    );
    expect(getPendingSend()).toEqual({ projectId: "p1", takeId: "t1" });
  });
});
