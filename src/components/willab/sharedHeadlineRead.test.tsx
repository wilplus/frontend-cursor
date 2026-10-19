// @vitest-environment jsdom
/*
 * STORY    As a speaker, I want the page and the deck to share one helper-words
 *          read, so that the words show at once, do not flicker and are never
 *          stale.
 * OUTCOME
 *   O1  One read for the page and the deck; the deck draws it on its first render.
 *   O2  A document change both of them see asks once, and the new words show.
 *   O3  Closing a sheet, or a save, always reads again (even inside the share
 *       window), so old helper words do not come back (Never 5).
 * PROVES   O1 -> "asks once for the page and the deck, and the deck draws it on its first render"
 *          O2 -> "a document change both see asks once"
 *          O3 -> "a sheet closing or a save reads anew"
 * WHY      F4 (founder 2026-10-08): one recording-roots read per arc.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const roots = vi.fn();
vi.mock("@/services/api/idealText", () => ({
  fetchRecordingRoots: (...args: unknown[]) => roots(...args),
}));

import {
  forgetHeadlineReads,
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

describe("the page's mount read feeds the deck", () => {
  let delivery: Map<string, string> | null = null;
  let deck: Map<string, string> | null = null;
  let deckHook: ReturnType<typeof useHeadlinesWithPending> | null = null;
  function Page({ doc, deckDoc, sheetOpen = false }: { doc: string; deckDoc: string | null; sheetOpen?: boolean }) {
    delivery = useDeliveryHeadlines("arc", doc);
    return deckDoc === null ? null : createElement(Deck, { doc: deckDoc, sheetOpen });
  }
  function Deck({ doc, sheetOpen }: { doc: string; sheetOpen: boolean }) {
    deckHook = useHeadlinesWithPending("arc", doc, sheetOpen);
    deck = deckHook.headlines;
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

  it("a document change both see asks once", async () => {
    roots.mockResolvedValue(ready([{ partId: "p1", text: "words" }]));
    act(() => root.render(createElement(Page, { doc: "text", deckDoc: "text" })));
    await flush();
    expect(roots).toHaveBeenCalledTimes(1);

    roots.mockResolvedValue(ready([{ partId: "p1", text: "new words" }]));
    act(() => root.render(createElement(Page, { doc: "text two", deckDoc: "text two" })));
    await flush();
    expect(roots).toHaveBeenCalledTimes(2);
    expect(deck?.get("p1")).toBe("new words");
    expect(delivery?.get("p1")).toBe("new words");
  });

  it("a sheet closing or a save reads anew", async () => {
    roots.mockResolvedValue(ready([{ partId: "p1", text: "old words" }]));
    act(() => root.render(createElement(Page, { doc: "text", deckDoc: "text", sheetOpen: true })));
    await flush();
    const before = roots.mock.calls.length;

    // The sheet closes well inside the share window: a new read, not the old one.
    roots.mockResolvedValue(ready([{ partId: "p1", text: "picked words" }]));
    act(() => root.render(createElement(Page, { doc: "text", deckDoc: "text", sheetOpen: false })));
    await flush();
    expect(roots.mock.calls.length).toBe(before + 1);
    expect(deck?.get("p1")).toBe("picked words");

    // A save settles: one more read, started after it.
    roots.mockResolvedValue(ready([{ partId: "p1", text: "saved words" }]));
    act(() => {
      deckHook?.expect("p1", "saved words");
    });
    act(() => {
      deckHook?.settle("p1", true);
    });
    await flush();
    expect(roots.mock.calls.length).toBe(before + 2);
  });
});
