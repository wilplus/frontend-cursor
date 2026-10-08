import { describe, expect, it } from "vitest";
import {
  PANEL_START,
  isRated,
  momentCounter,
  momentOf,
  panelReducer,
  takeWithRatings,
  walkScreenOf,
  type PanelAction,
  type PanelState,
} from "./coachPanel";
import type { QueueMoment, QueueSpeaker, QueueTake } from "./coachWalk";

/* The coach panel's pure half (founder lock 2026-10-06, coach panel redrawn;
   build plan P0/P1): queue → speaker → judge → What happened. */

const m = (snippetId: string, state: QueueMoment["state"] = "judge_it"): QueueMoment => ({
  snippetId, state, kind: null,
});
const TAKE: QueueTake = {
  sessionId: "take-2", takeIndex: 2, sentAt: "", waiting: 3, waitingForText: false,
  moments: [m("s1"), m("s2", "answered"), m("s3"), m("s4")],
};
const HERON: QueueSpeaker = { pseudonym: "Quiet Heron", waiting: 3, takes: [TAKE] };

const run = (...actions: PanelAction[]) => actions.reduce(panelReducer, PANEL_START);
const atTake = () => run({ type: "open" }, { type: "speaker", speaker: HERON }, { type: "take", speaker: HERON, take: TAKE });
const where = (s: PanelState) => `${s.screen.key}${momentOf(s.screen) ? `:${momentOf(s.screen)!.snippetId}` : ""}`;

describe("opening", () => {
  it("starts in the Lounge, the bubble opens the queue with nothing behind it", () => {
    expect(PANEL_START.screen.key).toBe("lounge");
    const s = run({ type: "open" });
    expect(s.screen.key).toBe("queue");
    expect(s.history).toEqual([]);
  });

  it("a speaker, then a Take opens its first open moment on Judge", () => {
    const s = atTake();
    expect(where(s)).toBe("judge:s1");
    expect(s.history.map((h) => h.key)).toEqual(["queue", "speaker"]);
  });

  it("a Take whose first moments are done opens the first open one", () => {
    const take = { ...TAKE, moments: [m("a", "answered"), m("b", "nothing_to_add"), m("c")] };
    const s = run({ type: "open" }, { type: "take", speaker: HERON, take });
    expect(where(s)).toBe("judge:c");
  });

  it("a Take with nothing open opens its first moment on What happened", () => {
    const take = { ...TAKE, moments: [m("a", "answered"), m("b", "answered")] };
    expect(where(run({ type: "open" }, { type: "take", speaker: HERON, take }))).toBe("reveal:a");
  });

  it("a Take with no moments (waiting for the text) opens nothing", () => {
    const take = { ...TAKE, moments: [], waitingForText: true };
    expect(where(run({ type: "open" }, { type: "take", speaker: HERON, take }))).toBe("queue");
  });
});

describe("Your speakers (D-CP-12)", () => {
  it("the pinned button opens Your speakers with nothing behind it", () => {
    const s = run({ type: "speakers" });
    expect(s.screen.key).toBe("speakers");
    expect(s.history).toEqual([]);
    expect(walkScreenOf(s.screen)).toEqual({ key: "speakers" });
  });

  it("a speaker opens from the list, and ‹ returns to the list, then the Lounge", () => {
    let s = run({ type: "speakers" }, { type: "speaker", speaker: HERON });
    expect(where(s)).toBe("speaker");
    expect(s.history.map((h) => h.key)).toEqual(["speakers"]);
    s = panelReducer(s, { type: "back" });
    expect(where(s)).toBe("speakers");
    s = panelReducer(s, { type: "back" });
    expect(where(s)).toBe("lounge");
  });

  it("a speaker with every moment answered has Takes that open nothing", () => {
    const finch: QueueSpeaker = {
      pseudonym: "Bold Finch", goal: "Open the keynote without notes.", waiting: 0,
      takes: [{ ...TAKE, sessionId: "finch-3", takeIndex: 3, waiting: 0, moments: [] }],
    };
    const s = run({ type: "speakers" }, { type: "speaker", speaker: finch }, { type: "take", speaker: finch, take: finch.takes[0] });
    expect(where(s)).toBe("speaker");
  });

  it("the hand-over's resume keeps the way in: Your speakers, not the queue", () => {
    let s = run({ type: "speakers" }, { type: "speaker", speaker: HERON }, { type: "take", speaker: HERON, take: TAKE });
    s = panelReducer(s, { type: "resume", speaker: HERON, take: TAKE, index: 0 });
    expect(where(s)).toBe("judge:s3");
    expect(s.history.map((h) => h.key)).toEqual(["speakers", "speaker"]);
    s = panelReducer(s, { type: "back" });
    s = panelReducer(s, { type: "back" });
    expect(where(s)).toBe("speakers");
  });
});

