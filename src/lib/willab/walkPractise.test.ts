import { describe, expect, it } from "vitest";
import { WALK_LINE_BANK } from "@/components/willab/idealEditCopy";
import { buildWalkPlan, type WalkStep } from "./walkPlan";
import {
  encourageLine,
  improvedLine,
  thanksLine,
  withChecking,
  withRead,
  type PractiseRead,
} from "./walkPractise";

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
