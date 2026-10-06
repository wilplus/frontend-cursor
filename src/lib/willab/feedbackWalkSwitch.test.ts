import { afterEach, describe, expect, it, vi } from "vitest";
import { feedbackWalkOn, walkSwitchFrom } from "./feedbackWalkSwitch";

/* The Feedback walk's one switch (build plan P1): on only by the deploy's
   flag, or by ?walk=1 outside production. */

describe("walkSwitchFrom", () => {
  it("is off by default", () => {
    expect(walkSwitchFrom({})).toBe(false);
    expect(walkSwitchFrom({ nodeEnv: "development", search: "" })).toBe(false);
  });

  it("is on when the deploy says on, in production too", () => {
    expect(walkSwitchFrom({ flag: "on", nodeEnv: "production" })).toBe(true);
    expect(walkSwitchFrom({ flag: "on", nodeEnv: "development" })).toBe(true);
  });

  it("only the exact word turns it on", () => {
    expect(walkSwitchFrom({ flag: "1", nodeEnv: "production" })).toBe(false);
    expect(walkSwitchFrom({ flag: "true", nodeEnv: "production" })).toBe(false);
    expect(walkSwitchFrom({ flag: "ON", nodeEnv: "production" })).toBe(false);
  });

  it("?walk=1 turns it on outside production", () => {
    expect(walkSwitchFrom({ nodeEnv: "development", search: "?walk=1" })).toBe(true);
    expect(walkSwitchFrom({ nodeEnv: "test", search: "?a=b&walk=1" })).toBe(true);
  });

  it("production never reads the address", () => {
    expect(walkSwitchFrom({ nodeEnv: "production", search: "?walk=1" })).toBe(false);
  });

  it("any other value of walk leaves it off", () => {
    expect(walkSwitchFrom({ nodeEnv: "development", search: "?walk=0" })).toBe(false);
    expect(walkSwitchFrom({ nodeEnv: "development", search: "?walk=on" })).toBe(false);
  });
});

describe("feedbackWalkOn", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("reads the deploy flag", () => {
    vi.stubEnv("NEXT_PUBLIC_FEEDBACK_WALK", "on");
    expect(feedbackWalkOn()).toBe(true);
  });

  it("is off with no flag and no window (the server)", () => {
    vi.stubEnv("NEXT_PUBLIC_FEEDBACK_WALK", "");
    expect(feedbackWalkOn()).toBe(false);
  });
});
