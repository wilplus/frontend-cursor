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

  it("‹ from What happened never reopens the blind Judge of the same moment", () => {
    let s = panelReducer(atTake(), { type: "rated", snippetId: "s1", value: "in_between" });
    s = panelReducer(s, { type: "back" });
    expect(where(s)).toBe("speaker");
  });
});
