/*
STORY    As a speaker, I want the app always to go record, then process, then
         my chat, where the Ideal Text and the feedback are, then the next
         Take, so that the loop never breaks.
OUTCOME
  O1  Starting and stopping a Take lead to processing; a rejected upload
      goes back to the mic; the next Take can start from processing. The
      finished Take leaves the recording screens for its chat (LabOverlay,
      backend N691): there is no readout state.
PROVES   O1 -> "is the record → process loop, with no readout"
WHY      Never 3; audit Q-C4; backend N691.
*/
import { describe, expect, it } from "vitest";
import { TRANSITIONS, transition, type WillabState } from "./useWillabFlow";

describe("TRANSITIONS", () => {
  it("is the record → process loop, with no readout", () => {
    let state: WillabState = "lab_prerecord";
    for (const event of ["take_started", "recording_stopped"] as const) {
      const next = transition(state, event);
      expect(next.expected, `${event} from ${state}`).toBe(true);
      state = next.to;
    }
    expect(state).toBe("lab_processing");
    expect(transition("lab_processing", "upload_rejected")).toEqual({ to: "lab_recording", expected: true });
    expect(transition("lab_processing", "take_started")).toEqual({ to: "lab_recording", expected: true });
    const targets = Object.values(TRANSITIONS).map((row) => row.to as string);
    expect(targets).not.toContain("readout");
  });
});
