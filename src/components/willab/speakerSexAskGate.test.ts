import { describe, expect, it } from "vitest";
import { canMountSpeakerSexAsk } from "./speakerSexAskGate";
import { isLabOverlay, type WillabState } from "./useWillabFlow";

/**
 * The Lounge mount for the speaker-sex ask.
 *
 * The card itself is already safe by construction — it is inline, dismissible,
 * and self-gated on `shouldAskSex`. What this pins is the one thing the mount
 * adds: it must never appear while the Lab owns the screen. A profile question
 * over a running record→transcribe→coach loop is precisely what the LIVE LOOP
 * fence forbids, and it is the reason this ask was originally kept off /chat
 * altogether.
 */

/** Every state in the union. Listed by hand ON PURPOSE: if someone adds a new
 *  Lab state, this array stops matching the type and the compiler says so —
 *  which is the moment to decide whether the ask may show there. An inferred
 *  list would silently accept the new state and the card could surface over a
 *  take. */
const ALL_STATES: WillabState[] = [
  "welcome_consent",
  "lounge_idle",
  "lab_project_pick",
  "lab_feelings",
  "lab_session_context",
  "lab_prerecord",
  "lab_recording",
  "lab_processing",
  "readout",
  "parked",
  "sendgate_unsigned",
  "sendgate_signed",
  "review_pending",
  "insights_ready",
  "lounge_general",
];

describe("canMountSpeakerSexAsk", () => {
  it("never mounts while the Lab overlay owns the screen", () => {
    const leaked = ALL_STATES.filter(
      (s) => isLabOverlay(s) && canMountSpeakerSexAsk(s, false)
    );
    expect(leaked).toEqual([]);
  });

  it("never mounts during a take, processing, or the readout", () => {
    // The three that matter most, named explicitly so the intent survives a
    // refactor of isLabOverlay.
    expect(canMountSpeakerSexAsk("lab_recording", false)).toBe(false);
    expect(canMountSpeakerSexAsk("lab_processing", false)).toBe(false);
    expect(canMountSpeakerSexAsk("readout", false)).toBe(false);
  });

  it("never mounts during pre-Lab setup", () => {
    // lab_project_pick is NOT a lab-overlay state, so isLabOverlay alone would
    // let the card through mid-setup.
    expect(isLabOverlay("lab_project_pick")).toBe(false);
    expect(canMountSpeakerSexAsk("lab_project_pick", false)).toBe(false);
  });

  it("mounts in the idle Lounge, which is the whole point", () => {
    expect(canMountSpeakerSexAsk("lounge_idle", false)).toBe(true);
    expect(canMountSpeakerSexAsk("lounge_general", false)).toBe(true);
  });

  it("waits for the thread rather than floating above a skeleton", () => {
    expect(canMountSpeakerSexAsk("lounge_idle", true)).toBe(false);
  });

  it("thread loading beats every otherwise-mountable state", () => {
    const leaked = ALL_STATES.filter((s) => canMountSpeakerSexAsk(s, true));
    expect(leaked).toEqual([]);
  });

  it("leaves the ask-or-not decision to shouldAskSex", () => {
    // This predicate is about the MOUNT, not the person. It must stay ignorant
    // of profile state — two places deciding whether to ask is how the four
    // states (never asked / declined / no column / snoozed) drift apart.
    expect(canMountSpeakerSexAsk.length).toBe(2);
  });
});
