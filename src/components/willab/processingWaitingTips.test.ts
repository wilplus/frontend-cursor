import { describe, expect, it } from "vitest";
import { availableWaitingTips } from "./processingWaitingTips";

describe("ProcessingWait across a live deployment", () => {
  it("falls back when the older waitingTips module has no collection", () => {
    const tips = availableWaitingTips(undefined);

    expect(tips).toHaveLength(1);
    expect(tips[0]).toContain("Focus on the value your audience needs");
    expect(() => tips.map((tip) => tip.length)).not.toThrow();
  });

  it("keeps the approved collection when the current module is loaded", () => {
    expect(availableWaitingTips(["First", "Second"])).toEqual([
      "First",
      "Second",
    ]);
  });

  it("removes malformed entries before rendering", () => {
    expect(availableWaitingTips(["Good", undefined, "", 4])).toEqual([
      "Good",
    ]);
  });
});
