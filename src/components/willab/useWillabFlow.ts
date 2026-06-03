"use client";

import { useCallback, useEffect, useState } from "react";

/* -------------------------------------------------------------------------- */
/*  useWillabFlow — the willab-beta state machine (§8)                         */
/*                                                                            */
/*  This is the restructure SHELL's flow controller: it owns the §8 state     */
/*  set and the transitions between them, and tells the surface which screen   */
/*  to render and whether the Lab overlay is open over the always-mounted     */
/*  Lounge. It is intentionally separate from the legacy `useChatPhase` — the  */
/*  legacy funnel keeps running on its own machine behind the feature flag;    */
/*  the full Lounge-as-home restructure (the last slice) decides whether the   */
/*  two ever merge.                                                            */
/*                                                                            */
/*  Surfaces are stubbed for now; later slices replace each stub with the     */
/*  real Welcome / Intake / Lab / Readout / Insights surface.                 */
/* -------------------------------------------------------------------------- */

export type WillabState =
  | "welcome_consent"
  | "intake_in_progress"
  | "lounge_idle"
  | "lab_session_context"
  | "lab_prerecord"
  | "lab_recording"
  | "lab_processing"
  | "readout"
  | "parked"
  | "sendgate_unsigned"
  | "sendgate_signed"
  | "review_pending"
  | "insights_ready"
  | "lounge_general";

/** States that render *inside* the Lab overlay (over the mounted Lounge). */
const LAB_OVERLAY_STATES: ReadonlySet<WillabState> = new Set<WillabState>([
  "lab_session_context",
  "lab_prerecord",
  "lab_recording",
  "lab_processing",
  "readout",
  "sendgate_unsigned",
  "sendgate_signed",
]);

export function isLabOverlay(state: WillabState): boolean {
  return LAB_OVERLAY_STATES.has(state);
}

/** Pure initial-state derivation (testable; the hook feeds it localStorage). */
export function initialWillabState(flags: {
  consentAccepted: boolean;
  intakeDone: boolean;
}): WillabState {
  if (!flags.consentAccepted) return "welcome_consent";
  if (!flags.intakeDone) return "intake_in_progress";
  return "lounge_idle";
}

/* First-run flags. These are localStorage stubs in the shell; the real
 * Welcome (§12) writes the consent flag and the real Intake (§2) writes the
 * profile, which later supersedes `intake_done`. */
const CONSENT_KEY = "willab.consent_accepted";
const INTAKE_KEY = "willab.intake_done";

function readFlag(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}
function writeFlag(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    /* ignore */
  }
}

export interface UseWillabFlowReturn {
  /** `null` while the initial state resolves post-mount (hydration-safe). */
  state: WillabState | null;
  labOverlayOpen: boolean;
  goTo: (s: WillabState) => void;
  acceptConsent: () => void;
  finishIntake: () => void;
  startRecording: () => void;
  closeLab: () => void;
}

export function useWillabFlow(): UseWillabFlowReturn {
  // Resolve post-mount so SSR and first client render agree (both `null`).
  const [state, setState] = useState<WillabState | null>(null);
  useEffect(() => {
    setState(
      initialWillabState({
        consentAccepted: readFlag(CONSENT_KEY),
        intakeDone: readFlag(INTAKE_KEY),
      })
    );
  }, []);

  const goTo = useCallback((s: WillabState) => setState(s), []);
  const acceptConsent = useCallback(() => {
    writeFlag(CONSENT_KEY);
    setState("intake_in_progress");
  }, []);
  const finishIntake = useCallback(() => {
    writeFlag(INTAKE_KEY);
    setState("lounge_idle");
  }, []);
  const startRecording = useCallback(() => setState("lab_session_context"), []);
  // TODO(slice: Lab): a Readout/parked close should → "parked" (held chip),
  // a pre-recording close should → "lounge_idle". Shell uses idle for both.
  const closeLab = useCallback(() => setState("lounge_idle"), []);

  return {
    state,
    labOverlayOpen: state != null && isLabOverlay(state),
    goTo,
    acceptConsent,
    finishIntake,
    startRecording,
    closeLab,
  };
}
