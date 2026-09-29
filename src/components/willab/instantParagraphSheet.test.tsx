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
vi.mock("@/services/api/bookmarkHistory", () => ({
  fetchParagraphHistory: (...args: unknown[]) => history(...args),
  fetchOwnerAnswers: (...args: unknown[]) => answers(...args),
}));
const roots = vi.fn();
vi.mock("@/services/api/idealText", () => ({
  fetchRecordingRoots: (...args: unknown[]) => roots(...args),
}));

import {
  OPEN_WAIT_MS,
  forgetParagraphSheetData,
  prefetchParagraphSheets,
  useParagraphSheetData,
  type SheetData,
} from "./paragraphSheetData";
import { CONFIRM_RETRY_MS, CONFIRM_TRIES, useHeadlinesWithPending } from "./useSlideHeadlines";
import OpenChunkSheet from "./OpenChunkSheet";

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  forgetParagraphSheetData();
  history.mockReset();
  answers.mockReset();
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

  it("has the data on the very first render when read ahead", async () => {
    history.mockResolvedValue({ entries: ["h"] });
    answers.mockResolvedValue([{ feedbackId: "f", response: "not_sure" }]);
    prefetchParagraphSheets("arc", "take", ["p1"]);
    await flush();
    act(() => root.render(createElement(Probe)));
    expect(seen[0]).toEqual({ history: { entries: ["h"] }, answers: [{ feedbackId: "f", response: "not_sure" }] });
  });

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

  it("stops waiting after the bounded wait on a very slow read", async () => {
    vi.useFakeTimers();
    history.mockReturnValue(new Promise(() => {}));
    answers.mockResolvedValue([]);
    act(() => root.render(createElement(Probe)));
    await act(async () => { vi.advanceTimersByTime(OPEN_WAIT_MS); });
    expect(seen.at(-1)).not.toBeNull();
  });

  it("reads fresh on each read-ahead, so a new answer is not missed", () => {
    history.mockResolvedValue(null);
    answers.mockResolvedValue([]);
    prefetchParagraphSheets("arc", "take", ["p1"]);
    prefetchParagraphSheets("arc", "take", ["p1"]);
    expect(answers).toHaveBeenCalledTimes(2);
    expect(history).toHaveBeenCalledTimes(2);
  });

  it("keeps the last finished read while a fresh one is in flight (tap and go)", async () => {
    history.mockResolvedValue({ entries: ["take 1"] });
    answers.mockResolvedValue([]);
    prefetchParagraphSheets("arc", "take", ["p1"]);
    await flush();
    // A sheet closes: everything is read again, and this read is slow.
    let finish: (v: unknown) => void = () => {};
    history.mockReturnValue(new Promise((r) => { finish = r; }));
    prefetchParagraphSheets("arc", "take", ["p1"]);
    act(() => root.render(createElement(Probe)));
    expect(seen[0]).toEqual({ history: { entries: ["take 1"] }, answers: [] });
    finish({ entries: ["take 1", "take 2"] });
    await flush();
    expect(seen.at(-1)).toEqual({ history: { entries: ["take 1", "take 2"] }, answers: [] });
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

  it("replaces the paragraph's old words rather than joining them", async () => {
    roots.mockResolvedValue(ready([{ partId: "p1", text: "old words" }]));
    act(() => root.render(createElement(Probe, { sheetOpen: false })));
    await flush();
    act(() => api.expect("p1", "new words"));
    expect(api.headlines.get("p1")).toBe("new words");
  });

  it("takes them back when the save fails", async () => {
    roots.mockResolvedValue(ready([]));
    act(() => root.render(createElement(Probe, { sheetOpen: false })));
    await flush();
    act(() => api.expect("p1", "just a test"));
    act(() => api.settle("p1", false));
    expect(api.headlines.has("p1")).toBe(false);
  });

  it("keeps them through a stale read and hands over to a fresh one", async () => {
    let stale: (v: unknown) => void = () => {};
    roots.mockReturnValueOnce(new Promise((r) => { stale = r; }));
    act(() => root.render(createElement(Probe, { sheetOpen: false })));
    act(() => api.expect("p1", "just a test"));
    roots.mockResolvedValueOnce(ready([{ partId: "p1", text: "just a test" }]));
    act(() => api.settle("p1", true));
    // The read that started before the save lands with nothing for p1.
    stale(ready([]));
    await flush();
    expect(api.headlines.get("p1")).toBe("just a test");
    await flush();
    expect(api.headlines.get("p1")).toBe("just a test");
    expect(roots).toHaveBeenCalledTimes(2);
  });

  it("keeps them while the lock is still landing, and asks again (tap and go)", async () => {
    vi.useFakeTimers();
    roots.mockResolvedValue(ready([]));
    act(() => root.render(createElement(Probe, { sheetOpen: false })));
    await flush();
    act(() => api.expect("p1", "just a test"));
    // The words' write lands first; the lock has not, so the read after
    // the save still comes back without them.
    act(() => api.settle("p1", true));
    await flush();
    expect(api.headlines.get("p1")).toBe("just a test");
    // The lock lands; the next read carries the words.
    roots.mockResolvedValue(ready([{ partId: "p1", text: "Just a test" }]));
    await act(async () => { vi.advanceTimersByTime(CONFIRM_RETRY_MS); });
    await flush();
    expect(api.headlines.get("p1")).toBe("Just a test");
  });

  it("lets the server's answer stand once the tries run out", async () => {
    vi.useFakeTimers();
    roots.mockResolvedValue(ready([]));
    act(() => root.render(createElement(Probe, { sheetOpen: false })));
    await flush();
    act(() => api.expect("p1", "just a test"));
    act(() => api.settle("p1", true));
    for (let i = 0; i <= CONFIRM_TRIES; i += 1) {
      await flush();
      await act(async () => { vi.advanceTimersByTime(CONFIRM_RETRY_MS); });
    }
    await flush();
    expect(api.headlines.has("p1")).toBe(false);
  });

  it("keeps every shown headline when a read fails", async () => {
    roots.mockResolvedValueOnce(ready([{ partId: "p2", text: "kept" }]));
    act(() => root.render(createElement(Probe, { sheetOpen: false })));
    await flush();
    roots.mockResolvedValueOnce({ kind: "stale" });
    act(() => root.render(createElement(Probe, { sheetOpen: true })));
    act(() => root.render(createElement(Probe, { sheetOpen: false })));
    await flush();
    expect(roots).toHaveBeenCalledTimes(2);
    expect(api.headlines.get("p2")).toBe("kept");
  });
});

