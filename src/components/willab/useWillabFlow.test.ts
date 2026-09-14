import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  TRANSITIONS,
  initialWillabState,
  isLabOverlay,
  transition,
  type WillabEvent,
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

/* -------------------------------------------------------------------------- */
/*  Audit Q-C4: the transitions live in the hook's table; the components      */
/*  dispatch events and never name a target state.                            */
/* -------------------------------------------------------------------------- */

const ALL_STATES: WillabState[] = [
  "welcome_consent", "lounge_idle", "lab_project_pick", "lab_feelings",
  "lab_session_context", "lab_prerecord", "lab_recording", "lab_processing",
  "readout", "parked", "sendgate_unsigned", "sendgate_signed",
  "review_pending", "insights_ready", "lounge_general",
];

describe("TRANSITIONS", () => {
  it("names a real target and at least one expected origin for every event", () => {
    for (const [event, row] of Object.entries(TRANSITIONS)) {
      expect(ALL_STATES, event).toContain(row.to);
      expect(row.from.length, event).toBeGreaterThan(0);
      for (const from of row.from) expect(ALL_STATES, `${event} from`).toContain(from);
    }
  });

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
    expect(transition("lab_prerecord", "setup_needed")).toEqual({ to: "lab_session_context", expected: true });
    expect(transition("lab_session_context", "upload_submitted")).toEqual({ to: "lab_processing", expected: true });
    expect(transition("lab_recording", "upload_submitted")).toEqual({ to: "lab_processing", expected: true });
  });

  it("keeps the Lab overlay open for every in-Lab event except the ones that leave it", () => {
    const leaves: WillabEvent[] = ["park", "sent", "insights_opened"];
    for (const [event, row] of Object.entries(TRANSITIONS) as [WillabEvent, (typeof TRANSITIONS)[WillabEvent]][]) {
      if (leaves.includes(event)) expect(isLabOverlay(row.to), event).toBe(false);
      else expect(isLabOverlay(row.to), event).toBe(true);
    }
  });

  it("still moves on an unexpected origin — the table documents, it does not refuse", () => {
    // A dispatch from outside the modelled set behaves exactly like the inline
    // goTo did (the target is the event's) and is flagged, not swallowed.
    expect(transition("lounge_idle", "recording_stopped")).toEqual({ to: "lab_processing", expected: false });
    expect(transition(null, "park")).toEqual({ to: "parked", expected: false });
  });

  it("the Lounge-level events come from the Lounge, the Lab events from the Lab", () => {
    for (const from of TRANSITIONS.setup_requested.from) expect(isLabOverlay(from)).toBe(false);
    for (const event of ["recording_stopped", "processing_ready", "upload_rejected", "park", "sent", "sign_up_to_send"] as const) {
      for (const from of TRANSITIONS[event].from) expect(isLabOverlay(from), `${event} from ${from}`).toBe(true);
    }
  });
});

describe("the components dispatch events and never name a target state", () => {
  it.each([
    "src/components/willab/LabOverlay.tsx",
    "src/components/willab/Lounge.tsx",
    "src/components/willab/WillabSurface.tsx",
  ])("%s has no goTo(", (file) => {
    const src = readFileSync(file, "utf8");
    expect(src).not.toMatch(/\bgoTo\(/);
    expect(src).not.toMatch(/setState\("(lab|readout|parked|sendgate|review|insights|lounge)/);
  });

  it("the hook exposes dispatch and the server-owned home status, not a target setter", () => {
    const src = readFileSync("src/components/willab/useWillabFlow.ts", "utf8");
    expect(src).toMatch(/dispatch: \(event: WillabEvent\) => void;/);
    expect(src).toMatch(/settleHomeStatus: \(status: HomeStatus\) => void;/);
    expect(src).not.toMatch(/goTo: \(s: WillabState\) => void;/);
  });
});
