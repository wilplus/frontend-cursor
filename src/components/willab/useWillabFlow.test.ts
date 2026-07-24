import { describe, expect, it } from "vitest";
import { initialWillabState, isLabOverlay, type WillabState } from "./useWillabFlow";

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
  it("is true for the Lab + send-gate states (overlay over the Lounge)", () => {
    const labStates: WillabState[] = [
      "lab_feelings",
      "lab_session_context",
      "lab_prerecord",
      "lab_recording",
      "lab_processing",
      "readout",
      "sendgate_unsigned",
      "sendgate_signed",
    ];
    for (const s of labStates) expect(isLabOverlay(s)).toBe(true);
  });

  it("is false for the Lounge-level states", () => {
    const loungeStates: WillabState[] = [
      "welcome_consent",
      "lounge_idle",
      "parked",
      "review_pending",
      "insights_ready",
      "lounge_general",
    ];
    for (const s of loungeStates) expect(isLabOverlay(s)).toBe(false);
  });
});
