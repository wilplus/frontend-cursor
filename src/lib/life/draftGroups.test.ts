import { describe, expect, it } from "vitest";
import { draftKindsInOrder } from "./draftGroups";

const rows = (...kinds: string[]) => kinds.map((kind) => ({ kind }));

describe("draftKindsInOrder", () => {
  it("keeps the hinted kind first, where the backend put it", () => {
    // A document opened from Phrases that also holds goals: the backend leads
    // with the phrases because that is the view the person is standing on.
    // Re-sorting here would bury them under Goals on the Phrases screen, which
    // is exactly the regression this replaced.
    expect(draftKindsInOrder(rows("phrase", "phrase", "goal", "habit"))).toEqual(
      ["phrase", "goal", "habit"]
    );
  });

  it("does not privilege the four kinds the setup fold knows", () => {
    // The old order was a hardcoded ["bet", "goal", "habit", "distraction"].
    // Nothing may lead just because it is one of those.
    expect(draftKindsInOrder(rows("principle", "bet"))).toEqual([
      "principle",
      "bet",
    ]);
    expect(draftKindsInOrder(rows("win", "goal", "win"))).toEqual([
      "win",
      "goal",
    ]);
  });

  it("groups an interleaved response by first appearance", () => {
    expect(
      draftKindsInOrder(rows("goal", "habit", "goal", "distraction", "habit"))
    ).toEqual(["goal", "habit", "distraction"]);
  });

  it("handles the empty draft", () => {
    expect(draftKindsInOrder([])).toEqual([]);
  });
});
