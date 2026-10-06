// @vitest-environment jsdom
/* The coach panel, redrawn, P1 (founder lock 2026-10-06): its screens, its
   host's blind order (the moment read only after the rating saves), and the
   switch at the Lounge door. */
import { act, useState, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMomentRead = vi.fn();
const saveStateRating = vi.fn();
vi.mock("@/services/api/coachWalk", async (orig) => ({
  ...(await orig<typeof import("@/services/api/coachWalk")>()),
  fetchMomentRead: (...a: unknown[]) => fetchMomentRead(...a),
}));
vi.mock("@/services/api/stateRatings", async (orig) => ({
  ...(await orig<typeof import("@/services/api/stateRatings")>()),
  saveStateRating: (...a: unknown[]) => saveStateRating(...a),
}));
vi.mock("@/services/api/coachReview", () => ({
  fetchCoachReviewSession: vi.fn(async () => ({
    presentationRef: null,
    snippets: [{ id: "s1", audioRef: "blob:a", startOffsetMs: 0, durationMs: 2000, slide: null, transcript: "SECRET WORDS" }],
  })),
}));
vi.mock("@/services/api/coachPanel", () => ({
  fetchErrorAudit: vi.fn(async () => null),
  fetchBlockPicks: vi.fn(async () => null),
}));
vi.mock("../coachwalk/useConfidenceChainReceipt", () => ({
  useConfidenceChainReceipt: () => ({ current: null }),
}));

import CoachPanel from "./CoachPanel";
import {
  JudgeScreen, QueueScreen, RevealScreen, SpeakerScreen, revealLines, speakerChoice, takeChoice, takesNewestFirst,
} from "./CoachPanelScreens";
import { CoachPanelPinned } from "./CoachPanelDoor";
import WalkOverlay from "../walk/WalkOverlay";
import { PANEL_START, panelReducer, type PanelAction, type PanelState } from "@/lib/willab/coachPanel";
import type { QueueMoment, QueueSpeaker, QueueTake } from "@/lib/willab/coachWalk";
import { COACH_PANEL_COPY as COPY } from "@/lib/willab/coachPanelCopy";
import type { MomentRead } from "@/services/api/coachWalk";
import type { WalkNav } from "../walk/WalkOverlay";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  fetchMomentRead.mockReset();
  saveStateRating.mockReset();
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});
const draw = (el: ReactElement) => act(() => root.render(el));
const q = (sel: string) => host.querySelector<HTMLElement>(sel);
const qa = (sel: string) => [...host.querySelectorAll<HTMLElement>(sel)];
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

const m = (snippetId: string, state: QueueMoment["state"] = "judge_it"): QueueMoment => ({ snippetId, state, kind: null });
const TAKE: QueueTake = { sessionId: "t2", takeIndex: 2, sentAt: "", waiting: 2, waitingForText: false, moments: [m("s1"), m("s2")] };
const OLD: QueueTake = { sessionId: "t1", takeIndex: 1, sentAt: "", waiting: 0, waitingForText: false, moments: [m("a", "answered"), m("b", "answered"), m("c", "answered")] };
const HERON: QueueSpeaker = { pseudonym: "Quiet Heron", waiting: 2, takes: [OLD, TAKE] };
const OTTER: QueueSpeaker = { pseudonym: "Calm Otter", waiting: 0, takes: [{ ...TAKE, sessionId: "t9", waiting: 0, moments: [], waitingForText: true }] };
const DONE: QueueSpeaker = { pseudonym: "Bold Finch", waiting: 0, takes: [OLD] };
const NAV: WalkNav = { label: "Quiet Heron", index: 0, total: 4, onBack: () => {}, onNext: () => {} };
const READ: MomentRead = {
  passage: "We grew revenue forty percent.",
  speakerAnswer: "no",
  coachAnswer: null,
  speakerGoal: null,
  practice: null,
  request: { spotted: [{ errorId: "rushing", label: "Rushing" }, { errorId: "ec", label: "Ending compression" }] } as MomentRead["request"],
};

