import { describe, expect, it } from "vitest";
import { WAITING_TIPS, pickWaitingTip } from "./waitingTips";

describe("waitingTips", () => {
  it("always returns one of the approved tips", () => {
    for (let i = 0; i < 50; i++) {
      expect(WAITING_TIPS).toContain(pickWaitingTip());
    }
  });

  it("can return more than one distinct tip across sessions", () => {
    // One tip per waiting session, but not the SAME one every session.
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(pickWaitingTip());
    expect(seen.size).toBeGreaterThan(1);
  });

  it("carries no em-dashes (product copy rule)", () => {
    for (const tip of WAITING_TIPS) expect(tip).not.toContain("—");
  });

  it("keeps every tip short enough to read during a wait", () => {
    for (const tip of WAITING_TIPS) expect(tip.length).toBeLessThan(200);
  });
});
