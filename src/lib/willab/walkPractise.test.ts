import { describe, expect, it } from "vitest";
import { WALK_LINE_BANK } from "@/components/willab/idealEditCopy";
import { buildWalkPlan, type WalkStep } from "./walkPlan";
import {
  encourageLine,
  improvedLine,
  practisePraiseBank,
  thanksLine,
  triesLeft,
  withChecking,
  withRead,
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
  it("praise with no words back: no helper-words screen", () => {
    const checking = withChecking(PLAN, PRACTISE_AT);
    const plan = withRead(checking, PRACTISE_AT + 1, PLAN[PRACTISE_AT], { next: "praise", key: null }, { words: false });
    expect(keys(plan).slice(3, 6)).toEqual(["processing:0", "improved:0", "intro"]);
  });

  it("the server's word wins: again on a third try is the thank-you too", () => {
    const third = { ...PLAN[PRACTISE_AT], attempt: 3 };
    const plan = withRead(withChecking(PLAN, PRACTISE_AT), PRACTISE_AT + 1, third, { next: "again", key: "effort" }, { words: false });
    expect(plan[PRACTISE_AT + 2].key).toBe("thanks");
  });

  it("a late or failed read after the last try offers no Practise again (O5, CM3a A)", () => {
    // The rendered walk proves Next / Practise again on an early try; only the
    // cap is left here.
    expect(triesLeft({ key: "late", attempt: 2 })).toBe(true);
    expect(triesLeft({ key: "late", attempt: 4 })).toBe(false);
  });

  it("maps the check's key to the signed bank, never inventing one", () => {
    expect(practisePraiseBank("cue:wide_range")).toBe("B02");
    expect(practisePraiseBank("cue:unknown")).toBe("B09");
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
