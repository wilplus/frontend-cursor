import { afterEach, describe, expect, it, vi } from "vitest";
import { coachPanelOn, coachPanelSwitchFrom } from "./coachPanelSwitch";

/* The coach panel's one switch (build plan P0): on only by the deploy's flag,
   or by ?coach2=1 outside production. */

describe("coachPanelSwitchFrom", () => {
  it("is off by default", () => {
    expect(coachPanelSwitchFrom({})).toBe(false);
    expect(coachPanelSwitchFrom({ nodeEnv: "development", search: "" })).toBe(false);
  });

  it("is on when the deploy says on, in production too", () => {
    expect(coachPanelSwitchFrom({ flag: "on", nodeEnv: "production" })).toBe(true);
    expect(coachPanelSwitchFrom({ flag: "on", nodeEnv: "development" })).toBe(true);
  });

  it("only the exact word turns it on", () => {
    expect(coachPanelSwitchFrom({ flag: "1", nodeEnv: "production" })).toBe(false);
    expect(coachPanelSwitchFrom({ flag: "true", nodeEnv: "production" })).toBe(false);
    expect(coachPanelSwitchFrom({ flag: "ON", nodeEnv: "production" })).toBe(false);
  });

  it("?coach2=1 turns it on outside production", () => {
    expect(coachPanelSwitchFrom({ nodeEnv: "development", search: "?coach2=1" })).toBe(true);
    expect(coachPanelSwitchFrom({ nodeEnv: "test", search: "?a=b&coach2=1" })).toBe(true);
  });

  it("production never reads the address", () => {
    expect(coachPanelSwitchFrom({ nodeEnv: "production", search: "?coach2=1" })).toBe(false);
  });

  it("any other value, and the Feedback walk's own word, leave it off", () => {
    expect(coachPanelSwitchFrom({ nodeEnv: "development", search: "?coach2=0" })).toBe(false);
    expect(coachPanelSwitchFrom({ nodeEnv: "development", search: "?coach2=on" })).toBe(false);
    expect(coachPanelSwitchFrom({ nodeEnv: "development", search: "?walk=1" })).toBe(false);
  });
});

describe("coachPanelOn", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("reads the deploy flag", () => {
    vi.stubEnv("NEXT_PUBLIC_COACH_PANEL_V2", "on");
    expect(coachPanelOn()).toBe(true);
  });

  it("is off with no flag and no window (the server)", () => {
    vi.stubEnv("NEXT_PUBLIC_COACH_PANEL_V2", "");
    expect(coachPanelOn()).toBe(false);
  });
});
