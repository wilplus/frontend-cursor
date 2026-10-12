import { describe, expect, it } from "vitest";
import {
  transition,
  type WillabState,
} from "./useWillabFlow";

/* -------------------------------------------------------------------------- */
/*  Audit Q-C4: the transitions live in the hook's table; the components      */
/*  dispatch events and never name a target state.                            */
/* -------------------------------------------------------------------------- */

describe("TRANSITIONS", () => {
  it("is the record → process → Ideal Text loop", () => {
    // The live loop as a walk through the table (LIVE LOOP fence).
    let state: WillabState = "lab_prerecord";
    for (const event of ["take_started", "recording_stopped", "processing_ready"] as const) {
      const next = transition(state, event);
      expect(next.expected, `${event} from ${state}`).toBe(true);
      state = next.to;
    }
    expect(state).toBe("readout");
    // From the readout: the next take, a hold, or the send gate — never a
    // rebuild of the document.
    expect(transition("readout", "take_started")).toEqual({ to: "lab_recording", expected: true });
    expect(transition("readout", "park")).toEqual({ to: "parked", expected: true });
    expect(transition("readout", "sign_up_to_send")).toEqual({ to: "sendgate_unsigned", expected: true });
    expect(transition("sendgate_unsigned", "sent")).toEqual({ to: "review_pending", expected: true });
  });
});

