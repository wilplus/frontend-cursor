"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchSessionState } from "@/services/api/chatSessionState";
import { hasParkedReadout } from "./willabParked";
import { clearReviewPending } from "./sendStatus";

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
/*  real Welcome / Lab / Readout / Insights surface.                          */
/* -------------------------------------------------------------------------- */

export type WillabState =
  | "welcome_consent"
  | "lounge_idle"
  /** Context-aware setup (founder 2026-07-22) — recording from the dashboard
   *  asks first whether this is a new topic or another take of an existing
   *  project. Not a Lab-overlay state: it precedes the Lab entirely. */
  | "lab_project_pick"
  | "lab_feelings"
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
  "lab_feelings",
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

/** Pure local-state derivation for the consent + parked gates (testable).
 *  Post-consent active state (review_pending / insights_ready) is BE-owned —
 *  see useWillabFlow where fetchSessionState() is called for those. */
export function initialWillabState(flags: {
  consentAccepted: boolean;
  parked?: boolean;
}): WillabState {
  if (!flags.consentAccepted) return "welcome_consent";
  if (flags.parked) return "parked";
  return "lounge_idle";
}

/* First-run flag. The real Welcome (§12) writes the consent flag; onboarding
 * past consent is now the recording setup itself, so there is no separate
 * intake gate. */
const CONSENT_KEY = "willab.consent_accepted";

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

/** Accept consent from OUTSIDE the flow. The public landing shows the same
 *  WelcomeConsent composition, so when its CTA is used the Lounge must not ask
 *  again on arrival — it writes the same flag this hook reads on mount. */
export function acceptConsentLocally(): void {
  writeFlag(CONSENT_KEY);
}

export interface UseWillabFlowReturn {
  /** `null` while the initial state resolves post-mount (hydration-safe). */
  state: WillabState | null;
  labOverlayOpen: boolean;
  goTo: (s: WillabState) => void;
  acceptConsent: () => void;
  startRecording: () => void;
  /** Enter the Lab past the project picker (a title was chosen, or the user
   *  chose a new topic). */
  startRecordingSetup: () => void;
  closeLab: () => void;
}

export function useWillabFlow(): UseWillabFlowReturn {
  // Resolve post-mount so SSR and first client render agree (both `null`).
  const [state, setState] = useState<WillabState | null>(null);
  useEffect(() => {
    const consent = readFlag(CONSENT_KEY);

    // Pre-session states are FE-local (consent gate + parked readout).
    if (!consent) { setState("welcome_consent"); return; }
    if (hasParkedReadout()) { setState("parked"); return; }

    // Post-intake active state is BE-owned (seam 8). Fetch once on mount;
    // immediate transitions (Lab send → review_pending) still use goTo().
    void fetchSessionState().then((v) => {
      if (v === "PENDING_COACH") setState("review_pending");
      else if (v === "REVIEW_LOOP") setState("insights_ready");
      else setState("lounge_idle"); // NO_SESSION or fetch failed
    });
  }, []);

  const goTo = useCallback((s: WillabState) => setState(s), []);
  const acceptConsent = useCallback(() => {
    writeFlag(CONSENT_KEY);
    // Onboarding past consent is the recording setup itself now; a freshly
    // consented (brand-new) user has no session, so land on the Lounge.
    setState("lounge_idle");
  }, []);
  const startRecording = useCallback(() => {
    clearReviewPending();
    // Context-aware setup — the dashboard asks WHICH project first. Picking a
    // title (or starting a new topic) hands off to the feelings check-in.
    setState("lab_project_pick");
  }, []);
  /** Past the picker: C7 — every official recording opens the feelings
   *  check-in before the setup form (not just the first); the user names how
   *  they feel fresh each time and it is stamped on that take. */
  const startRecordingSetup = useCallback(() => {
    clearReviewPending();
    setState("lab_feelings");
  }, []);
  // TODO(slice: Lab): a Readout/parked close should → "parked" (held chip),
  // a pre-recording close should → "lounge_idle". Shell uses idle for both.
  const closeLab = useCallback(() => setState("lounge_idle"), []);

  return {
    state,
    labOverlayOpen: state != null && isLabOverlay(state),
    goTo,
    acceptConsent,
    startRecording,
    startRecordingSetup,
    closeLab,
  };
}
