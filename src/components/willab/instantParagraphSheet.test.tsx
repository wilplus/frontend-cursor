// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  STORY    As a speaker, I want a paragraph sheet to open complete and my   */
/*           chosen helper words to show at once, so that I never see a       */
/*           half-drawn sheet or wait for my own choice.                      */
/*  OUTCOME                                                                   */
/*    O1  Not read ahead, the sheet's data is nothing until both reads land,  */
/*        then everything at once.                                            */
/*    O2  A read that never lands holds the sheet for OPEN_WAIT_MS at most,   */
/*        then it opens on what it has.                                       */
/*    O3  Chosen helper words show the moment they are chosen.                */
/*    O4  A failed save takes them back to the words shown before.           */
/*    O5  The server's words replace them only from a read that started      */
/*        after the save, never from one before it.                          */
/*  PROVES   O1 -> "draws nothing until both reads land, then everything at once" */
/*           O2 -> "opens on what it has once the bounded wait passes"       */
/*           O3 -> "stands in the chosen words the moment they are chosen"   */
/*           O4 -> "a failed save takes the chosen words back"               */
/*           O5 -> "the server's words take over only from a read after the save" */
/*  WHY      Founder 2026-09-28, "1A 2A": two delays made instant.            */
/* -------------------------------------------------------------------------- */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const history = vi.fn();
const answers = vi.fn();
const batch = vi.fn();
vi.mock("@/services/api/bookmarkHistory", () => ({
  fetchParagraphHistories: (...args: unknown[]) => batch(...args),
  fetchParagraphHistory: (...args: unknown[]) => history(...args),
  fetchOwnerAnswers: (...args: unknown[]) => answers(...args),
}));
const roots = vi.fn();
vi.mock("@/services/api/idealText", () => ({
  fetchRecordingRoots: (...args: unknown[]) => roots(...args),
}));

import {
  forgetParagraphSheetData,
  OPEN_WAIT_MS,
  useParagraphSheetData,
  type SheetData,
} from "./paragraphSheetData";
import {
  forgetHeadlineReads,
  useHeadlinesWithPending,
} from "./useSlideHeadlines";

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  forgetParagraphSheetData();
  forgetHeadlineReads();
  history.mockReset();
  answers.mockReset();
  batch.mockReset();
  roots.mockReset();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

describe("1A: the paragraph sheet opens complete", () => {
  let seen: (SheetData | null)[];
  function Probe() {
    seen.push(useParagraphSheetData("arc", "take", "p1"));
    return null;
  }
  beforeEach(() => { seen = []; });

  it("draws nothing until both reads land, then everything at once", async () => {
    let finish: (v: unknown) => void = () => {};
    history.mockReturnValue(new Promise((r) => { finish = r; }));
    answers.mockResolvedValue([]);
    act(() => root.render(createElement(Probe)));
    await flush();
    expect(seen.every((d) => d === null)).toBe(true);
    finish({ entries: [] });
    await flush();
    expect(seen.at(-1)).toEqual({ history: { entries: [] }, answers: [] });
  });

  it("opens on what it has once the bounded wait passes", async () => {
    vi.useFakeTimers();
    history.mockReturnValue(new Promise(() => {}));
    answers.mockResolvedValue([]);
    act(() => root.render(createElement(Probe)));
    await flush();
    await act(async () => { vi.advanceTimersByTime(OPEN_WAIT_MS - 1); });
    expect(seen.at(-1)).toBeNull();
    await act(async () => { vi.advanceTimersByTime(1); });
    expect(seen.at(-1)).toEqual({ history: null, answers: [] });
  });
});

describe("2A: helper words show at once", () => {
  let api: ReturnType<typeof useHeadlinesWithPending>;
  function Probe({ sheetOpen, doc = "doc" }: { sheetOpen: boolean; doc?: string }) {
    api = useHeadlinesWithPending("arc", doc, sheetOpen);
    return null;
  }
  const ready = (list: { partId: string; text: string }[]) => ({ kind: "ready", roots: list });

  it("stands in the chosen words the moment they are chosen", async () => {
    roots.mockResolvedValue(ready([]));
    act(() => root.render(createElement(Probe, { sheetOpen: false })));
    await flush();
    act(() => api.expect("p1", "just a test"));
    expect(api.headlines.get("p1")).toBe("just a test");
  });

  it("a failed save takes the chosen words back", async () => {
    roots.mockResolvedValue(ready([{ partId: "p1", text: "old words" }]));
    act(() => root.render(createElement(Probe, { sheetOpen: false })));
    await flush();
    expect(api.headlines.get("p1")).toBe("old words");
    act(() => api.expect("p1", "new words"));
    expect(api.headlines.get("p1")).toBe("new words");
    act(() => api.settle("p1", false));
    expect(api.headlines.get("p1")).toBe("old words");
  });

  it("the server's words take over only from a read after the save", async () => {
    roots.mockResolvedValue(ready([{ partId: "p1", text: "old words" }]));
    act(() => root.render(createElement(Probe, { sheetOpen: false })));
    await flush();
    act(() => api.expect("p1", "new words"));
    // A read before the save lands already carries words: they do not take over.
    roots.mockResolvedValue(ready([{ partId: "p1", text: "server new words" }]));
    act(() => root.render(createElement(Probe, { sheetOpen: false, doc: "doc changed" })));
    await flush();
    expect(api.headlines.get("p1")).toBe("new words");
    // The save lands: the fresh read after it is the server's answer.
    const before = roots.mock.calls.length;
    act(() => api.settle("p1", true));
    await flush();
    expect(roots.mock.calls.length).toBe(before + 1);
    expect(api.headlines.get("p1")).toBe("server new words");
  });
});
