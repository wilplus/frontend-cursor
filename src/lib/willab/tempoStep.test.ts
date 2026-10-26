/*
STORY    As a speaker in a pace week, I want the walk to give me a tempo game right after my practise moment, read each try from where the ball stayed, and close with one line in words, so that I feel my pace change without a score.
OUTCOME
  O1  The tempo step sits right after the practise moments and before other speakers; without it the walk is unchanged (N166).
  O2  It never appears in the coach-only walk or for a guest (N162).
  O3  A try that stays mostly in the green reads as better; otherwise the side the ball leaned to.
  O4  The step closes "dynamic" once a try was better and the last was not rushed; otherwise the side the tries leaned to.
  O5  The step runs on the backend's stretch only when its answer is whole; anything else means no tempo step.
PROVES   O1 -> "comes right after the practise moments, before other speakers", "leaves the walk unchanged when the Take has no intervention"
         O2 -> "is never in the coach-only walk or a guest's"
         O3 -> "reads a try from where the ball stayed"
         O4 -> "closes on one line from the tries"
         O5 -> "takes the backend's stretch only when it is whole"
WHY      Founder 2026-10-26 (backend N162: "in the feedback walk only"; N166: "go with the defaults"); Never-rule 1.
*/
import { describe, expect, it } from "vitest";
import { buildWalkPlan, type WalkMoment } from "./walkPlan";
import { closeOf, readTry } from "./tempoStep";
import { readTempo } from "@/services/api/reviewTempo";

const MOMENTS: WalkMoment[] = [
  { index: 0, slide: 0, praise: true },
  { index: 1, slide: 1, exercise: true },
];
const base = { moments: MOMENTS, coachNote: false, practiceOn: true, guest: false };
const keys = (input: Parameters<typeof buildWalkPlan>[0]) => buildWalkPlan(input).map((s) => s.key);

describe("the tempo step in the walk", () => {
  it("comes right after the practise moments, before other speakers", () => {
    const plan = keys({ ...base, interventions: ["tempo"] });
    expect(plan.slice(plan.lastIndexOf("practise") + 1, plan.indexOf("others") + 1)).toEqual(["tempo", "others"]);
  });

  it("leaves the walk unchanged when the Take has no intervention", () => {
    expect(keys({ ...base, interventions: [] })).toEqual(keys(base));
    expect(keys(base)).not.toContain("tempo");
  });

  it("is never in the coach-only walk or a guest's", () => {
    expect(keys({ ...base, coachNote: true, coachOnly: true, interventions: ["tempo"] })).not.toContain("tempo");
    expect(keys({ ...base, guest: true, interventions: ["tempo"] })).not.toContain("tempo");
  });
});

describe("a try and the step's close", () => {
  const steady = Array(20).fill(0.5);
  const racing = Array(20).fill(0.95);
  const dragging = Array(20).fill(0.05);

  it("reads a try from where the ball stayed", () => {
    expect(readTry(steady)).toBe("ok");
    expect(readTry(racing)).toBe("rush");
    expect(readTry(dragging)).toBe("slow");
    expect(readTry([0.5])).toBe("slow");
  });

  it("closes on one line from the tries", () => {
    expect(closeOf(["rush", "ok"])).toBe("dynamic");
    expect(closeOf(["ok", "rush"])).toBe("rush");
    expect(closeOf(["slow", "slow", "rush"])).toBe("slow");
  });
});

describe("the backend's stretch", () => {
  const whole = { reading: "rushed", topic: "the beds for sale", said: { before: "Hi.", stretch: "The beds are on sale.", after: "Bye." } };

  it("takes the backend's stretch only when it is whole", () => {
    expect(readTempo(whole)).toEqual(whole);
    expect(readTempo(null)).toBeNull();
    expect(readTempo({ ...whole, reading: "fast" })).toBeNull();
    expect(readTempo({ ...whole, topic: "" })).toBeNull();
    expect(readTempo({ ...whole, said: { stretch: "" } })).toBeNull();
  });
});
