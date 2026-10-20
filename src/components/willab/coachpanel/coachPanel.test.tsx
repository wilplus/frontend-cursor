// @vitest-environment jsdom
/*
STORY    As a coach, I want to judge a moment before I see any words or the
         machine's read, with my queue in the order speakers sent, so that
         my judgement stays blind and I answer the right speaker first.
OUTCOME
  O1  Judge shows only the player, the question and the four answers.
  O2  The machine's read of a moment is fetched only after my rating is
      saved; a failed save stays on Judge, says so, and reads nothing.
  O3  My queue puts the speaker who sent last on top and drops answered
      ones; a speaker's open Takes come first, newest first, then the
      answered ones, faded.
  O4  "Your speakers" shows the list at once, then updates it.
  O5  An error answered without a video still goes to the speaker, and a
      moment with no draft never leaves me with no words and a grey Next.
  O6  Coming back to a Take word I sent, I see my saved words and video,
      never a draft over them: Send keeps the video, Remove the video holds
      until Send and sends no video, and leaving cancels it; a Take drafted
      but never sent opens on its draft, drafted once.
PROVES   O1 -> "Judge: the player, the question, 👍 😐 👎 and Audio unclear (lock 2026-10-12 §7), nothing else"
         O2 -> "Judge first; the moment read is asked for only after the rating saves",
               "a failed save stays on Judge, says so, and never reads the moment"
         O3 -> "Your queue: the speaker who sent most recently on top; an answered speaker drops out (founder 2026-10-18)",
               "the open ones first, newest first; then Answered, faded, most recently answered first (founder 2026-10-18)"
         O4 -> "Your speakers opens at once with the queue's speakers, then takes the fresh read"
         O5 -> "an error answered without a video still goes to the speaker, without the library (lock flow 9)",
               "no draft: the field stays open until it has words, on the tick and on coming back (lock flow 9)"
         O6 -> "opens on the saved words and video, never a draft; Send to {p} keeps the video",
               "Remove the video holds across ‹ and Next, and Send without a video sends video_ref: null",
               "leaving the word before Send cancels Remove the video: the next visit shows the saved video again",
               "a Take drafted but never sent opens on its draft at every visit, drafted once; Send without a video sends video_ref: null"
WHY      Never 2 (coach judgements stay blind); locked coach panel; O6:
         founder 2026-10-19 (D9, D10), approved two-phone prototype
         https://claude.ai/artifact/APk56PLZt6o6Cx9qUMKkuk.
*/
import { act, useState, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMomentRead = vi.fn();
const saveStateRating = vi.fn();
const answerInWords = vi.fn();
const fetchTakeWord = vi.fn();
vi.mock("@/services/api/coachWalk", async (orig) => ({
  ...(await orig<typeof import("@/services/api/coachWalk")>()),
  fetchMomentRead: (...a: unknown[]) => fetchMomentRead(...a),
  draftForRequest: vi.fn(async () => ({ surface: "exercise_script", text: "Slow down on the last words.", modelVersion: null })),
  answerInWords: (...a: unknown[]) => answerInWords(...a),
  fetchTakeWord: (...a: unknown[]) => fetchTakeWord(...a),
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
const fetchCoachSpeakers = vi.fn();
vi.mock("@/services/api/coachSpeakers", async (orig) => ({
  ...(await orig<typeof import("@/services/api/coachSpeakers")>()),
  fetchCoachSpeakers: (...a: unknown[]) => fetchCoachSpeakers(...a),
}));
vi.mock("../coachwalk/useConfidenceChainReceipt", () => ({
  useConfidenceChainReceipt: () => ({ current: null }),
}));

import CoachPanel, {  } from "./CoachPanel";
import {
  JudgeScreen, QueueScreen,
  SpeakerScreen,
} from "./CoachPanelScreens";
import { PANEL_START, panelReducer, type PanelAction, type PanelState } from "@/lib/willab/coachPanel";
import type { QueueMoment, QueueSpeaker, QueueTake } from "@/lib/willab/coachWalk";
import { COACH_PANEL_COPY as COPY } from "@/lib/willab/coachPanelCopy";
import { CHUNK_SHEET_COPY } from "../idealEditCopy";
import { draftTakeWord } from "@/services/api/coachPanel";
import { draftForRequest } from "@/services/api/coachWalk";
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

  it("Your queue: the speaker who sent most recently on top; an answered speaker drops out (founder 2026-10-18)", () => {
    const sent = (sentAt: string, t: QueueTake = TAKE): QueueTake => ({ ...t, sentAt });
    const speakers: QueueSpeaker[] = [
      { pseudonym: "Old Owl", goal: null, waiting: 2, takes: [sent("2026-10-10T09:00:00Z")] },
      { pseudonym: "Done Dove", goal: null, waiting: 0, takes: [sent("2026-10-18T09:00:00Z", OLD)] },
      { pseudonym: "New Newt", goal: null, waiting: 2, takes: [sent("2026-10-09T09:00:00Z", OLD), sent("2026-10-17T09:00:00Z")] },
      { pseudonym: "Text Tern", goal: null, waiting: 0,
        takes: [{ ...OLD, sentAt: "2026-10-12T09:00:00Z", waitingForText: true, moments: [] }] },
    ];
    const onSpeaker = vi.fn();
    draw(<QueueScreen speakers={speakers} loading={false} blind={null} onSpeaker={onSpeaker} onClose={() => {}} />);
    const rows = q("[data-testid=coach-panel-speakers]")!.textContent!;
    expect(rows).not.toContain("Done Dove");
    expect(rows.indexOf("New Newt")).toBeLessThan(rows.indexOf("Text Tern"));
    expect(rows.indexOf("Text Tern")).toBeLessThan(rows.indexOf("Old Owl"));
    act(() => qa("[data-testid=coach-panel-speakers] button")[0]!.click());
    expect(onSpeaker.mock.calls[0]![0].pseudonym).toBe("New Newt");
  });
});

describe("a speaker's Takes", () => {
  it("the open ones first, newest first; then Answered, faded, most recently answered first (founder 2026-10-18)", () => {
    const t = (takeIndex: number, extra: Partial<QueueTake>): QueueTake => ({
      sessionId: `t${takeIndex}`, takeIndex, sentAt: `2026-10-0${takeIndex}T09:00:00Z`, waiting: 0,
      waitingForText: false, moments: [m(`s${takeIndex}`, "answered")], ...extra,
    });
    const speaker: QueueSpeaker = { pseudonym: "Brave Robin", goal: null, waiting: 1, takes: [
      t(1, { answeredAt: "2026-10-18T12:00:00Z" }),
      t(2, { waitingForText: true, moments: [] }),
      t(3, { answeredAt: "2026-10-10T12:00:00Z" }),
      t(4, { waiting: 1, moments: [m("s4")] }),
      t(5, { answeredAt: "2026-10-15T12:00:00Z" }),
    ] };
    draw(<SpeakerScreen speaker={speaker} onTake={() => {}} onBack={() => {}} onClose={() => {}} />);
    const answered = q("[data-testid='speaker-answered']")!;
    const open = qa("[data-walk-choice]").filter((c) => !answered.contains(c));
    expect(open.map((c) => c.dataset.walkChoice)).toEqual(["t4", "t2"]);
    expect(answered.querySelector("h3")!.textContent).toBe(COPY.answered);
    const done = [...answered.querySelectorAll<HTMLElement>("[data-walk-choice]")];
    expect(done.map((c) => c.dataset.walkChoice)).toEqual(["t1", "t5", "t3"]);
    expect(done.every((c) => c.className.includes("opacity-60"))).toBe(true);
  });
});

/* ── the host: blind order ─────────────────────────────────────────── */

function Host({ start }: { start: PanelState }) {
  const [state, setState] = useState(start);
  const dispatch = (a: PanelAction) => setState((s: PanelState) => panelReducer(s, a));
  return <CoachPanel state={state} dispatch={dispatch} speakers={[HERON]} loading={false} />;
}

describe("CoachPanel", () => {
  it("Your speakers opens at once with the queue's speakers, then takes the fresh read", async () => {
    let answer: (v: unknown) => void = () => {};
    fetchCoachSpeakers.mockReturnValue(new Promise((r) => { answer = r; }));
    const start = panelReducer(PANEL_START, { type: "speakers" } as PanelAction);
    draw(<Host start={start} />);
    const list = () => document.querySelector("[data-testid='coach-panel-all-speakers']")!.textContent;
    expect(list()).toContain("Quiet Heron");
    expect(fetchCoachSpeakers).toHaveBeenCalledTimes(1);

    await act(async () => {
      answer([{ pseudonym: "Bright Wren", goal: null, waiting: 0, waiting_for_text: 0, take_count: 0, takes: [] }]);
    });
    expect(list()).toContain("Bright Wren");
  });

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

  it("no draft: the field stays open until it has words, on the tick and on coming back (lock flow 9)", async () => {
    vi.mocked(draftForRequest).mockResolvedValueOnce(null);
    fetchMomentRead.mockResolvedValue({
      ...READ,
      request: { id: "r1", kind: "error", spotted: [], resolution: null, resolvedExerciseId: null, shared: false } as unknown as MomentRead["request"],
    });
    const start = ([
      { type: "open" }, { type: "take", speaker: HERON, take: TAKE },
      { type: "rated", snippetId: "s1", value: "no" }, { type: "step", key: "decide" }, { type: "step", key: "words" },
    ] as PanelAction[]).reduce(panelReducer, PANEL_START);
    draw(<Host start={start} />);
    await flush();
    await flush();
    // The screen on top, never the leaving copy.
    const live = (sel: string) => q(`[data-walk-move] ${sel}`);
    const open = () => live("[data-coach-words]")?.getAttribute("data-editing");
    const next = () => (live("[data-testid='coach-panel-words-next']") as HTMLButtonElement).disabled;
    expect(open()).toBe("true");
    act(() => live("[data-coach-words-pencil]")!.click()); // the tick, on no words
    expect(open()).toBe("true");

    act(() => live(`button[aria-label='${CSS.escape(CHUNK_SHEET_COPY.pagerBack)}']`)!.click());
    await flush();
    act(() => [...host.querySelectorAll<HTMLElement>("[data-walk-move] [data-testid='coach-panel-decide'] button")]
      .find((b) => b.textContent?.includes(COPY.makeANewOne))!.click());
    await flush();
    expect(open()).toBe("true");
    expect(next()).toBe(true);

    const field = live("[data-coach-words-field]") as HTMLTextAreaElement;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(field, "Breathe before the last word.");
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => live("[data-coach-words-pencil]")!.click());
    expect(open()).toBeNull();
    expect(next()).toBe(false);
  });
});

/* ── the Take's word, coming back to it ────────────────────────────── */

describe("A word for this Take, on a return visit (founder 2026-10-19)", () => {
  const DONE: QueueTake = { ...TAKE, waiting: 0, moments: [m("s1", "answered"), m("s2", "answered")] };
  let puts: Record<string, unknown>[] = [];
  beforeEach(() => {
    fetchTakeWord.mockReset();
    fetchTakeWord.mockResolvedValue({
      ok: true, word: { text: "Saved words", videoUrl: "https://v/1.mp4", videoRef: "s3://b/k", sharedAt: "x" },
    });
    vi.mocked(draftTakeWord).mockClear();
    puts = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/v2/coach/sessions/t2/word" && init?.method === "PUT") {
        puts.push(JSON.parse(String(init.body)) as Record<string, unknown>);
        return new Response(JSON.stringify({ word: { text: "Saved words" } }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  const atTheWord = async () => {
    const start = ([{ type: "open" }, { type: "take", speaker: HERON, take: DONE }, { type: "onward" }] as PanelAction[])
      .reduce(panelReducer, PANEL_START);
    draw(<Host start={start} />);
    await flush();
  };
  const click = async (sel: string) => {
    await act(async () => q(sel)!.click());
    await flush();
  };
  const onVideo = (sel: string) => q(`[data-testid='coach-panel-takevideo'] ${sel}`);
  const links = () => qa("[data-testid='coach-panel-takevideo'] [data-walk-link]").map((b) => b.textContent);

  it("opens on the saved words and video, never a draft; Send to {p} keeps the video", async () => {
    await atTheWord();
    expect(q("[data-testid='coach-panel-takeword'] [data-coach-words]")!.textContent).toContain("Saved words");
    expect(draftTakeWord).not.toHaveBeenCalled();

    await click("[data-testid='coach-panel-takeword-next']");
    expect(onVideo("[data-coach-video]")).not.toBeNull();
    expect(onVideo("[data-coach-video-box]")).toBeNull();
    expect(onVideo("[data-testid='coach-panel-takevideo-send']")!.textContent).toBe(COPY.sendTo("Quiet Heron"));
    expect(links()).toEqual([COPY.recordAgain, COPY.removeTheVideo]);

    await click("[data-testid='coach-panel-takevideo-send']");
    expect(puts).toHaveLength(1);
    expect(puts[0]).toStrictEqual({ text: "Saved words", share: true }); // no video_ref: the backend keeps it
  });

  it("Remove the video holds across ‹ and Next, and Send without a video sends video_ref: null", async () => {
    await atTheWord();
    await click("[data-testid='coach-panel-takeword-next']");
    await click("[data-testid='coach-panel-takevideo-remove']");
    expect(onVideo("[data-coach-video-box='idle']")).not.toBeNull();
    expect(links()).toEqual([COPY.sendWithoutAVideo]);

    await click(`[data-testid='coach-panel-takevideo'] button[aria-label='${CHUNK_SHEET_COPY.pagerBack}']`);
    await click("[data-testid='coach-panel-takeword-next']");
    expect(onVideo("[data-coach-video-box='idle']")).not.toBeNull();
    expect(onVideo("[data-coach-video]")).toBeNull();

    await click("[data-testid='coach-panel-takevideo-send-without']");
    expect(puts).toHaveLength(1);
    expect(puts[0]).toStrictEqual({ text: "Saved words", video_ref: null, share: true });
  });

  it("leaving the word before Send cancels Remove the video: the next visit shows the saved video again", async () => {
    fetchMomentRead.mockResolvedValue(READ);
    await atTheWord();
    await click("[data-testid='coach-panel-takeword-next']");
    await click("[data-testid='coach-panel-takevideo-remove']");
    await click(`[data-testid='coach-panel-takevideo'] button[aria-label='${CHUNK_SHEET_COPY.pagerBack}']`);
    await click(`[data-testid='coach-panel-takeword'] button[aria-label='${CHUNK_SHEET_COPY.pagerBack}']`);
    await click("[data-testid='coach-panel-summary-next']");
    await click("[data-testid='coach-panel-takeword-next']");
    expect(onVideo("[data-coach-video]")).not.toBeNull();
    expect(links()).toEqual([COPY.recordAgain, COPY.removeTheVideo]);
    expect(puts).toHaveLength(0);
  });

  it("a Take drafted but never sent opens on its draft at every visit, drafted once; Send without a video sends video_ref: null", async () => {
    const real = await vi.importActual<typeof import("@/services/api/coachWalk")>("@/services/api/coachWalk");
    fetchTakeWord.mockImplementation(real.fetchTakeWord);
    vi.mocked(draftTakeWord).mockResolvedValueOnce({ surface: "coach_take_word", text: "Drafted words", modelVersion: null, label: null });
    // POST …/word/draft keeps the draft on the coach's row, so GET …/word
    // answers that row with no words and no video.
    const writes = globalThis.fetch;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => (url === "/api/v2/coach/sessions/t2/word" && !init?.method
      ? new Response(JSON.stringify({ word: { take_session_id: "t2", text: null, video_ref: null, video_url: null, shared_at: null, updated_at: "x" } }), { status: 200 })
      : writes(url, init))));
    const words = () => q("[data-testid='coach-panel-takeword'] [data-coach-words]")!.textContent;
    fetchMomentRead.mockResolvedValue(READ);

    await atTheWord();
    expect(words()).toContain("Drafted words");
    await click(`[data-testid='coach-panel-takeword'] button[aria-label='${CHUNK_SHEET_COPY.pagerBack}']`);
    await click("[data-testid='coach-panel-summary-next']");
    expect(words()).toContain("Drafted words");
    expect(draftTakeWord).toHaveBeenCalledTimes(1);

    await click("[data-testid='coach-panel-takeword-next']");
    expect(onVideo("[data-coach-video-box='idle']")).not.toBeNull();
    await click("[data-testid='coach-panel-takevideo-send-without']");
    expect(puts).toStrictEqual([{ text: "Drafted words", video_ref: null, share: true }]);
  });
});
