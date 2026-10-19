/*
STORY    As a speaker, I want no top-up offer while the Lab is on screen, so
         that payment never gets in the way of a Take.
OUTCOME
  O1  Never 3 (the loop is never blocked): the top-up card may not mount in
      any Lab or readout state, nor in project pick, nor while the thread loads.
  O2  In the Lounge, once the thread has loaded, it may mount.
PROVES   O1 -> "never mounts while the Lab owns the screen"
         O2 -> "mounts in the Lounge once the thread has loaded"
WHY      LIVE LOOP fence: an upgrade offer mid-take is the worst moment for one.
*/
import { describe, expect, it } from "vitest";
import { canMountTopUpCard } from "./topUpCardGate";
import type { WillabState } from "./useWillabFlow";

const LAB_STATES: WillabState[] = [
  "lab_project_pick",
  "lab_feelings",
  "lab_session_context",
  "lab_prerecord",
  "lab_recording",
  "lab_processing",
  "readout",
];

describe("canMountTopUpCard", () => {
  it("never mounts while the Lab owns the screen", () => {
    for (const state of LAB_STATES) {
      expect(canMountTopUpCard(state, false), `${state} must be excluded`).toBe(false);
    }
    expect(canMountTopUpCard("lounge_idle", true), "thread still loading").toBe(false);
  });

  it("mounts in the Lounge once the thread has loaded", () => {
    expect(canMountTopUpCard("lounge_idle", false)).toBe(true);
    expect(canMountTopUpCard("lounge_general", false)).toBe(true);
  });
});