describe("judging", () => {
  it("a saved rating moves on to What happened by itself", () => {
    const s = panelReducer(atTake(), { type: "rated", snippetId: "s1", value: "no" });
    expect(where(s)).toBe("reveal:s1");
    expect(s.rated).toEqual({ s1: "no" });
    expect(s.dir).toBe("forward");
  });

  it("a rating for another moment does not move the screen", () => {
    const s = panelReducer(atTake(), { type: "rated", snippetId: "s3", value: "yes" });
    expect(where(s)).toBe("judge:s1");
    expect(s.rated.s3).toBe("yes");
  });

  it("What happened is never reached for an unrated moment (BLIND COACH)", () => {
    // Every path: open, › around the whole take, ‹ all the way back.
    let s = atTake();
    const seen: string[] = [where(s)];
    for (let i = 0; i < 8; i++) { s = panelReducer(s, { type: "next" }); seen.push(where(s)); }
    for (let i = 0; i < 12; i++) { s = panelReducer(s, { type: "back" }); seen.push(where(s)); }
    for (const w of seen) {
      if (w.startsWith("reveal:")) expect(w).toBe("reveal:s2"); // s2 was answered before
    }
  });
});

describe("› and ‹", () => {
  it("› walks the moments, landing on Judge when unrated and on What happened when rated", () => {
    let s = atTake();
    s = panelReducer(s, { type: "next" });
    expect(where(s)).toBe("reveal:s2");
    s = panelReducer(s, { type: "next" });
    expect(where(s)).toBe("judge:s3");
    s = panelReducer(s, { type: "next" });
    expect(where(s)).toBe("judge:s4");
    s = panelReducer(s, { type: "next" });
    expect(where(s)).toBe("judge:s1"); // wraps, as the prototype's skip
  });

  it("‹ goes back through the history", () => {
    let s = atTake();
    s = panelReducer(s, { type: "next" });
    s = panelReducer(s, { type: "back" });
    expect(where(s)).toBe("judge:s1");
    expect(s.dir).toBe("back");
    s = panelReducer(s, { type: "back" });
    expect(where(s)).toBe("speaker");
    s = panelReducer(s, { type: "back" });
    expect(where(s)).toBe("queue");
    s = panelReducer(s, { type: "back" });
    expect(where(s)).toBe("lounge");
  });

  it("‹ from What happened never reopens the blind Judge of the same moment", () => {
    let s = panelReducer(atTake(), { type: "rated", snippetId: "s1", value: "in_between" });
    s = panelReducer(s, { type: "back" });
    expect(where(s)).toBe("speaker");
  });

  it("‹ onto a moment rated since lands on its What happened", () => {
    let s = atTake(); // judge s1
    s = panelReducer(s, { type: "next" }); // reveal s2
    s = panelReducer(s, { type: "next" }); // judge s3
    s = panelReducer(s, { type: "rated", snippetId: "s3", value: "yes" }); // reveal s3
    s = panelReducer(s, { type: "back" });
    expect(where(s)).toBe("reveal:s2");
    s = panelReducer(s, { type: "back" });
    expect(where(s)).toBe("judge:s1"); // still unrated: Judge
  });

  it("› on a one-moment Take does nothing", () => {
    const take = { ...TAKE, moments: [m("only")] };
    const s = run({ type: "open" }, { type: "take", speaker: HERON, take });
    expect(panelReducer(s, { type: "next" })).toBe(s);
  });

  it("✕ closes from anywhere, history and all", () => {
    const s = panelReducer(atTake(), { type: "close" });
    expect(s.screen.key).toBe("lounge");
    expect(s.history).toEqual([]);
  });
});

