import { describe, expect, it } from "vitest";
import {
  PANEL_START,
  momentOf,
  panelReducer,
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

describe("judging", () => {

  it("no screen after Judge is reached for an unrated moment (BLIND COACH)", () => {
    // Every path: open, › around the whole take, ‹ all the way back.
    let s = atTake();
    const seen: string[] = [where(s)];
    for (let i = 0; i < 8; i++) { s = panelReducer(s, { type: "next" }); seen.push(where(s)); }
    for (let i = 0; i < 12; i++) { s = panelReducer(s, { type: "back" }); seen.push(where(s)); }
    for (const w of seen) {
      if (w.includes(":") && !w.startsWith("judge:")) expect(w).toBe("summary:s2"); // s2 was answered before
    }
  });
});

describe("› and ‹", () => {

  it("‹ from What happened never reopens the blind Judge of the same moment", () => {
    let s = panelReducer(atTake(), { type: "rated", snippetId: "s1", value: "in_between" });
    s = panelReducer(s, { type: "back" });
    expect(where(s)).toBe("speaker");
  });
});

describe("the answer", () => {
  const rated = () => [
    { type: "rated", snippetId: "s1", value: "no" },
    { type: "step", key: "decide" },
    { type: "step", key: "words" },
  ] as PanelAction[];

  it("an answer moves on to the next moment that waits, and after the last to the Take's word", () => {
    let s = rated().reduce(panelReducer, atTake());
    s = panelReducer(s, { type: "finish" });
    expect(where(s)).toBe("judge:s3");
    for (const id of ["s3", "s4"]) {
      s = panelReducer(s, { type: "rated", snippetId: id, value: "yes" });
      s = panelReducer(s, { type: "finish" });
    }
    expect(s.screen.key).toBe("takeword");
  });

  it("an answered moment opens on Summary; Change my answer reopens its choice", () => {
    let s = rated().reduce(panelReducer, atTake());
    s = panelReducer(s, { type: "finish" });
    s = panelReducer(s, { type: "back" });
    // ‹ into a step of the answered moment reopens its choice (prototype back()).
    expect(where(s)).toBe("decide:s1");
    s = panelReducer(s, { type: "finish" });
    expect(where(s)).toBe("judge:s3");
    s = run({ type: "open" }, { type: "take", speaker: HERON, take: { ...TAKE, moments: [m("s2", "answered")] } });
    expect(where(s)).toBe("summary:s2");
    s = panelReducer(s, { type: "changeAnswer", to: "decide" });
    expect(where(s)).toBe("decide:s2");
  });
});
