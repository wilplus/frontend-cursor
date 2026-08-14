import { describe, expect, it } from "vitest";
import { canMountTopUpCard } from "./topUpCardGate";
import type { WillabState } from "./useWillabFlow";

/* The LIVE LOOP fence, as a predicate. An upgrade offer must never appear
 * while the Lab owns the screen — and least of all mid-take, since running
 * out of tokens never blocks a recording anyway. */

const LAB_OVERLAY_STATES: WillabState[] = [
  "lab_feelings",
  "lab_session_context",
  "lab_prerecord",
  "lab_recording",
  "lab_processing",
  "readout",
];

describe("canMountTopUpCard", () => {
  it("mounts in the ordinary Lounge", () => {
    expect(canMountTopUpCard("lounge" as WillabState, false)).toBe(true);
  });

  it("never mounts above a loading thread", () => {
    // No card above a skeleton: it would render before the conversation it
    // is supposed to sit inside.
    expect(canMountTopUpCard("lounge" as WillabState, true)).toBe(false);
  });

  it("never mounts while the Lab owns the screen", () => {
    for (const state of LAB_OVERLAY_STATES) {
      expect(canMountTopUpCard(state, false), `${state} must be excluded`).toBe(
        false
      );
    }
  });

  it("never mounts during project pick (setup precedes the Lab)", () => {
    expect(canMountTopUpCard("lab_project_pick" as WillabState, false)).toBe(
      false
    );
  });
});