describe("the pure parts", () => {
  it("a speaker: moments waiting, waiting for the text, or answered", () => {
    expect(speakerChoice(HERON, 0)).toMatchObject({ label: "Quiet Heron", subtitle: "2 moments waiting" });
    expect(speakerChoice({ ...HERON, waiting: 1 }, 0).subtitle).toBe("1 moment waiting");
    expect(speakerChoice(OTTER, 1)).toMatchObject({ subtitle: COPY.waitingForText, done: true, dim: true });
    expect(speakerChoice(DONE, 2)).toMatchObject({ subtitle: COPY.answered, mark: "check" });
  });

  it("a Take: waiting of all, answered, or waiting for the text; newest first", () => {
    expect(takesNewestFirst(HERON.takes).map((t) => t.takeIndex)).toEqual([2, 1]);
    expect(takeChoice(TAKE, 0)).toMatchObject({ label: "Take 2", subtitle: "2 of 2 moments waiting" });
    expect(takeChoice(OLD, 1)).toMatchObject({ label: "Take 1", subtitle: "Answered · 3 moments", done: true });
    expect(takeChoice(OLD, 0).subtitle).toBe(COPY.allMomentsAnswered);
    expect(takeChoice(OTTER.takes[0], 0)).toMatchObject({ subtitle: COPY.waitingForText, done: true });
  });

  it("What happened's lines: You, the speaker, The machine heard; each only when the data has it", () => {
    expect(revealLines(READ, "Quiet Heron", "in_between")).toEqual([
      { label: "You", value: "In-between" },
      { label: "Quiet Heron", value: "Not confident" },
      { label: "The machine heard", value: "Rushing · Ending compression" },
    ]);
    // A praise or rewrite moment: the read carries no "heard", so no line.
    const praise = { ...READ, speakerAnswer: null, request: { spotted: [] } as unknown as MomentRead["request"] };
    expect(revealLines(praise, "Quiet Heron", "yes")).toEqual([{ label: "You", value: "Confident" }]);
  });
});

describe("the screens", () => {
  it("Your queue: your speakers as shaded choices, no blind group when it is off", () => {
    const onSpeaker = vi.fn();
    draw(<QueueScreen speakers={[HERON, OTTER, DONE]} loading={false} blind={{ audit: null, picks: null, onOpenAudit: () => {}, onOpenPicks: () => {} }}
      onSpeaker={onSpeaker} onClose={() => {}} />);
    expect(q("h2")!.textContent).toBe(COPY.queueTitle);
    expect(host.textContent).toContain(COPY.yourSpeakers);
    expect(q("[data-testid='coach-panel-blind']")).toBeNull();
    const cards = qa("[data-walk-choice]");
    expect(cards.map((c) => c.tagName)).toEqual(["BUTTON", "DIV", "BUTTON"]);
    act(() => cards[0].click());
    expect(onSpeaker).toHaveBeenCalledWith(HERON);
    // The queue has no ‹: it is the first screen.
    expect(q("[aria-label='Back']")).toBeNull();
  });

  it("Your queue: the blind lines in the backend's words, only when served", () => {
    const audit = { items: [{ auditId: "x", clipId: "c", audioRef: null, errorId: "e", label: "", asks: "" }],
      wording: { title: "Do you hear it?", queue_line: "Also waiting · blind" } };
    draw(<QueueScreen speakers={[HERON]} loading={false} blind={{ audit, picks: null, onOpenAudit: () => {}, onOpenPicks: () => {} }}
      onSpeaker={() => {}} onClose={() => {}} />);
    expect(q("[data-testid='coach-panel-blind']")!.textContent).toContain("Also waiting · blind");
    expect(q("[data-testid='coach-panel-blind']")!.textContent).toContain("Do you hear it?");
  });

  it("A speaker: ‹ alone in the top bar, the Takes newest first", () => {
    const onBack = vi.fn();
    const onTake = vi.fn();
    draw(<SpeakerScreen speaker={HERON} onTake={onTake} onBack={onBack} onClose={() => {}} />);
    expect(q("h2")!.textContent).toBe("Quiet Heron");
    expect(qa("[data-walk-choice] b").map((b) => b.textContent)).toEqual(["Take 2", "Take 1"]);
    act(() => q("[aria-label='Back']")!.click());
    expect(onBack).toHaveBeenCalled();
    act(() => qa("[data-walk-choice]")[0].click());
    expect(onTake).toHaveBeenCalledWith(TAKE);
  });

  it("Judge: the player, the question, the five answers in the coach's words, nothing else", () => {
    draw(<JudgeScreen nav={NAV} momentId="s1" clip={null} error={null} attempt={0} onAnswer={() => {}} onClose={() => {}} />);
    expect(q("h2")!.textContent).toBe(COPY.judgeTitle);
    expect(host.textContent).toContain(COPY.judgeQuestion);
    expect(qa("[data-walk-answer]").map((b) => b.textContent)).toEqual([
      "Yes — Confident", "In-between", "No — Not confident", "Not sure", "Audio unclear",
    ]);
    expect(qa("[data-walk-player]")).toHaveLength(1);
    // No passage, no kind, no machine read, no slide, no orange training line.
    expect(q("[data-walk-player]")!.textContent).not.toMatch(/[A-Za-z]{3}/);
    expect(host.textContent).not.toMatch(/Private|training|machine|Error|Praise|Rewrite|Slide/);
    expect(q("[data-walk-nav]")!.textContent).toContain("Quiet Heron · moment 1 of 4");
  });

  it("What happened: the passage in its player and the three lines; Next", () => {
    const onNext = vi.fn();
    draw(<RevealScreen nav={NAV} momentId="s1" clip={null} slide={null} read={READ} pseudonym="Quiet Heron"
      justRated="no" onNext={onNext} onClose={() => {}} />);
    expect(q("h2")!.textContent).toBe(COPY.whatHappened);
    expect(q("[data-walk-player]")!.textContent).toContain(READ.passage);
    expect(qa("[data-testid='coach-panel-facts'] dt").map((d) => d.textContent)).toEqual(["You", "Quiet Heron", "The machine heard"]);
    act(() => q("[data-walk-pill]")!.click());
    expect(onNext).toHaveBeenCalled();
  });

  it("What happened while it loads: the breathing mark, no Next", () => {
    draw(<RevealScreen nav={NAV} momentId="s1" clip={null} slide={null} read={undefined} pseudonym="Quiet Heron"
      justRated="no" onNext={() => {}} onClose={() => {}} />);
    expect(q("[data-walk-loading]")).not.toBeNull();
    expect(q("[data-walk-pill]")).toBeNull();
  });

  it("the pinned buttons: Speakers and Training corpus, with icons", () => {
    const onSpeakers = vi.fn();
    draw(<CoachPanelPinned onSpeakers={onSpeakers} />);
    const speakers = q("[data-testid='coach-panel-speakers-button']")!;
    const corpus = q("[data-testid='coach-panel-corpus-button']")!;
    expect(speakers.textContent).toBe(COPY.speakers);
    expect(corpus.textContent).toBe(COPY.trainingCorpus);
    expect(corpus.getAttribute("href")).toBe("/coach/corpus");
    expect(speakers.querySelector("svg")).not.toBeNull();
    act(() => speakers.click());
    expect(onSpeakers).toHaveBeenCalled();
  });

  it("WalkOverlay: ‹ alone only when asked, and never beside the moment bar", () => {
    draw(<WalkOverlay title="T" onClose={() => {}} />);
    expect(q("[aria-label='Back']")).toBeNull();
    draw(<WalkOverlay title="T" onBack={() => {}} onClose={() => {}} />);
    expect(qa("[aria-label='Back']")).toHaveLength(1);
    draw(<WalkOverlay nav={NAV} onBack={() => {}} onClose={() => {}} />);
    expect(qa("[aria-label='Back']")).toHaveLength(1);
  });
});

