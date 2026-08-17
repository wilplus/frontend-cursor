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
import Lounge from "./Lounge";
import LabOverlay from "./LabOverlay";
import ProjectPicker from "./ProjectPicker";
import IdealTextOverlay from "./IdealTextOverlay";
import { useDocumentSettle } from "./useDocumentSettle";
import {
  clearExploreArc,
  readExploreArc,
  writeExploreArc,
} from "@/lib/willab/exploreArc";
import { LoungeThreadProvider } from "./LoungeThreadContext";

/* -------------------------------------------------------------------------- */
/*  WillabSurface — restructure SHELL root (feature-flagged)                   */
/*                                                                            */
/*  Renders the willab-beta structure: the first-run Welcome consent screen,   */
/*  then the always-mounted Lounge home with the Lab as an overlay layered     */
/*  over it. Welcome (§12), Lounge (§3) and the Lab front-half                  */
/*  (§4: session_context + record capture) are real; the Lab's processing /     */
/*  Readout / Send tail (§5/§13) is the BE-gated seam, walkable via stubs       */
/*  inside LabOverlay until the upload handler (BE ③) lands.                   */
/* -------------------------------------------------------------------------- */

export default function WillabSurface({
  sessionId,
  reviewSessionId,
  insightSessionId,
  bestPresentationArcId,
  idealTextArcId = null,
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
  /** `/chat?idealArc=<id>` — the coach-feedback email CTA. */
  idealTextArcId?: string | null;
}) {
  const flow = useWillabFlow();
  const [recordingProgress, setRecordingProgress] =
    useState<RecordingProgress | null>(null);
  // Founder 2026-07-27 — picking an EXISTING project from the picker opens
  // that project, which is its ideal text. Only "Start a new topic" goes into
  // the recording onboarding.
  const [pickedArcId, setPickedArcId] = useState<string | null>(null);
  // SPEC-lockin-loop §1 — the picker-mounted overlay's pending truth. Only
  // probing while that overlay is actually open; the Lounge and the Lab run
  // their own instances when they own the screen.
  const pickerSettle = useDocumentSettle({ enabled: pickedArcId !== null });
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
  // (no gap). Scoped to the home/Lounge call only; welcome keeps py-6.
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

  // Home: the always-mounted Lounge, with the Lab overlay layered when open.
  // Both share one thread (LoungeThreadProvider) so the Lab can persist a
  // recording's Readout into the same scrollable history.
  return shell(
    <LoungeThreadProvider>
      <Lounge
        state={flow.state}
        onStart={flow.startRecording}
        onStartInProject={flow.startRecordingSetup}
        goTo={flow.goTo}
        initialReviewSessionId={reviewSessionId}
        initialBestPresentationArcId={bestPresentationArcId}
        initialIdealTextArcId={idealTextArcId}
        recordingProgress={recordingProgress}
      />
      {/* Context-aware setup — WHICH project, asked before the Lab opens.
          Picking a title seeds the arc so the setup form prefills from it and
          the take continues that project's master document; "new topic"
          clears the seed so the blank flow is genuinely blank. */}
      {flow.state === "lab_project_pick" && (
        <ProjectPicker
          onNewTopic={() => {
            clearExploreArc(userId);
            // Founder 2026-07-27 — a new topic goes STRAIGHT to the setup
            // form. The feelings check-in stays on every continuation.
            flow.startNewTopicSetup();
          }}
          onContinue={(arc) => {
            // An EXISTING project opens the project itself — its ideal text —
            // rather than dropping the user straight into another take. The
            // arc is still seeded, so "Read it aloud" from inside the ideal
            // text continues THIS project with its full setup restored.
            //
            // Seeding rules are unchanged. Already on this project
            // (mid-sitting): the cached entry owns the real take index AND the
            // deck, so never overwrite it with a thinner seed.
            const cached = readExploreArc(userId);
            if (cached?.arcId !== arc.arcId) {
              // The LATEST take is what the setup restore reads: LabOverlay
              // re-fetches that session and adopts its full setup (audience,
              // target length, slides, the served PDF). Without a sessionId
              // the restore never fires and the student would have to
              // re-upload their deck.
              const latest = [...(arc.takes ?? [])].sort(
                (a, b) => (a.takeIndex ?? 0) - (b.takeIndex ?? 0)
              ).pop();
              writeExploreArc(
                userId,
                arc.arcId,
                // Prefer the real last index; takeCount is the fallback.
                (latest?.takeIndex ?? arc.takeCount ?? 0) + 1,
                // NO deck literal (review R-pp1): LabOverlay seeds preloadDeck
                // from initArc.deck and its restore effect bails when that is
                // truthy — a thin {topic, slides: []} seed would BLOCK the
                // very restore the sessionId exists to trigger, leaving the
                // student with no slides and a stopwatch instead of their
                // countdown. Undefined lets the restore adopt the FULL server
                // setup, which is what the sibling seed sites rely on.
                undefined,
                latest?.sessionId
              );
            }
            setPickedArcId(arc.arcId);
            flow.closeLab(); // dismiss the picker; the ideal text takes over
          }}
          // Nothing to choose (no projects, or the list is unreachable) →
          // skip the question entirely rather than leave "Start a new topic"
          // as the only answer, which would WIPE a seeded arc (review R-pp7).
          // Deliberately NOT onNewTopic: this must not clear the seed.
          onSkip={flow.startRecordingSetup}
          onClose={flow.closeLab}
        />
      )}
      {/* The picked project's ideal text. Mounted here rather than in the
          Lounge because the picker that opens it lives here too. */}
      {pickedArcId && (
        <IdealTextOverlay
          arcId={pickedArcId}
          // SPEC-lockin-loop §1 (handoff §6.4 S6) — this mount used to fetch
          // with the pending gate hard-false regardless of the marker, so a
          // take mid-analysis rendered the OLD document as current from this
          // one route. Same blocking truth as every other mount now.
          analysisPending={pickerSettle.pending}
          onClose={() => setPickedArcId(null)}
          // "Read it aloud" — the re-read is just the next take of THIS
          // project. The arc was seeded when it was picked, so the Lab restores
          // its full setup.
          onReadAloud={() => {
            setPickedArcId(null);
            flow.startRecordingSetup();
          }}
        />
      )}
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
