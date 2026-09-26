"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchSessionState } from "@/services/api/chatSessionState";
import { prefetchChatBoot } from "@/services/api/bootPrefetch";
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

/* -------------------------------------------------------------------------- */
/*  THE TRANSITIONS (audit Q-C4, founder decision 2026-09-14, option a).       */
/*                                                                            */
/*  The Lab overlay and the Lounge used to name their target states inline    */
/*  (`goTo("lab_processing")`, fifteen sites in LabOverlay alone), so the     */
/*  machine's transitions lived in the components and nothing could list them. */
/*  Now the components dispatch EVENTS — what happened — and this table owns   */
/*  where each one goes. `from` is the set of states the code dispatches the   */
/*  event from; a dispatch from outside it still moves to `to` (exactly what   */
/*  the inline goTo did), and says so in development, so a new entry point is  */
/*  a visible table edit rather than a silent one.                             */
/* -------------------------------------------------------------------------- */

export type WillabEvent =
  /** Lounge: replace the deck before Take 1 → the setup form. */
  | "setup_requested"
  /** Lounge: the insights card was opened → back to idle. */
  | "insights_opened"
  /** Lab: no stored setup to restore → the setup form. */
  | "setup_needed"
  /** Lab: the mic gesture (first take, continued take, record again,
   *  re-read) → Recording Mode. */
  | "take_started"
  /** Lab: a file instead of the mic → processing. */
  | "upload_submitted"
  /** Lab: the mic stopped with a blob → processing. */
  | "recording_stopped"
  /** Lab: the upload was rejected (422) → back to the mic. */
  | "upload_rejected"
  /** Lab: the result is confirmed → the readout (Ideal Text). */
  | "processing_ready"
  /** Lab: hold, don't discard (§4) → parked. */
  | "park"
  /** Lab: the readout's sign-up → the unsigned send gate. */
  | "sign_up_to_send"
  /** Lab: the send gate sent the take → review pending. */
  | "sent";

const LOUNGE_LEVEL: readonly WillabState[] = [
  "lounge_idle",
  "parked",
  "review_pending",
  "insights_ready",
  "lounge_general",
];

export const TRANSITIONS: Readonly<
  Record<WillabEvent, { readonly to: WillabState; readonly from: readonly WillabState[] }>
> = {
  setup_requested: { to: "lab_session_context", from: LOUNGE_LEVEL },
  insights_opened: { to: "lounge_idle", from: ["insights_ready"] },
  setup_needed: { to: "lab_session_context", from: ["lab_feelings", "lab_prerecord"] },
  take_started: {
    to: "lab_recording",
    from: ["lab_feelings", "lab_prerecord", "lab_session_context", "lab_recording", "lab_processing", "readout"],
  },
  upload_submitted: { to: "lab_processing", from: ["lab_session_context", "lab_recording"] },
  recording_stopped: { to: "lab_processing", from: ["lab_recording"] },
  upload_rejected: { to: "lab_recording", from: ["lab_processing"] },
  processing_ready: { to: "readout", from: ["lab_processing"] },
  park: { to: "parked", from: ["readout", "sendgate_unsigned", "sendgate_signed"] },
  sign_up_to_send: { to: "sendgate_unsigned", from: ["readout"] },
  sent: { to: "review_pending", from: ["sendgate_unsigned", "sendgate_signed"] },
};

/** The at-home status the SERVER owns (seam 8): the newest Readout decides
 *  whether the student is waiting on the coach, has insights, or is idle.
 *  It is settled from server truth (useStatusHydration, the publish signal),
 *  never dispatched as an event — the server is the source, not a tap. */
export type HomeStatus = "review_pending" | "insights_ready" | "lounge_idle";

/** Pure: where `event` goes, and whether `state` is one it is expected from. */
export function transition(
  state: WillabState | null,
  event: WillabEvent,
): { to: WillabState; expected: boolean } {
  const row = TRANSITIONS[event];
  return { to: row.to, expected: state !== null && row.from.includes(state) };
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

/** Read the consent flag from OUTSIDE the flow (client-only; false on the
 *  server). The landing uses it as a "returning visitor" hint so people who
 *  have already been through Welcome are not shown the entrance animation
 *  again while auth resolves. */
export function hasAcceptedConsentLocally(): boolean {
  return readFlag(CONSENT_KEY);
}

export interface UseWillabFlowReturn {
  /** `null` while the initial state resolves post-mount (hydration-safe). */
  state: WillabState | null;
  labOverlayOpen: boolean;
  /** What happened; the table above decides where it goes. Components never
   *  name a target state. */
  dispatch: (event: WillabEvent) => void;
  /** Server truth for the at-home status (see HomeStatus). */
  settleHomeStatus: (status: HomeStatus) => void;
  acceptConsent: () => void;
  startRecording: () => void;
  /** Continue a known project. The one emotion check already happened before
   *  Take 1, so later takes do not repeat it. */
  startRecordingSetup: () => void;
  /** Enter the Lab for a brand-new project through the one pre-Take-1 check. */
  startNewTopicSetup: () => void;
  closeLab: () => void;
}

export function useWillabFlow(): UseWillabFlowReturn {
  // Resolve post-mount so SSR and first client render agree (both `null`).
  const [state, setState] = useState<WillabState | null>(null);
  useEffect(() => {
    const consent = readFlag(CONSENT_KEY);

    // Pre-session states are FE-local (consent gate + parked readout).
    if (!consent) { setState("welcome_consent"); return; }

    // Past Welcome, the Phase-1 gate and the Lounge thread load next; start
    // their reads now, alongside the session state, instead of in series.
    prefetchChatBoot();
    if (hasParkedReadout()) { setState("parked"); return; }

    // Post-intake active state is BE-owned (seam 8). Fetch once on mount;
    // immediate transitions (Lab send → review_pending) are dispatched.
    void fetchSessionState().then((v) => {
      if (v === "PENDING_COACH") setState("review_pending");
      else if (v === "REVIEW_LOOP") setState("insights_ready");
      else setState("lounge_idle"); // NO_SESSION or fetch failed
    });
  }, []);

  const dispatch = useCallback((event: WillabEvent) => {
    setState((prev) => {
      const next = transition(prev, event);
      if (!next.expected && process.env.NODE_ENV !== "production") {
        console.warn(`useWillabFlow: "${event}" dispatched from "${prev}" — add it to TRANSITIONS`);
      }
      return next.to;
    });
  }, []);
  const settleHomeStatus = useCallback(
    (status: HomeStatus) => setState(status),
    [],
  );
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
  /** Past the picker, a known project resumes its stored setup. */
  const startRecordingSetup = useCallback(() => {
    clearReviewPending();
    setState("lab_prerecord");
  }, []);
  /** A brand-new project gets the existing emotion check exactly once, before
   *  Take 1. Subsequent takes use startRecordingSetup above and skip it. */
  const startNewTopicSetup = useCallback(() => {
    clearReviewPending();
    setState("lab_feelings");
  }, []);
  // TODO(slice: Lab): a Readout/parked close should → "parked" (held chip),
  // a pre-recording close should → "lounge_idle". Shell uses idle for both.
  const closeLab = useCallback(() => setState("lounge_idle"), []);

  return {
    state,
    labOverlayOpen: state != null && isLabOverlay(state),
    dispatch,
    settleHomeStatus,
    acceptConsent,
    startRecording,
    startRecordingSetup,
    startNewTopicSetup,
    closeLab,
  };
}