/* ── the host: blind order ─────────────────────────────────────────── */

function Host({ start }: { start: PanelState }) {
  const [state, setState] = useState(start);
  const dispatch = (a: PanelAction) => setState((s: PanelState) => panelReducer(s, a));
  return <CoachPanel state={state} dispatch={dispatch} speakers={[HERON]} loading={false} onHandover={() => {}} />;
}

describe("CoachPanel", () => {
  it("Judge first; the moment read is asked for only after the rating saves", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    saveStateRating.mockResolvedValue({ ok: true });
    fetchMomentRead.mockResolvedValue(READ);
    const start = [{ type: "open" }, { type: "speaker", speaker: HERON }, { type: "take", speaker: HERON, take: TAKE }]
      .reduce((s, a) => panelReducer(s, a as PanelAction), PANEL_START);
    draw(<Host start={start} />);
    await flush();
    expect(document.querySelector("[data-testid='coach-panel-judge']")).not.toBeNull();
    expect(document.body.textContent).not.toContain(READ.passage);
    expect(document.body.textContent).not.toContain("SECRET WORDS");
    expect(fetchMomentRead).not.toHaveBeenCalled();

    act(() => (document.querySelector("[data-walk-answer='in_between']") as HTMLElement).click());
    expect(fetchMomentRead).not.toHaveBeenCalled(); // held, not yet saved
    await act(async () => { vi.advanceTimersByTime(300); });
    await flush();
    expect(saveStateRating).toHaveBeenCalledWith("s1", expect.anything(), null, null, null);
    expect(fetchMomentRead).toHaveBeenCalledWith("t2", "s1");
    expect(document.querySelector("[data-testid='coach-panel-reveal']")).not.toBeNull();
    expect(document.querySelector("[data-walk-toast]")!.textContent).toBe(COPY.toastJudged);
    await flush();
    expect(document.querySelector("[data-testid='coach-panel-passage']")!.textContent).toBe(READ.passage);
  });

  it("a failed save stays on Judge, says so, and never reads the moment", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    saveStateRating.mockResolvedValue({ ok: false, error: null });
    const start = [{ type: "open" }, { type: "take", speaker: HERON, take: TAKE }]
      .reduce((s, a) => panelReducer(s, a as PanelAction), PANEL_START);
    draw(<Host start={start} />);
    await flush();
    act(() => (document.querySelector("[data-walk-answer='yes']") as HTMLElement).click());
    await act(async () => { vi.advanceTimersByTime(300); });
    await flush();
    expect(document.querySelector("[data-testid='coach-panel-judge']")).not.toBeNull();
    expect(document.querySelector("[role='alert']")!.textContent).toBe(COPY.judgeFail);
    expect(document.querySelector("[data-walk-answer='yes']")!.getAttribute("aria-pressed")).toBe("false");
    expect(fetchMomentRead).not.toHaveBeenCalled();
  });
});
