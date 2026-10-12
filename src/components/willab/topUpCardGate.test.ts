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

  it("never mounts while the Lab owns the screen", () => {
    for (const state of LAB_OVERLAY_STATES) {
      expect(canMountTopUpCard(state, false), `${state} must be excluded`).toBe(
        false
      );
    }
  });
});