describe("the counter counts moments only", () => {
  it("moment N of M over the Take's moments", () => {
    let s = atTake();
    expect(momentCounter(s.screen)).toEqual({ index: 0, total: 4 });
    s = panelReducer(s, { type: "next" });
    expect(momentCounter(s.screen)).toEqual({ index: 1, total: 4 });
    s = panelReducer(s, { type: "rated", snippetId: "s2", value: "yes" });
    expect(momentCounter(s.screen)).toEqual({ index: 1, total: 4 });
  });

  it("no counter off the moments", () => {
    expect(momentCounter(run({ type: "open" }).screen)).toBeNull();
    expect(momentCounter(run({ type: "open" }, { type: "speaker", speaker: HERON }).screen)).toBeNull();
  });
});

describe("the hand-over to the old answer flow and back", () => {
  it("the old flow gets the take with this visit's ratings applied", () => {
    const s = panelReducer(atTake(), { type: "rated", snippetId: "s1", value: "no" });
    const take = takeWithRatings(TAKE, s.rated);
    expect(take.moments[0].state).toBe("judged");
    expect(take.moments[2].state).toBe("judge_it");
    expect(takeWithRatings(TAKE, {})).toBe(TAKE);
  });

  it("back from it, the next open moment opens, ‹ still reaches the speaker", () => {
    const answered = { ...TAKE, moments: [m("s1", "answered"), m("s2", "answered"), m("s3"), m("s4")] };
    let s = panelReducer(PANEL_START, { type: "resume", speaker: HERON, take: answered, index: 0 });
    expect(where(s)).toBe("judge:s3");
    s = panelReducer(s, { type: "back" });
    expect(where(s)).toBe("speaker");
  });

  it("wraps to an earlier open moment", () => {
    const take = { ...TAKE, moments: [m("s1"), m("s2", "answered"), m("s3", "answered")] };
    expect(where(panelReducer(PANEL_START, { type: "resume", speaker: HERON, take, index: 2 }))).toBe("judge:s1");
  });

  it("nothing left open: the speaker's Takes", () => {
    const done = { ...TAKE, moments: [m("s1", "answered"), m("s2", "nothing_to_add")] };
    const s = panelReducer(PANEL_START, { type: "resume", speaker: HERON, take: done, index: 1 });
    expect(where(s)).toBe("speaker");
    expect(where(panelReducer(s, { type: "back" }))).toBe("queue");
  });
});

describe("helpers", () => {
  it("isRated: anything past Judge it, or rated on this visit", () => {
    expect(isRated(m("x"), {})).toBe(false);
    expect(isRated(m("x"), { x: "yes" })).toBe(true);
    expect(isRated(m("x", "answer_it"), {})).toBe(true);
    expect(isRated(undefined, {})).toBe(false);
  });

  it("walkScreenOf: the Lounge is the page, every other screen an overlay", () => {
    expect(walkScreenOf({ key: "lounge" })).toEqual({ key: "lounge", overlay: false });
    expect(walkScreenOf({ key: "queue" })).toEqual({ key: "queue" });
    const s = atTake();
    expect(walkScreenOf(s.screen)).toEqual({ key: "judge", moment: 0, kind: "take-2" });
  });
});
