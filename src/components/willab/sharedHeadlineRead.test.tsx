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
});