describe("held while the Take's feedback arrives", () => {
  const stateWith = (pending: unknown[]) =>
    ({ pending, decided: [], locked: true, chunk: { part: { id: "p1", text: "t" } } }) as never;
  const render = (state: unknown, feedbackPending: boolean) =>
    act(() => root.render(createElement(OpenChunkSheet, {
      state: state as never,
      arcId: null,
      takeSessionId: null,
      headline: null,
      feedbackPending,
      onClose: () => {},
      renderSheet: () => createElement("p", { "data-testid": "judgement" }, "judgement sheet"),
    })));

  it("opens nothing until the feedback lands, then the sheet the moment needs", () => {
    render(stateWith([]), true);
    expect(container.innerHTML).toBe("");
    // The moment's unanswered item arrives with the feedback.
    render(stateWith([{ id: "cv" }]), false);
    expect(container.textContent).toBe("judgement sheet");
  });

  it("stops holding after the bounded wait", async () => {
    vi.useFakeTimers();
    render(stateWith([{ id: "cv" }]), true);
    expect(container.innerHTML).toBe("");
    await act(async () => { vi.advanceTimersByTime(OPEN_WAIT_MS); });
    expect(container.textContent).toBe("judgement sheet");
  });

  it("opens at once when the feedback is already there", () => {
    render(stateWith([{ id: "cv" }]), false);
    expect(container.textContent).toBe("judgement sheet");
  });
});
