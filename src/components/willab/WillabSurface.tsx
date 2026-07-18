"use client";

import { useCallback, useRef, useState } from "react";
import type { RecordingProgress } from "@/services/api/recordingProgress";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import LoadingState from "./LoadingState";
import { usePublishLiveSubscription } from "@/hooks/usePublishLiveSubscription";
import { isLabOverlay, useWillabFlow } from "./useWillabFlow";
import { useSignedIn } from "./useSignedIn";
import { useUserId } from "./useUserId";
import { useStatusHydration, reconcileWillabStatus } from "./useStatusHydration";
import { getReviewPending } from "./sendStatus";
import WelcomeConsent from "./WelcomeConsent";
import Intake from "./Intake";
import Lounge from "./Lounge";
import LabOverlay from "./LabOverlay";
import { LoungeThreadProvider } from "./LoungeThreadContext";

/* -------------------------------------------------------------------------- */
/*  WillabSurface — restructure SHELL root (feature-flagged)                   */
/*                                                                            */
/*  Renders the willab-beta structure: first-run screens (Welcome → Intake),  */
/*  then the always-mounted Lounge home with the Lab as an overlay layered     */
/*  over it. Welcome (§12), Intake (§2), Lounge (§3) and the Lab front-half     */
/*  (§4: session_context + record capture) are real; the Lab's processing /     */
/*  Readout / Send tail (§5/§13) is the BE-gated seam, walkable via stubs       */
/*  inside LabOverlay until the upload handler (BE ③) lands.                   */
/* -------------------------------------------------------------------------- */

export default function WillabSurface({
  sessionId,
  reviewSessionId,
  insightSessionId,
  bestPresentationArcId,
}: {
  sessionId: string | null;
  /** U12 — coach deep-link target from `/chat?review=<id>`; opens the in-Lounge
   *  CoachReviewOverlay on mount (coach-gated inside the Lounge). */
  reviewSessionId: string | null;
  /** D3 — user deep-link target from `/chat?insight=<id>`; opens the in-Lounge
   *  InsightsOverlay on mount. */
  insightSessionId: string | null;
  /** C — best-presentation deep-link target from `/chat?arc=<arc_id>`; opens the
   *  in-Lounge BestPresentationOverlay on mount. */
  bestPresentationArcId: string | null;
}) {
  const flow = useWillabFlow();
  const [recordingProgress, setRecordingProgress] =
    useState<RecordingProgress | null>(null);
  const signedIn = useSignedIn();
  const userId = useUserId();
  // Reconcile the at-home status (review_pending / insights) with server truth
  // once on load…
  useStatusHydration(signedIn, flow.state, flow.goTo);
  // …and live: while awaiting a coach, flip review_pending → insights_ready the
  // instant the coach publishes (realtime sub + 20s poll fallback), reusing the
  // same reconcile so the publish event is the single source of truth (no 2nd write).
  const { goTo } = flow;
  // FE-2 (bug 1a) — the publish signal must NEVER navigate the user out of the
  // Lab. When a signed-in take auto-delivers, mergeSession sets review_pending;
  // the very next publish tick (realtime or the 20s poll) then reconciled to
  // review_pending and yanked the user off their fresh ideal-text readout ~10s
  // after it landed. Read the live state through a ref so onPublish stays
  // stable (adding it to deps would tear down + resubscribe the channel on
  // every navigation), and defer the reconcile until they leave the Lab — the
  // sub keeps firing, so it still lands the moment they return to the Lounge.
  const stateRef = useRef(flow.state);
  stateRef.current = flow.state;
  const onPublish = useCallback(() => {
    if (getReviewPending() == null) return; // only relevant while awaiting a coach
    const st = stateRef.current;
    if (st !== null && isLabOverlay(st)) return; // never interrupt the readout
    void reconcileWillabStatus(goTo);
  }, [goTo]);
  usePublishLiveSubscription(userId, onPublish);

  // A2 — `flush` drops the TOP padding so the chat sits flush under the navbar
  // (no gap). Scoped to the home/Lounge call only; welcome + intake keep py-6.
  const shell = (children: React.ReactNode, flush = false) => (
    <main className="willab-chat flex h-full flex-col overflow-hidden bg-background">
      <div className="shrink-0">
        <DashboardHeader />
      </div>
      <div
        className={`mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-hidden px-4 pb-6 ${
          flush ? "pt-0" : "pt-6"
        }`}
      >
        {children}
      </div>
    </main>
  );

  // Resolving the initial state post-mount (hydration-safe).
  if (flow.state === null) {
    return shell(<LoadingState />);
  }

  // First-run, full-screen (no Lounge underneath yet).
  if (flow.state === "welcome_consent") {
    return shell(<WelcomeConsent onAccept={flow.acceptConsent} />);
  }
  if (flow.state === "intake_in_progress") {
    return shell(<Intake onDone={flow.finishIntake} />);
  }

  // Home: the always-mounted Lounge, with the Lab overlay layered when open.
  // Both share one thread (LoungeThreadProvider) so the Lab can persist a
  // recording's Readout into the same scrollable history.
  return shell(
    <LoungeThreadProvider>
      <Lounge
        state={flow.state}
        onStart={flow.startRecording}
        goTo={flow.goTo}
        initialReviewSessionId={reviewSessionId}
        initialBestPresentationArcId={bestPresentationArcId}
        recordingProgress={recordingProgress}
      />
      {flow.labOverlayOpen && (
        <LabOverlay
          state={flow.state}
          sessionId={sessionId}
          goTo={flow.goTo}
          onClose={flow.closeLab}
          onRecordingProgress={setRecordingProgress}
        />
      )}
    </LoungeThreadProvider>,
    true // A2 — home/Lounge: flush the chat to the navbar (no top gap)
  );
}
