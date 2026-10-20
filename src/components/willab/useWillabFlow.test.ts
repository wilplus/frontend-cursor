/*
STORY    As a speaker, I want the app always to go record, then process, then
         Ideal Text, then the next Take, so that the loop never breaks.
OUTCOME
  O1  Starting, stopping and finishing processing lead to the readout;
      from there the next Take, a pause, or "sign up to send" (and on to
      review) are expected steps.
PROVES   O1 -> "is the record → process → Ideal Text loop"
WHY      Never 3; audit Q-C4.
*/
import { describe, expect, it } from "vitest";
import {
  transition,
  type WillabState,
} from "./useWillabFlow";

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

