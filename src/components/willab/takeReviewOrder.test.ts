import { describe, expect, it } from "vitest";
import { countAwaitingReview, orderTakesForReview } from "./takeReviewOrder";
import type { ReviewStateTake } from "@/services/api/coachReviewState";

function take(
  sessionId: string,
  takeIndex: number | null,
  reviewState: ReviewStateTake["reviewState"]
): ReviewStateTake {
  return { sessionId, takeIndex, reviewState, hasReread: false };
}

describe("orderTakesForReview", () => {
  it("puts the takes still WAITING at the very top", () => {
    const out = orderTakesForReview([
      take("d", 1, "delivered"),
      take("r", 2, "reviewed"),
      take("w", 3, "to_review"),
    ]);
    expect(out.map((t) => t.sessionId)).toEqual(["w", "r", "d"]);
  });

  it("orders by take index inside each group", () => {
    const out = orderTakesForReview([
      take("w3", 3, "to_review"),
      take("w1", 1, "to_review"),
      take("r4", 4, "reviewed"),
      take("r2", 2, "reviewed"),
    ]);
    expect(out.map((t) => t.sessionId)).toEqual(["w1", "w3", "r2", "r4"]);
  });

  it("treats an unknown state as unreviewed", () => {
    // If we cannot tell, the safe error is showing the coach work that may
    // still be outstanding.
    const out = orderTakesForReview([
      take("done", 1, "reviewed"),
      take("dunno", 2, null),
    ]);
    expect(out[0].sessionId).toBe("dunno");
  });

  it("sorts a null take index last within its group, never first", () => {
    const out = orderTakesForReview([
      take("nul", null, "to_review"),
      take("one", 1, "to_review"),
    ]);
    expect(out.map((t) => t.sessionId)).toEqual(["one", "nul"]);
  });

  it("is pure and stable", () => {
    const input = [take("b", 1, "to_review"), take("a", 1, "to_review")];
    const first = orderTakesForReview(input);
    const second = orderTakesForReview(input);
    expect(first.map((t) => t.sessionId)).toEqual(
      second.map((t) => t.sessionId)
    );
    // The caller's array is untouched — a list that reshuffles under a poll
    // is unusable when you are working down it.
    expect(input.map((t) => t.sessionId)).toEqual(["b", "a"]);
  });

  it("keeps every take — pushed down, never dropped", () => {
    const input = [
      take("a", 1, "delivered"),
      take("b", 2, "reviewed"),
      take("c", 3, "to_review"),
    ];
    expect(orderTakesForReview(input)).toHaveLength(3);
  });
});

describe("countAwaitingReview", () => {
  it("counts only the ones still waiting", () => {
    expect(
      countAwaitingReview([
        take("a", 1, "to_review"),
        take("b", 2, "reviewed"),
        take("c", 3, "delivered"),
        take("d", 4, null),
      ])
    ).toBe(2);
  });

  it("is zero on an empty list", () => {
    expect(countAwaitingReview([])).toBe(0);
  });
});
