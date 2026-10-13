// @vitest-environment jsdom
/* The coach panel, redrawn, P1 (founder lock 2026-10-06): its screens, its
   host's blind order (the moment read only after the rating saves), and the
   switch at the Lounge door. */
import { act, useState, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMomentRead = vi.fn();
const saveStateRating = vi.fn();
const answerInWords = vi.fn();
vi.mock("@/services/api/coachWalk", async (orig) => ({
  ...(await orig<typeof import("@/services/api/coachWalk")>()),
  fetchMomentRead: (...a: unknown[]) => fetchMomentRead(...a),
  draftForRequest: vi.fn(async () => ({ surface: "exercise_script", text: "Slow down on the last words.", modelVersion: null })),
  answerInWords: (...a: unknown[]) => answerInWords(...a),
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
  fetchV4MomentPicks: vi.fn(async () => null),
  fetchV4SurerPairs: vi.fn(async () => null),
  fetchDiagnosis: vi.fn(async () => ({
    errors: [{ kind: "error", id: "rushing", label: "Rushing", machineHeard: true }],
    current: { kind: "error", id: "rushing" },
  })),
  saveDiagnosis: vi.fn(),
  fetchExercisePreference: vi.fn(async () => null),
  recordExercisePreference: vi.fn(),
  draftTakeWord: vi.fn(async () => null),
}));
vi.mock("../coachwalk/useConfidenceChainReceipt", () => ({
  useConfidenceChainReceipt: () => ({ current: null }),
}));

import CoachPanel, {  } from "./CoachPanel";
import {
  JudgeScreen,
} from "./CoachPanelScreens";
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
  answerInWords.mockReset();
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
// The queue's mapper sets a missing goal to null (coachWalk.ts), never undefined.
const HERON: QueueSpeaker = { pseudonym: "Quiet Heron", goal: null, waiting: 2, takes: [OLD, TAKE] };
const NAV: WalkNav = { label: "Quiet Heron", index: 0, total: 4, onBack: () => {}, onNext: () => {} };
const READ: MomentRead = {
  passage: "We grew revenue forty percent.",
  speakerAnswer: "no",
  coachAnswer: null,
  speakerGoal: null,
  practice: null,
  heard: [{ kind: "error", key: "rushing", label: "Rushing" }, { kind: "error", key: "ec", label: "Ending compression" }],
  request: { spotted: [{ errorId: "rushing", label: "Rushing" }, { errorId: "ec", label: "Ending compression" }] } as MomentRead["request"],
};

describe("the screens", () => {

  it("Judge: the player, the question, 👍 😐 👎 and Audio unclear (lock 2026-10-12 §7), nothing else", () => {
    draw(<JudgeScreen nav={NAV} momentId="s1" clip={null} error={null} attempt={0} onAnswer={() => {}} onClose={() => {}} />);
    expect(q("h2")!.textContent).toBe(COPY.judgeTitle);
    expect(host.textContent).toContain(COPY.judgeQuestion);
    expect(qa("[data-walk-answer]").map((b) => b.textContent)).toEqual([
      "👍Yes", "😐In-between", "👎No", "Audio unclear",
    ]);
    expect(qa("[data-walk-player]")).toHaveLength(1);
    // No passage, no kind, no machine read, no slide, no orange training line.
    expect(q("[data-walk-player]")!.textContent).not.toMatch(/[A-Za-z]{3}/);
    expect(host.textContent).not.toMatch(/Private|training|machine|Error|Praise|Rewrite|Slide/);
    expect(q("[data-walk-nav]")!.textContent).toContain("Quiet Heron · moment 1 of 4");
  });
});

/* ── the host: blind order ─────────────────────────────────────────── */

function Host({ start }: { start: PanelState }) {
  const [state, setState] = useState(start);
  const dispatch = (a: PanelAction) => setState((s: PanelState) => panelReducer(s, a));
  return <CoachPanel state={state} dispatch={dispatch} speakers={[HERON]} loading={false} />;
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
    expect(saveStateRating).toHaveBeenCalledWith("s1", expect.anything(), null);
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

describe("the answer", () => {
  it("an error answered without a video still goes to the speaker, without the library (lock flow 9)", async () => {
    fetchMomentRead.mockResolvedValue({
      ...READ,
      request: { id: "r1", kind: "error", spotted: [], resolution: null, resolvedExerciseId: null, shared: false } as unknown as MomentRead["request"],
    });
    answerInWords.mockResolvedValue({ ok: true });
    const start = ([
      { type: "open" }, { type: "take", speaker: HERON, take: TAKE },
      { type: "rated", snippetId: "s1", value: "no" }, { type: "step", key: "words" },
    ] as PanelAction[]).reduce(panelReducer, PANEL_START);
    draw(<Host start={start} />);
    await flush();
    await flush();
    act(() => (document.querySelector("[data-testid='coach-panel-words-next']") as HTMLElement).click());
    await flush();
    act(() => (document.querySelector("[data-testid='coach-panel-video-skip']") as HTMLElement).click());
    await flush();
    expect(document.querySelector("[data-testid='coach-panel-share-note']")!.textContent).toBe(COPY.withoutAVideo("Quiet Heron"));
    expect(document.querySelector("[data-testid='coach-panel-share-only']")).toBeNull();
    await act(async () => (document.querySelector("[data-testid='coach-panel-share-pill']") as HTMLElement).click());
    await flush();
    expect(answerInWords).toHaveBeenCalledWith("t2", "s1", expect.objectContaining({
      resolution: "note_written", answerText: "Slow down on the last words.", share: true,
    }));
    expect(document.querySelector("[data-testid='coach-panel-judge']")).not.toBeNull(); // on to s2
  });
});
