/*
STORY    Two interventions do not fire for the same moment when an
         earlier step already covers it.
OUTCOME
  O1  At most two interventions show, and the earliest step wins.
PROVES   O1 -> "fires at most two, and the earliest step in the file's order wins"
*/
import { describe, expect, it } from "vitest";
import { pickInterventions } from "./overlap";
import { seedInterventions, takeAllUnlocked, takeWithGate } from "./sample";
import { gateSentence, leaksHiddenWord } from "./words";

describe("intervention overlap on the real grid", () => {
  it("fires at most two on the gated step, and does not show a later step", () => {
    const take = takeWithGate("engagement");
    const pick = pickInterventions(take.moments[0], seedInterventions(), take.order, take.take_id, take.gate);
    expect(pick.shown.map((hit) => hit.step)).toEqual(["engagement", "engagement"]);
    expect(pick.shown.map((hit) => hit.id).sort()).toEqual(["short-pause", "slow-open"]);
    expect(pick.shown.map((hit) => hit.id)).not.toContain("point-page");
    expect(leaksHiddenWord(gateSentence(take.gate))).toBeNull();
    expect(gateSentence(take.gate)).toContain("how much you join in");
    expect(JSON.stringify(pick)).not.toContain("score_if_unlocked");
  });

  it("a later step can show when it is the one that matches", () => {
    const take = takeAllUnlocked();
    const onlyLater = [{
      id: "lift",
      name: "Leave a little more air",
      threshold: 1,
      rule: { step: "arousal" as const },
      grid: [{ step: "arousal" as const, cue: "pitch_level", value: 0.9 }],
    }];
    const pick = pickInterventions(take.moments[0], onlyLater, take.order, take.take_id, null);
    expect(pick.shown).toHaveLength(1);
    expect(pick.shown[0].step).toBe("arousal");
    expect(take.order.every((step) => take.summary[step].unlocked)).toBe(true);
  });
});
