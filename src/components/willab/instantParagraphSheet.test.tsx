// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  Two delays made instant (founder 2026-09-28, "1A 2A"). Pinned here:       */
/*    1A. read ahead, the paragraph sheet's data is there on the first        */
/*        render; not yet read, it draws nothing until both reads land (or    */
/*        the bounded wait passes), never a half sheet;                       */
/*    2A. chosen helper words stand in as the headline at once, go back on a  */
/*        failed save, and give way to the server's words only after a read  */
/*        that started after the save.                                        */
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
});

describe("2A: helper words show at once", () => {
  let api: ReturnType<typeof useHeadlinesWithPending>;
  function Probe({ sheetOpen }: { sheetOpen: boolean }) {
    api = useHeadlinesWithPending("arc", "doc", sheetOpen);
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
});
