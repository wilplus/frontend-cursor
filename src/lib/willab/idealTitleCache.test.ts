// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

import { cachedIdealTitle, rememberIdealTitle } from "./idealTitleCache";

/* The module hydrates from localStorage ONCE and keeps a module-level Map, so
 * each test re-imports it fresh — otherwise the first test's Map would answer
 * the rest and none of them would be testing what they claim. */
async function fresh() {
  vi.resetModules();
  return import("./idealTitleCache");
}

beforeEach(() => {
  window.localStorage.clear();
  vi.resetModules();
});

describe("cachedIdealTitle", () => {
  it("is null for an arc nobody has opened", () => {
    expect(cachedIdealTitle("arc-unknown")).toBeNull();
  });

  it("is null for a missing arc id rather than throwing", () => {
    expect(cachedIdealTitle(null)).toBeNull();
    expect(cachedIdealTitle(undefined)).toBeNull();
    expect(cachedIdealTitle("")).toBeNull();
  });

  it("returns a title remembered in this session", async () => {
    const m = await fresh();
    m.rememberIdealTitle("arc-1", "Book really");
    expect(m.cachedIdealTitle("arc-1")).toBe("Book really");
  });

  it("SURVIVES the app being closed — the founder's actual case", async () => {
    // "when you open the app and the chat … first they display the
    // placeholder". A session-only cache would not fix that at all.
    const first = await fresh();
    first.rememberIdealTitle("arc-1", "Book really");

    const nextAppOpen = await fresh();     // fresh module, same localStorage
    expect(nextAppOpen.cachedIdealTitle("arc-1")).toBe("Book really");
  });
});

describe("rememberIdealTitle", () => {
  it("trims, so a padded name never renders padded", async () => {
    const m = await fresh();
    m.rememberIdealTitle("arc-1", "  Book really  ");
    expect(m.cachedIdealTitle("arc-1")).toBe("Book really");
  });

  it("a blank CLEARS rather than storing an empty title", async () => {
    // "the server says there is no name" must not be replayed next session as
    // if it were one — that would render an empty heading forever.
    const m = await fresh();
    m.rememberIdealTitle("arc-1", "Book really");
    m.rememberIdealTitle("arc-1", "   ");
    expect(m.cachedIdealTitle("arc-1")).toBeNull();

    const reopened = await fresh();
    expect(reopened.cachedIdealTitle("arc-1")).toBeNull();
  });

  it("a rename overwrites the old name", async () => {
    const m = await fresh();
    m.rememberIdealTitle("arc-1", "Old name");
    m.rememberIdealTitle("arc-1", "New name");
    expect(m.cachedIdealTitle("arc-1")).toBe("New name");
  });

  it("keeps arcs apart", async () => {
    const m = await fresh();
    m.rememberIdealTitle("arc-1", "One");
    m.rememberIdealTitle("arc-2", "Two");
    expect(m.cachedIdealTitle("arc-1")).toBe("One");
    expect(m.cachedIdealTitle("arc-2")).toBe("Two");
  });

  it("a missing arc id is a no-op, not a crash", async () => {
    const m = await fresh();
    expect(() => m.rememberIdealTitle(null, "x")).not.toThrow();
    expect(() => m.rememberIdealTitle("", "x")).not.toThrow();
  });

  it("is bounded — a long history cannot grow the entry without limit", async () => {
    const m = await fresh();
    for (let i = 0; i < 80; i += 1) m.rememberIdealTitle(`arc-${i}`, `T${i}`);
    const stored = JSON.parse(
      window.localStorage.getItem("willab.idealTitles") ?? "{}"
    );
    expect(Object.keys(stored).length).toBeLessThanOrEqual(60);
    // The most recent survive; a dropped arc just fetches again.
    expect(stored["arc-79"]).toBe("T79");
  });
});

describe("it degrades instead of breaking the chat", () => {
  it("survives unreadable storage", async () => {
    window.localStorage.setItem("willab.idealTitles", "{not json");
    const m = await fresh();
    expect(m.cachedIdealTitle("arc-1")).toBeNull();
    expect(() => m.rememberIdealTitle("arc-1", "Book")).not.toThrow();
  });

  it("ignores a stored value of the wrong shape", async () => {
    window.localStorage.setItem(
      "willab.idealTitles",
      JSON.stringify({ "arc-1": 42, "arc-2": "Real" })
    );
    const m = await fresh();
    expect(m.cachedIdealTitle("arc-1")).toBeNull();
    expect(m.cachedIdealTitle("arc-2")).toBe("Real");
  });

  it("survives a throwing setItem (quota / private mode)", async () => {
    const m = await fresh();
    const spy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });
    expect(() => m.rememberIdealTitle("arc-1", "Book")).not.toThrow();
    // The in-memory half still serves THIS session.
    expect(m.cachedIdealTitle("arc-1")).toBe("Book");
    spy.mockRestore();
  });
});
