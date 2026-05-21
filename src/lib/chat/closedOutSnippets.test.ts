import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  clearClosedOutSnippets,
  loadClosedOutSnippets,
  markClosedOut,
  saveClosedOutSnippets,
} from "./closedOutSnippets";

// Minimal in-memory localStorage shim. vitest's default `jsdom`/
// `happy-dom` envs aren't configured for this repo, so we stub it.
function makeLocalStorageStub() {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((k: string) => store.get(k) ?? null),
    setItem: vi.fn((k: string, v: string) => {
      store.set(k, v);
    }),
    removeItem: vi.fn((k: string) => {
      store.delete(k);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
    _store: store,
  };
}

describe("closedOutSnippets", () => {
  beforeEach(() => {
    const stub = makeLocalStorageStub();
    // @ts-expect-error — assigning to global for the test scope only.
    globalThis.window = { localStorage: stub } as Window;
  });

  describe("loadClosedOutSnippets()", () => {
    it("returns empty Set for unknown user", () => {
      expect(loadClosedOutSnippets("never-saved").size).toBe(0);
    });

    it("returns empty Set for null userId", () => {
      expect(loadClosedOutSnippets(null).size).toBe(0);
    });

    it("returns empty Set when SSR (no window)", () => {
      delete (globalThis as { window?: unknown }).window;
      expect(loadClosedOutSnippets("u1").size).toBe(0);
    });

    it("round-trips: save then load returns the same ids", () => {
      saveClosedOutSnippets("u1", new Set(["s1", "s2", "s3"]));
      const loaded = loadClosedOutSnippets("u1");
      expect(loaded.size).toBe(3);
      expect(loaded.has("s1")).toBe(true);
      expect(loaded.has("s2")).toBe(true);
      expect(loaded.has("s3")).toBe(true);
    });

    it("isolates by user — u1's set doesn't leak into u2's", () => {
      saveClosedOutSnippets("u1", new Set(["s1"]));
      saveClosedOutSnippets("u2", new Set(["s99"]));
      expect(loadClosedOutSnippets("u1").has("s99")).toBe(false);
      expect(loadClosedOutSnippets("u2").has("s1")).toBe(false);
    });

    it("returns empty on corrupted JSON (defensive)", () => {
      window.localStorage.setItem(
        "willonski.closedOutSnippets.u1",
        "this is not json"
      );
      expect(loadClosedOutSnippets("u1").size).toBe(0);
    });

    it("returns empty when the stored value is not an array", () => {
      window.localStorage.setItem(
        "willonski.closedOutSnippets.u1",
        JSON.stringify({ s1: true })
      );
      expect(loadClosedOutSnippets("u1").size).toBe(0);
    });
  });

  describe("markClosedOut()", () => {
    it("returns a new Set instance (React-state safe)", () => {
      const before = new Set<string>(["s1"]);
      const after = markClosedOut("u1", before, "s2");
      expect(after).not.toBe(before);
      expect(before.has("s2")).toBe(false); // before is untouched
      expect(after.has("s1")).toBe(true);
      expect(after.has("s2")).toBe(true);
    });

    it("persists to localStorage", () => {
      const result = markClosedOut("u1", new Set(), "s1");
      const reloaded = loadClosedOutSnippets("u1");
      expect(reloaded.has("s1")).toBe(true);
      expect(result.has("s1")).toBe(true);
    });

    it("null userId returns the new Set in-memory but skips persistence", () => {
      const result = markClosedOut(null, new Set(), "s1");
      expect(result.has("s1")).toBe(true);
      // No persistence call should have fired (key didn't land).
      expect(window.localStorage.getItem("willonski.closedOutSnippets.")).toBeNull();
    });
  });

  describe("clearClosedOutSnippets()", () => {
    it("removes the user's entry from localStorage", () => {
      saveClosedOutSnippets("u1", new Set(["s1"]));
      clearClosedOutSnippets("u1");
      expect(loadClosedOutSnippets("u1").size).toBe(0);
    });
  });
});
