import { describe, expect, it } from "vitest";
import {
  TRANSITIONS,
  initialWillabState,
  isLabOverlay,
  transition,
  type WillabState,
} from "./useWillabFlow";

describe("initialWillabState", () => {
  it("routes a brand-new visitor to welcome_consent", () => {
    expect(initialWillabState({ consentAccepted: false })).toBe(
      "welcome_consent"
    );
  });

  it("routes a consented user to the Lounge (no parked readout)", () => {
    expect(initialWillabState({ consentAccepted: true })).toBe("lounge_idle");
  });

  it("routes a consented user with a parked Readout to the parked state", () => {
    expect(
      initialWillabState({ consentAccepted: true, parked: true })
    ).toBe("parked");
  });

  // Note: review_pending / insights_ready are now BE-owned (seam 8).
  // They are derived via fetchSessionState() in useWillabFlow, not initialWillabState.
});

describe("isLabOverlay", () => {
  it("is true for the Lab and the send gate (overlay over the Lounge), false for the Lounge", () => {
    expect(isLabOverlay("lab_recording")).toBe(true);
    expect(isLabOverlay("sendgate_unsigned")).toBe(true);
    expect(isLabOverlay("lounge_idle")).toBe(false);
    expect(isLabOverlay("parked")).toBe(false);
  });
});

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

  it("returns the mic to the speaker after a rejected upload, and the setup form when nothing can be restored", () => {
    expect(transition("lab_processing", "upload_rejected")).toEqual({ to: "lab_recording", expected: true });
    expect(transition("lab_feelings", "setup_needed")).toEqual({ to: "lab_session_context", expected: true });
  });

  it("keeps the Lab overlay open for an in-Lab event, and closes it for one that leaves", () => {
    expect(isLabOverlay(TRANSITIONS.recording_stopped.to)).toBe(true);
    expect(isLabOverlay(TRANSITIONS.park.to)).toBe(false);
  });

  it("still moves on an unexpected origin — the table documents, it does not refuse", () => {
    // A dispatch from outside the modelled set behaves exactly like the inline
    // goTo did (the target is the event's) and is flagged, not swallowed.
    expect(transition("lounge_idle", "recording_stopped")).toEqual({ to: "lab_processing", expected: false });
    expect(transition(null, "park")).toEqual({ to: "parked", expected: false });
  });
});

