import { describe, expect, it } from "vitest";
import { initialWillabState, isLabOverlay, type WillabState } from "./useWillabFlow";

describe("initialWillabState", () => {
  it("routes a brand-new visitor to welcome_consent", () => {
    expect(
      initialWillabState({ consentAccepted: false, intakeDone: false })
    ).toBe("welcome_consent");
  });

  it("routes a consented-but-not-intaked visitor to intake", () => {
    expect(
      initialWillabState({ consentAccepted: true, intakeDone: false })
    ).toBe("intake_in_progress");
  });

  it("routes a fully-onboarded user straight to the Lounge", () => {
    expect(
      initialWillabState({ consentAccepted: true, intakeDone: true })
    ).toBe("lounge_idle");
  });

  it("routes an onboarded user with a parked Readout to the parked state", () => {
    expect(
      initialWillabState({ consentAccepted: true, intakeDone: true, parked: true })
    ).toBe("parked");
  });
});

describe("isLabOverlay", () => {
  it("is true for the Lab + send-gate states (overlay over the Lounge)", () => {
    const labStates: WillabState[] = [
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
      "intake_in_progress",
      "lounge_idle",
      "parked",
      "review_pending",
      "insights_ready",
      "lounge_general",
    ];
    for (const s of loungeStates) expect(isLabOverlay(s)).toBe(false);
  });
});
