// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  F4 (founder 2026-10-08): one recording-roots read per arc, started at     */
/*  mount and shared by the page and the deck. Pinned here: the deck joins    */
/*  the page's read; a document change both see asks once; a sheet closing   */
/*  or a save refresh always reads anew.                                      */
/* -------------------------------------------------------------------------- */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const roots = vi.fn();
vi.mock("@/services/api/idealText", () => ({
  fetchRecordingRoots: (...args: unknown[]) => roots(...args),
}));

import {
  SHARE_WINDOW_MS,
  forgetHeadlineReads,
  mayShareRootsRead,
  rootsNeedFor,
  useDeliveryHeadlines,
  useHeadlinesWithPending,
} from "./useSlideHeadlines";

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  forgetHeadlineReads();
  roots.mockReset();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
const ready = (list: { partId: string; text: string }[]) => ({
  kind: "ready",
  roots: list.map((r) => ({ ...r, slideIndex: 0, type: "flagship" })),
});

describe("rootsNeedFor", () => {
  const base = { document: "a", sheetOpen: false, refresh: 0 };
  it("a first run, or the first text after an empty one, may share", () => {
    expect(rootsNeedFor({ ...base, document: null }, base)).toBe("mount");
    expect(rootsNeedFor({ ...base, document: "" }, base)).toBe("mount");
    expect(rootsNeedFor(base, base)).toBe("mount");
  });
  it("a changed document is a change", () => {
    expect(rootsNeedFor(base, { ...base, document: "b" })).toBe("change");
  });
  it("a closed sheet or a refresh reads anew", () => {
    expect(rootsNeedFor({ ...base, sheetOpen: true }, base)).toBe("fresh");
    expect(rootsNeedFor(base, { ...base, refresh: 1 })).toBe("fresh");
  });
});

describe("mayShareRootsRead", () => {
  it("shares a recent read on mount, a same-flush read on change, never on fresh", () => {
    const read = { startedAt: 1000, sameFlush: true, result: null };
    expect(mayShareRootsRead(read, "mount", 1000 + SHARE_WINDOW_MS)).toBe(true);
    expect(mayShareRootsRead(read, "mount", 1001 + SHARE_WINDOW_MS)).toBe(false);
    expect(mayShareRootsRead(read, "change", 1000)).toBe(true);
    expect(mayShareRootsRead({ ...read, sameFlush: false }, "change", 1000)).toBe(false);
    expect(mayShareRootsRead(read, "fresh", 1000)).toBe(false);
  });
  it("never shares a read that failed", () => {
    expect(
      mayShareRootsRead({ startedAt: 1000, sameFlush: true, result: { kind: "error" } }, "mount", 1000),
    ).toBe(false);
  });
});

describe("the page's mount read feeds the deck", () => {
  let delivery: Map<string, string> | null = null;
  let deck: Map<string, string> | null = null;
  function Page({ doc, deckDoc, sheetOpen = false }: { doc: string; deckDoc: string | null; sheetOpen?: boolean }) {
    delivery = useDeliveryHeadlines("arc", doc);
    return deckDoc === null ? null : createElement(Deck, { doc: deckDoc, sheetOpen });
  }
  function Deck({ doc, sheetOpen }: { doc: string; sheetOpen: boolean }) {
    deck = useHeadlinesWithPending("arc", doc, sheetOpen).headlines;
    return null;
  }

  it("asks once for the page and the deck, and the deck draws it on its first render", async () => {
    roots.mockResolvedValue(ready([{ partId: "p1", text: "words" }]));
    // The page mounts before the core read: no text, no deck yet.
    act(() => root.render(createElement(Page, { doc: "", deckDoc: null })));
    await flush();
    expect(roots).toHaveBeenCalledTimes(1);
    // The core lands: the page has its text and the deck mounts.
    act(() => root.render(createElement(Page, { doc: "text", deckDoc: "text" })));
    expect(deck?.get("p1")).toBe("words");
    await flush();
    expect(roots).toHaveBeenCalledTimes(1);
    expect(delivery?.get("p1")).toBe("words");
  });

  it("asks once when both see the same document change", async () => {
    roots.mockResolvedValue(ready([]));
    act(() => root.render(createElement(Page, { doc: "one", deckDoc: "one" })));
    await flush();
    expect(roots).toHaveBeenCalledTimes(1);
    roots.mockResolvedValue(ready([{ partId: "p1", text: "new" }]));
    act(() => root.render(createElement(Page, { doc: "two", deckDoc: "two" })));
    await flush();
    expect(roots).toHaveBeenCalledTimes(2);
    expect(deck?.get("p1")).toBe("new");
    expect(delivery?.get("p1")).toBe("new");
  });

  it("reads anew when a sheet closes", async () => {
    roots.mockResolvedValue(ready([]));
    act(() => root.render(createElement(Page, { doc: "one", deckDoc: "one" })));
    await flush();
    act(() => root.render(createElement(Page, { doc: "one", deckDoc: "one", sheetOpen: true })));
    act(() => root.render(createElement(Page, { doc: "one", deckDoc: "one", sheetOpen: false })));
    await flush();
    expect(roots).toHaveBeenCalledTimes(2);
  });
});
