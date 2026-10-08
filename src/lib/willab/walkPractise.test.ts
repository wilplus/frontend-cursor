import { describe, expect, it } from "vitest";
import { WALK_COPY, WALK_LINE_BANK } from "@/components/willab/idealEditCopy";
import { buildWalkPlan, type WalkStep } from "./walkPlan";
import {
  encourageLine,
  improvedLine,
  loopEnd,
  practisePraiseBank,
  thanksLine,
  triesLeft,
  withChecking,
  withRead,
  withRetry,
  type PractiseRead,
} from "./walkPractise";

/* The practise loop's transitions (build plan D-FW-16; walk lock flow 7;
   N52.3, NX3 A, CM3a A, CM3b A, O5): pure, so every rule is a test. */

const keys = (steps: readonly WalkStep[]) => steps.map((s) => (s.moment == null ? s.key : `${s.key}:${s.moment}`));

/** One clearer moment, practised, with the whole plan after it. */
const PLAN = buildWalkPlan({ moments: [{ index: 0, slide: 0, clearer: true }], coachNote: false, practiceOn: true, guest: false });
const PRACTISE_AT = PLAN.findIndex((s) => s.key === "practise");

/** Stop on the try at `at`, then the machine's answer. */
function tryOnce(plan: readonly WalkStep[], at: number, read: PractiseRead | null, attempt: number) {
  const checking = withChecking(plan, at);
  const tried = { ...plan[at], attempt };
  return { plan: withRead(checking, at + 1, tried, read, { words: true, retryAttempt: attempt + 1 }), at: at + 2 };
}

