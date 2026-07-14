import { describe, expect, it } from "vitest";
import {
  pickPrimingPhrase,
  primingConditionForTake,
} from "./primingPhrases";

describe("primingConditionForTake", () => {
  it("maps batch position → condition (threat/challenge/balanced)", () => {
    expect(primingConditionForTake(1)).toBe("threat");
    expect(primingConditionForTake(2)).toBe("challenge");
    expect(primingConditionForTake(3)).toBe("balanced");
  });

  it("clamps out-of-range positions to the ends", () => {
    expect(primingConditionForTake(0)).toBe("threat");
    expect(primingConditionForTake(9)).toBe("balanced");
  });
});

describe("pickPrimingPhrase", () => {
  it("picks a phrase from the take's condition bank", () => {
    // rand=0 → first phrase of the threat bank
    const first = pickPrimingPhrase(1, () => 0);
    expect(first.condition).toBe("threat");
    expect(first.phrase).toBe(
      "Your performance is being strictly graded; errors will lower your score."
    );
    // rand→~1 → last phrase of the challenge bank
    const last = pickPrimingPhrase(2, () => 0.99);
    expect(last.condition).toBe("challenge");
    expect(last.phrase).toBe("Your racing heart is just energy to help you focus.");
  });

  it("varies across calls (not always the same line)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 3; i++) {
      seen.add(pickPrimingPhrase(3, () => i / 3).phrase);
    }
    expect(seen.size).toBe(3);
  });

  it("never returns undefined even at rand()===1", () => {
    expect(pickPrimingPhrase(1, () => 1).phrase).toBeTruthy();
  });
});
