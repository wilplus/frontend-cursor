// @vitest-environment jsdom
/* Back / Next across the bookmarks, where the email and the chat bubble
   land, and the one chat bubble (founder 2026-09-25, Q28 A–Q36 A). */
import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildBookmarks,
  FeedbackPagerBar,
  useFeedbackPager,
  type Bookmark,
} from "./feedbackPager";
import type { DeckChunk } from "@/lib/willab/deckChunks";

const chunk = (id: string): DeckChunk =>
  ({ part: { id, text: `words ${id}` }, paragraphIndex: 0 }) as unknown as DeckChunk;

const FEEDBACK: Record<string, { pending: number; decided: number }> = {
  a: { pending: 1, decided: 0 },
  b: { pending: 0, decided: 0 },
  c: { pending: 0, decided: 2 },
  d: { pending: 0, decided: 0 },
};
const MARKERS: Record<string, { bundleId: string; hasCoachUpdate: boolean }[]> = {
  d: [{ bundleId: "bundle-d", hasCoachUpdate: true }],
};

function bookmarks(): Bookmark[] {
  return buildBookmarks(
    [chunk("a"), chunk("a"), chunk("b"), chunk("c"), chunk("d")],
    (c) => FEEDBACK[c.part.id],
    (id) => MARKERS[id],
  );
}

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

const buttons = () =>
  Array.from(container.querySelectorAll("button")).map((b) => ({
    // The walk's controls are chevrons named by their aria-label (founder
    // 2026-09-26: one slim header, ‹ position ›); other buttons by their text.
    label: (b.getAttribute("aria-label") ?? b.textContent ?? "").trim(),
    disabled: b.disabled,
    el: b,
  }));

function Harness({
  onOpen,
  onCloseAll,
  openFeedback,
  rebuilt = null,
}: {
  onOpen: (b: Bookmark) => void;
  onCloseAll: () => void;
  openFeedback: boolean;
  /** What the host's re-read of the document rebuilds the list into. */
  rebuilt?: Bookmark[] | null;
}) {
  const [list, setList] = useState(bookmarks);
  const walk = useFeedbackPager({
    bookmarks: list,
    open: onOpen,
    closeAll: onCloseAll,
    openFeedback,
    ready: true,
  });
  return createElement(
    "div",
    null,
    createElement("span", { "data-testid": "at" }, String(walk.pager?.index ?? "none")),
    createElement("span", { "data-testid": "total" }, String(walk.pager?.total ?? "none")),
    createElement("span", { "data-testid": "back" }, String(walk.cameBack)),
    createElement(FeedbackPagerBar, { pager: walk.pager }),
    createElement("button", { onClick: () => walk.openPart("a") }, "open-a"),
    createElement("button", { onClick: () => walk.openPart("c") }, "open-c"),
    createElement("button", { onClick: () => { if (rebuilt) setList(rebuilt); } }, "rebuild"),
  );
}

describe("the walk", () => {

  it("does not open anything by itself without the link", async () => {
    const opened: string[] = [];
    await act(async () =>
      root.render(createElement(Harness, {
        onOpen: (b: Bookmark) => opened.push(b.partId),
        onCloseAll: vi.fn(),
        openFeedback: false,
      })),
    );
    expect(opened).toEqual([]);
  });
});