describe("the practise loop's plan", () => {
  it("starts as clearer → practise, recording the accepted words", () => {
    expect(keys(PLAN)).toEqual(["page", "clearer:0", "practise:0", "intro", "judge:0", "community", "end"]);
    expect(PLAN[PRACTISE_AT]).toMatchObject({ kind: "words", attempt: 1 });
  });

  it("Stop: the checking screen follows the try", () => {
    expect(keys(withChecking(PLAN, PRACTISE_AT))).toEqual([
      "page", "clearer:0", "practise:0", "processing:0", "intro", "judge:0", "community", "end",
    ]);
  });

  it("praise on try 1: the praise after a try, then helper words from the try's words", () => {
    const { plan, at } = tryOnce(PLAN, PRACTISE_AT, { next: "praise", key: "cue:landed_ending" }, 1);
    expect(keys(plan)).toEqual([
      "page", "clearer:0", "practise:0", "processing:0", "improved:0", "helpers:0", "intro", "judge:0", "community", "end",
    ]);
    expect(plan[at]).toMatchObject({ key: "improved", kind: "cue:landed_ending" });
    expect(plan[at + 1]).toMatchObject({ key: "helpers", kind: "try" });
    expect(improvedLine(plan, at)).toBe(WALK_LINE_BANK.B07.lines[0]);
  });

  it("praise with no words back: no helper-words screen", () => {
    const checking = withChecking(PLAN, PRACTISE_AT);
    const plan = withRead(checking, PRACTISE_AT + 1, PLAN[PRACTISE_AT], { next: "praise", key: null }, { words: false });
    expect(keys(plan).slice(3, 6)).toEqual(["processing:0", "improved:0", "intro"]);
  });

  it("praise on try 2: encouragement, the next try, then the praise", () => {
    const first = tryOnce(PLAN, PRACTISE_AT, { next: "again", key: "effort" }, 1);
    expect(first.plan[first.at]).toMatchObject({ key: "encourage", kind: "effort" });
    expect(first.plan[first.at + 1]).toMatchObject({ key: "practise", kind: "words", attempt: 2 });
    const second = tryOnce(first.plan, first.at + 1, { next: "praise", key: "more_assured" }, 2);
    expect(keys(second.plan)).toEqual([
      "page", "clearer:0", "practise:0", "processing:0", "encourage:0", "practise:0",
      "processing:0", "improved:0", "helpers:0", "intro", "judge:0", "community", "end",
    ]);
    expect(improvedLine(second.plan, second.at)).toBe(WALK_LINE_BANK.B01.lines[0]);
  });

  it("again: 'It was better, …' when something moved (step), a rotating NX3a line when nothing did (effort)", () => {
    const step = tryOnce(PLAN, PRACTISE_AT, { next: "again", key: "step" }, 1);
    expect(encourageLine(step.plan, step.at)).toBe(WALK_COPY.encourage);
    const effort1 = tryOnce(PLAN, PRACTISE_AT, { next: "again", key: "effort" }, 1);
    const effort2 = tryOnce(effort1.plan, effort1.at + 1, { next: "again", key: "effort" }, 2);
    const lines = [encourageLine(effort1.plan, effort1.at), encourageLine(effort2.plan, effort2.at)];
    expect(lines).toEqual([WALK_COPY.encourageNothingMoved[0], WALK_COPY.encourageNothingMoved[1]]);
    expect(lines[0]).not.toBe(lines[1]);
  });

  it("the cap: after the third try that is not praise, a CM3b line and on to Judgement time!", () => {
    let walk = { plan: PLAN, at: PRACTISE_AT - 1 };
    for (const attempt of [1, 2]) walk = tryOnce(walk.plan, walk.at + 1, { next: "again", key: "effort" }, attempt);
    const capped = tryOnce(walk.plan, walk.at + 1, { next: "moved_on", key: "CM3b" }, 3);
    expect(capped.plan[capped.at]).toMatchObject({ key: "thanks", moment: 0 });
    expect(thanksLine(capped.plan, capped.at)).toBe(WALK_COPY.afterThirdTry[0]);
    expect(capped.plan[capped.at + 1].key).toBe("intro");
    expect(capped.plan.filter((s) => s.key === "practise")).toHaveLength(3);
  });

  it("the server's word wins: again on a third try is the thank-you too", () => {
    const third = { ...PLAN[PRACTISE_AT], attempt: 3 };
    const plan = withRead(withChecking(PLAN, PRACTISE_AT), PRACTISE_AT + 1, third, { next: "again", key: "effort" }, { words: false });
    expect(plan[PRACTISE_AT + 2].key).toBe("thanks");
  });

  it("a late or failed read (O5): Next or Practise again, never a verdict", () => {
    const late = tryOnce(PLAN, PRACTISE_AT, null, 1);
    expect(late.plan[late.at]).toMatchObject({ key: "late", attempt: 2 });
    expect(triesLeft(late.plan[late.at])).toBe(true);
    expect(loopEnd(late.plan, late.at)).toBe(late.plan.findIndex((s) => s.key === "intro"));
    const again = withRetry(late.plan, late.at, PLAN[PRACTISE_AT]);
    expect(again[late.at]).toMatchObject({ key: "practise", kind: "words", attempt: 2 });
    expect(triesLeft({ key: "late", attempt: 4 })).toBe(false);
  });

  it("Skip and Keep my words go past the moment's whole loop", () => {
    const first = tryOnce(PLAN, PRACTISE_AT, { next: "again", key: "effort" }, 1);
    const intro = first.plan.findIndex((s) => s.key === "intro");
    expect(loopEnd(first.plan, first.at)).toBe(intro);
    expect(loopEnd(first.plan, 1)).toBe(intro); // from the clearer version
  });

  it("maps the check's key to the signed bank, never inventing one", () => {
    expect(practisePraiseBank("cue:wide_range")).toBe("B02");
    expect(practisePraiseBank("cue:opened_strong")).toBe("B08");
    expect(practisePraiseBank("cue:unknown")).toBe("B09");
    expect(practisePraiseBank("cleared:rushing")).toBe("B09");
    expect(practisePraiseBank("good_job")).toBe("B09");
    expect(practisePraiseBank(null)).toBe("B09");
  });

  it("every line is a signed one with no number in it (AC-9)", () => {
    const first = tryOnce(PLAN, PRACTISE_AT, { next: "again", key: "effort" }, 1);
    const praised = tryOnce(PLAN, PRACTISE_AT, { next: "praise", key: "cue:kept_moving" }, 1);
    const capped = tryOnce(PLAN, PRACTISE_AT, { next: "moved_on", key: "CM3b" }, 3);
    const lines = [
      encourageLine(first.plan, first.at),
      improvedLine(praised.plan, praised.at),
      thanksLine(capped.plan, capped.at),
    ];
    for (const line of lines) expect(line).not.toMatch(/\d/);
    expect(WALK_LINE_BANK.B06.lines).toContain(lines[1]);
  });
});
