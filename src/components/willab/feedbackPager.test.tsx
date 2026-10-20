// @vitest-environment jsdom
/*
 * STORY    As a speaker, I want Back/Next across the feedback bookmarks, so
 *          that I can walk all the feedback of my latest Take.
 * OUTCOME
 *   O1  The walk lists one bookmark per paragraph, in text order, and only
 *       what is new (feedback waiting or a coach moment).
 *   O2  Next moves forward, Back moves back (and says it came back), Back is
 *       off on the first, and Next on the last closes the walk.
 *   O3  Nothing opens by itself.
 * PROVES   O1 -> "lists one bookmark per paragraph, in order, only what is new"
 *          O2 -> "Back and Next walk the bookmarks, and Next on the last closes"
 *          O3 -> "does not open anything by itself"
 * WHY      Founder 2026-09-25 (Q29 A–Q32 A). Where the email and the chat
 *          bubble land is decided by the walk plan (src/lib/willab/walkPlan.ts),
 *          not here, so it is not claimed here.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildBookmarks,
  FeedbackPagerBar,
  useFeedbackPager,
  type Bookmark,
} from "./feedbackPager";
import { CHUNK_SHEET_COPY } from "./idealEditCopy";
import type { DeckChunk } from "@/lib/willab/deckChunks";

const chunk = (id: string): DeckChunk =>
  ({ part: { id, text: `words ${id}` }, paragraphIndex: 0 }) as unknown as DeckChunk;

const FEEDBACK: Record<string, { pending: number; decided: number }> = {
  a: { pending: 1, decided: 0 },
  b: { pending: 0, decided: 0 },
  c: { pending: 0, decided: 2 },
  d: { pending: 0, decided: 0 },
  e: { pending: 2, decided: 0 },
};
const MARKERS: Record<string, { bundleId: string; hasCoachUpdate: boolean }[]> = {
  d: [{ bundleId: "bundle-d", hasCoachUpdate: true }],
};

function bookmarks(): Bookmark[] {
  return buildBookmarks(
    [chunk("a"), chunk("a"), chunk("b"), chunk("c"), chunk("d"), chunk("e")],
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

const control = (label: string) =>
  container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
const text = (testId: string) =>
  container.querySelector(`[data-testid="${testId}"]`)?.textContent;

function Harness({ onOpen, onCloseAll }: { onOpen: (b: Bookmark) => void; onCloseAll: () => void }) {
  const walk = useFeedbackPager({ bookmarks: bookmarks(), open: onOpen, closeAll: onCloseAll });
  return createElement(
    "div",
    null,
    createElement("span", { "data-testid": "back" }, String(walk.cameBack)),
    createElement(FeedbackPagerBar, { pager: walk.pager }),
    createElement("button", { onClick: () => walk.openPart("a") }, "open-a"),
  );
}

async function mount() {
  const opened: string[] = [];
  const closeAll = vi.fn();
  await act(async () =>
    root.render(createElement(Harness, { onOpen: (b: Bookmark) => opened.push(b.partId), onCloseAll: closeAll })),
  );
  return { opened, closeAll };
}

describe("the walk", () => {
  it("lists one bookmark per paragraph, in order, only what is new", () => {
    const list = bookmarks();
    expect(list.map((b) => b.partId)).toEqual(["a", "d", "e"]);
    expect(list.find((b) => b.partId === "d")).toMatchObject({ bundleId: "bundle-d", coach: true });
  });

  it("Back and Next walk the bookmarks, and Next on the last closes", async () => {
    const { opened, closeAll } = await mount();
    const openA = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "open-a")!;
    await act(async () => openA.click());
    expect(opened).toEqual(["a"]);
    expect(text("feedback-pager")).toContain(`${CHUNK_SHEET_COPY.pagerMoment} 1 ${CHUNK_SHEET_COPY.pagerOf} 3`);
    expect(control(CHUNK_SHEET_COPY.pagerBack).disabled).toBe(true);

    await act(async () => control(CHUNK_SHEET_COPY.pagerNext).click());
    expect(opened).toEqual(["a", "d"]);
    expect(text("back")).toBe("false");

    await act(async () => control(CHUNK_SHEET_COPY.pagerBack).click());
    expect(opened).toEqual(["a", "d", "a"]);
    expect(text("back")).toBe("true");

    await act(async () => control(CHUNK_SHEET_COPY.pagerNext).click());
    await act(async () => control(CHUNK_SHEET_COPY.pagerNext).click());
    expect(opened).toEqual(["a", "d", "a", "d", "e"]);
    expect(closeAll).not.toHaveBeenCalled();
    await act(async () => control(CHUNK_SHEET_COPY.pagerNext).click());
    expect(closeAll).toHaveBeenCalledTimes(1);
    expect(text("feedback-pager")).toBeUndefined();
  });

  it("does not open anything by itself", async () => {
    const { opened } = await mount();
    expect(opened).toEqual([]);
    expect(text("feedback-pager")).toBeUndefined();
  });
});
