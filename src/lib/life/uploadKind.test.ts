import { describe, expect, it } from "vitest";
import { uploadKindForPath } from "./uploadKind";
import { LIFE_VIEWS } from "./menu";

describe("uploadKindForPath", () => {
  it("points the dock at the kind the view holds", () => {
    expect(uploadKindForPath("/panel/phrases")).toBe("phrase");
    expect(uploadKindForPath("/panel/principles")).toBe("principle");
    expect(uploadKindForPath("/panel/wins")).toBe("win");
    expect(uploadKindForPath("/panel/goals")).toBe("goal");
    expect(uploadKindForPath("/panel/distractions")).toBe("distraction");
    expect(uploadKindForPath("/panel/timeline")).toBe("event");
  });

  it("answers the same on a leaf as on the index it was opened from", () => {
    // /panel/principles/:id is a principle the user arrived at from the list.
    // A document handed over there is still a document about principles.
    expect(uploadKindForPath("/panel/principles/abc-123")).toBe("principle");
  });

  it("sends no hint from a view that holds no single kind", () => {
    // Today, Week and Strategy are assembled from several kinds, and the data
    // screen holds none. Null means "ask as we always did", which is the
    // request these made before the dock existed.
    expect(uploadKindForPath("/panel/today")).toBeNull();
    expect(uploadKindForPath("/panel/week")).toBeNull();
    expect(uploadKindForPath("/panel/strategy")).toBeNull();
    expect(uploadKindForPath("/panel/data")).toBeNull();
    expect(uploadKindForPath("/panel/setup")).toBeNull();
    expect(uploadKindForPath(null)).toBeNull();
  });

  it("does not match a route that merely starts with the same letters", () => {
    // Guards the prefix check itself: `startsWith` alone would map a future
    // /panel/winsomething to "win".
    expect(uploadKindForPath("/panel/winsome")).toBeNull();
    expect(uploadKindForPath("/panel/goals-archive")).toBeNull();
  });

  it("has an answer for every view the panel can render", () => {
    // Not that every view maps to a kind, but that every view has been
    // CONSIDERED: a new entry in LIFE_VIEWS should be a deliberate null here,
    // not one by omission. This fails loudly the day a view is added and this
    // file is not opened.
    const decided = new Set([
      "/panel/principles",
      "/panel/wins",
      "/panel/phrases",
      "/panel/goals",
      "/panel/distractions",
      "/panel/timeline",
      // Deliberately no kind:
      "/panel/today",
      "/panel/week",
      "/panel/strategy",
    ]);
    for (const view of LIFE_VIEWS) {
      expect(decided.has(view.href), `${view.href} has no decision`).toBe(true);
    }
  });
});
