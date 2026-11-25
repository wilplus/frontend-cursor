"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { RecordingProgress } from "@/services/api/recordingProgress";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DumpPullBar from "./DumpPullBar";
import LoadingState from "./LoadingState";
import { usePublishLiveSubscription } from "@/hooks/usePublishLiveSubscription";
import { isLabOverlay, useWillabFlow, type WillabState } from "./useWillabFlow";
import { countFirstVisit, type FirstVisitStep } from "@/lib/funnel/firstVisit";
import { useSignedIn } from "./useSignedIn";
import { usePendingSendHold } from "./usePendingSendHold";
import { useUserId } from "./useUserId";
import { useUserEmail } from "./useUserEmail";
import { MLC2_FOUNDER_CANARY_EMAIL } from "@/services/api/mlc2Consent";
import { useStatusHydration, reconcileWillabStatus } from "./useStatusHydration";
import { getReviewPending } from "./sendStatus";
import WelcomeConsent from "./WelcomeConsent";
import Mlc2FounderConsentGate from "./Mlc2FounderConsentGate";
import Phase1AcceptanceGate from "./Phase1AcceptanceGate";
import Lounge, { type LoungeDrafts } from "./Lounge";
import { LabFadeOut } from "./labFade";
import { useDocumentSettle } from "./useDocumentSettle";
import {
  clearExploreArc,
  readExploreArc,
  writeExploreArc,
} from "@/lib/willab/exploreArc";
import { readProcessingTake, writeProcessingTake } from "@/lib/willab/processingTake";
import { retryTakeSends } from "@/lib/willab/nextTakeShare";
import {
  coachLinkLogin,
  markCoachLinkSent,
  readCoachLinkSent,
} from "@/lib/willab/coachLink";
import { LoungeThreadProvider } from "./LoungeThreadContext";
import { useChatsDoor } from "./chats/useChatsDoor";
import ChatWorkspace from "./chats/ChatWorkspace";
import type { MemberChatContent } from "./chats/ChatThread";
import type { ReviewExit, TakeReviewTarget } from "./TakeReview";
import { takeInProject, type TakeInProject } from "@/lib/willab/takeInProject";
import { endAnswer, startAnswer, type AnswerFor } from "@/lib/willab/chatAnswer";
import { isNativeApp } from "@/lib/auth/nativeSignIn";
import { afterChatBoot } from "@/lib/chatBoot";
import {
  beginSetupDraft,
  beginSetupDraftWithTopic,
  clearActiveSetupDraft,
  resumeSetupDraft,
} from "@/lib/willab/setupDraft";
import { startFirstTake, startRealTalk } from "@/lib/willab/firstTake";
import ProjectChat from "./ProjectChat";
import { fetchTrainings, type TrainingArc } from "@/services/api/trainings";
import { refreshProjectTrainings } from "@/lib/willab/projectTrainings";
import { PendingProjectChat, PendingProjectWait } from "./ProjectRecordingBubbles";
import { useProjectTakeHandoff, type PendingProjectTake } from "./usePendingProjectTakes";

/** A project recording has not begun in these screens. Closing one cancels
 *  the pending bridge back to ProjectChat instead of inventing processing. */
export function cancelsPendingProjectRecording(state: WillabState | null): boolean {
  return (
    state === "lab_feelings" ||
    state === "lab_session_context" ||
    state === "lab_prerecord"
  );
}

// The recording screens are not on first paint: they load after it (warmed
// below), so a tap on Record finds them ready.
const LabOverlay = dynamic(() => import("./LabOverlay"), { ssr: false });
const ProjectPicker = dynamic(() => import("./ProjectPicker"), { ssr: false });

function holdActiveChatCapture(): boolean {
  const capture = document.querySelector("[data-chat-main] [data-chat-capture]");
  if (!capture) return false;
  capture.querySelector<HTMLButtonElement>("[data-chat-mic]")?.focus();
  return true;
}

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

/** A new opening on a Take mounts the project chat afresh on it. */
function projectChatKey(arcId: string, review: { key: number } | null): string {
  return `${arcId}:${review?.key ?? 0}`;
}

export default function WillabSurface({
  linkTake = null,
  coachLink = false,
}: {
  /** `/chat?take=<session_id>` (backend N691 item 3): the Take the link
   *  names; the chat opens on its coach bubble. */
  linkTake?: string | null;
  /** The link asks for the coach's bubble: the Take's, else the newest. */
  coachLink?: boolean;
}) {
  const flow = useWillabFlow();
  // The iPhone app has no welcome (founder 2026-11-02): it opens on the chats.
  // The welcome records no consent (Phase1AcceptanceGate does), so nothing is
  // skipped but the screen. `state` is null until after mount, so the native
  // check never runs on the server.
  const skipWelcome = flow.state === "welcome_consent" && isNativeApp();
  const { acceptConsent } = flow;
  useEffect(() => {
    if (skipWelcome) acceptConsent();
  }, [skipWelcome, acceptConsent]);
  const [recordingProgress, setRecordingProgress] =
    useState<RecordingProgress | null>(null);
  // Founder 2026-07-27 — picking an EXISTING project from the picker opens
  // that project, which is its ideal text. Only "Start a new project" (or
  // resuming its draft) goes into the recording onboarding.
  const [pickedProject, setPickedProject] = useState<TrainingArc | null>(null);
  /** The Take the project chat opens on, with its Ideal Text or its feedback
   *  (backend N691 item 2): the one place a Take's text is read. */
  const [projectReview, setProjectReview] = useState<{ target: TakeReviewTarget; key: number } | null>(null);
  const projectExit = useRef<ReviewExit | null>(null);
  const projectDrafts = useRef(new Map<string, string>());
  const loungeDrafts = useRef<LoungeDrafts>(new Map());
  // The recorder hands the accepted Take back to its owning conversation.
  const [returnProject, setReturnProject] = useState<TrainingArc | null>(null);
  const [handoffTake, setHandoffTake] = useState<string | null>(null);
  const projectOpenSequence = useRef(0);
  const pendingProjectHandoff = useRef<string | null>(null);
  const [recordingInProgress, setRecordingInProgress] = useState(false);
  const labWasOpenRef = useRef(false);
  useEffect(() => {
    if (flow.labOverlayOpen) {
      labWasOpenRef.current = true;
      return;
    }
    if (!labWasOpenRef.current) return;
    labWasOpenRef.current = false;
    if (!returnProject) return;
    setPickedProject(returnProject);
    setReturnProject(null);
  }, [flow.labOverlayOpen, returnProject]);
  // The Take whose wait the Lab just handed to the Lounge, until the Lounge
  // shows it (founder 2026-10-21: "make it stay"; useWaitScreen).
  const [waitHandedOver, setWaitHandedOver] = useState<string | null>(null);
  // SPEC-lockin-loop §1 — the picker-mounted overlay's pending truth. Only
  // probing while that overlay is actually open; the Lounge and the Lab run
  // their own instances when they own the screen.
  const pickerSettle = useDocumentSettle({ enabled: pickedProject !== null });
  const signedIn = useSignedIn();
  // A Take sent to people before it was recorded whose send has not gone yet
  // is tried again at this open, signed in, once the thread has painted
  // (backend N541; nextTakeShare.ts retryTakeSends).
  useEffect(() => (signedIn ? afterChatBoot(retryTakeSends) : undefined), [signedIn]);
  // A guest's Take is being handed into the account they just made: the walk
  // opens when that is done, so the chat is not drawn first (founder
  // 2026-10-18, usePendingSendHold).
  const handingOverTake = usePendingSendHold(signedIn);
  // The coach's WhatsApp or email link opened signed out goes to log in and
  // back to itself (founder 2026-10-21, WIL-93; coachLink.ts), before the
  // Welcome or the guest's screens are drawn.
  const router = useRouter();
  const [linkLogin, setLinkLogin] = useState<string | null>(null);
  useEffect(() => {
    if (signedIn) markCoachLinkSent(null);
    const path = `${window.location.pathname}${window.location.search}`;
    const href = coachLinkLogin({ coach: coachLink, signedIn, path, sentBefore: readCoachLinkSent() });
    if (!href) return;
    markCoachLinkSent(path);
    setLinkLogin(href);
    router.replace(href);
  }, [coachLink, signedIn, router]);
  const linkWaits = linkLogin !== null || (coachLink && signedIn === null);
  // Warmed after the thread paints (founder 2026-10-16), not beside it: the
  // recording screens' chunks are not what a /chat open waits for.
  useEffect(
    () =>
      afterChatBoot(() => {
        void import("./LabOverlay");
        void import("./ProjectPicker");
      }),
    [],
  );
  const userId = useUserId();
  const projectTake = useProjectTakeHandoff(userId, pickedProject, returnProject, (project, sessionId) => {
    setPickedProject(project);
    setHandoffTake(sessionId);
  });
  const { clear: clearPendingTake, closeWait } = projectTake;
  const openProject = useCallback((arcId: string | null, sessionId: string | null = null) => {
    const sequence = ++projectOpenSequence.current;
    if (!arcId) {
      flow.startRecording();
      return;
    }
    const readProjects = sessionId ? fetchTrainings({ force: true }) : refreshProjectTrainings();
    void readProjects.then((projects) => {
      if (sequence !== projectOpenSequence.current) return;
      const project = projects?.find((candidate) => candidate.arcId === arcId);
      if (!project) {
        if (!sessionId) flow.startRecording();
        return;
      }
      pendingProjectHandoff.current = null;
      clearPendingTake();
      setProjectReview(null);
      setPickedProject(project);
      setHandoffTake(sessionId);
      flow.closeLab();
    });
  }, [clearPendingTake, flow]);
  /** A Take's Ideal Text, or its feedback, opens in its project chat (backend
   *  N691 item 2): never as a screen of its own. The Take is the one named,
   *  else the one at `takeIndex`, else the project's newest. */
  const openTakeInProject = useCallback((arcId: string, pick: TakeInProject) => {
    const sequence = ++projectOpenSequence.current;
    void fetchTrainings({ force: true }).then((projects) => {
      if (sequence !== projectOpenSequence.current) return;
      const project = projects?.find((candidate) => candidate.arcId === arcId);
      if (!project) return;
      const take = takeInProject(project, pick);
      pendingProjectHandoff.current = null;
      clearPendingTake();
      setHandoffTake(null);
      setProjectReview(take ? { target: { take, focus: { step: pick.step } }, key: Date.now() } : null);
      setPickedProject(project);
      flow.closeLab();
    });
  }, [clearPendingTake, flow]);
  const userEmail = useUserEmail();
  const founderConsentEligible =
    signedIn === null || userEmail === undefined
      ? null
      : signedIn === true && userEmail === MLC2_FOUNDER_CANARY_EMAIL;
  // Reconcile the at-home status (review_pending / insights) with server truth
  // once on load…
  useStatusHydration(signedIn, userId, flow.state, flow.settleHomeStatus);
  // …and live: while awaiting a coach, flip review_pending → insights_ready the
  // instant the coach publishes (realtime sub + 20s poll fallback), reusing the
  // same reconcile so the publish event is the single source of truth (no 2nd write).
  const { settleHomeStatus } = flow;
  // FE-2 (bug 1a) — the publish signal must NEVER navigate the user out of the
  // Lab. When a signed-in take auto-delivers, the exact Project Take send sets review_pending;
  // the very next publish tick (realtime or the 20s poll) then reconciled to
  // review_pending and yanked the user off their fresh ideal-text readout ~10s
  // after it landed. Read the live state through a ref so onPublish stays
  // stable (adding it to deps would tear down + resubscribe the channel on
  // every navigation), and defer the reconcile until they leave the Lab — the
  // sub keeps firing, so it still lands the moment they return to the Lounge.
  const stateRef = useRef(flow.state);
  stateRef.current = flow.state;
  const publishRefreshRef = useRef<string | null>(null);
  const onPublish = useCallback(() => {
    const pendingSessionId = getReviewPending();
    if (pendingSessionId == null || !userId) return; // only relevant while awaiting a coach
    const st = stateRef.current;
    if (st !== null && isLabOverlay(st)) return; // never interrupt the readout
    const refreshKey = `${userId}:${pendingSessionId}`;
    if (publishRefreshRef.current === refreshKey) return;
    publishRefreshRef.current = refreshKey;
    afterChatBoot(() => {
      const current = stateRef.current;
      if (current !== null && isLabOverlay(current)) {
        publishRefreshRef.current = null;
        return;
      }
      void reconcileWillabStatus(userId, settleHomeStatus, { refresh: true }).then((ok) => {
        if (ok) void refreshProjectTrainings();
        if (!ok && publishRefreshRef.current === refreshKey) {
          // A transient failure may retry on the next publish signal. A
          // successful check is intentionally not repeated for duplicate
          // realtime events in the same pending state.
          publishRefreshRef.current = null;
        }
      });
    });
  }, [settleHomeStatus, userId]);
  usePublishLiveSubscription(userId, onPublish);
  useFirstVisitSteps(flow.state, signedIn);
  // "Record an answer" in a chat (backend N363): the question's own project,
  // then the recording screens at once, no feelings check.
  const startAnswerSetup = flow.startAnswerSetup;
  const recordAnswer = useCallback(
    (answer: AnswerFor) => void startAnswer(answer, userId, startAnswerSetup),
    [userId, startAnswerSetup],
  );
  const openProjectChat = (arc: TrainingArc) => {
    projectOpenSequence.current++;
    pendingProjectHandoff.current = null;
    clearActiveSetupDraft(userId);
    const cached = readExploreArc(userId);
    if (cached?.arcId !== arc.arcId) {
      const latest = [...arc.takes].sort((a, b) => a.takeIndex - b.takeIndex).pop();
      writeExploreArc(userId, arc.arcId, (latest?.takeIndex ?? arc.takeCount) + 1, undefined, latest?.sessionId);
    }
    setHandoffTake(null);
    setRecordingInProgress(false);
    clearPendingTake();
    setPickedProject(arc);
  };
  function openPendingProject(take: PendingProjectTake) {
    projectOpenSequence.current++;
    pendingProjectHandoff.current = null;
    setHandoffTake(null);
    setRecordingInProgress(false);
    projectTake.select(take);
  }
  const navigate = (action: () => void) => {
    if (holdActiveChatCapture()) return;
    (projectExit.current ?? ((next) => next()))(action);
  };
  const startNewProject = () => {
    clearExploreArc(userId);
    beginSetupDraft(userId);
    flow.startNewTopicSetup();
  };
  const chats = useChatsDoor(recordAnswer, {
    activeProject: projectTake.project,
    pendingProjectKey: projectTake.preview?.key,
    pendingProjects: projectTake.pending,
    onOpenPendingProject: (take) => {
      setPickedProject(null);
      closeWait();
      openPendingProject(take);
    },
    navigate,
    onLeaveProject: leaveProject,
    onOpenProject: openProjectChat,
    onStartNewProject: startNewProject,
    onRemoveProject: (arcId) => { if (pickedProject?.arcId === arcId) leaveProject(); },
  });
  const listedProject = chats.projects.find((arc) => arc.arcId === pickedProject?.arcId);
  useEffect(() => {
    if (!listedProject) return;
    setPickedProject((current) =>
      current?.arcId === listedProject.arcId && current.topic !== listedProject.topic
        ? { ...current, topic: listedProject.topic }
        : current,
    );
  }, [listedProject]);

  function leaveProject() {
    projectOpenSequence.current++;
    pendingProjectHandoff.current = null;
    setRecordingInProgress(false);
    setHandoffTake(null);
    setProjectReview(null);
    setPickedProject(null);
    clearPendingTake();
  }

  function handoffProjectRecording(take: PendingProjectTake, keepWait: boolean): boolean {
    if (!chats.enabled || (!chats.speakingActive && !returnProject)) return false;
    projectTake.remember(take);
    openPendingProject(take);
    setPickedProject(returnProject ?? chats.projects.find((project) => project.arcId === take.projectId) ?? null);
    setReturnProject(null);
    projectTake.openWait(keepWait ? take : null);
    const marker = readProcessingTake(userId);
    if (marker && marker.sessionId === take.sessionId) {
      writeProcessingTake(userId, { ...marker, projectChat: true });
    }
    return true;
  }

  function handoffRecording(sessionId: string) {
    const marker = readProcessingTake(userId);
    const owner = returnProject?.arcId ?? (chats.speakingActive ? marker?.arcId : null);
    if (!owner) {
      setWaitHandedOver(sessionId);
      return;
    }
    if (marker?.sessionId === sessionId && marker.arcId === owner) {
      writeProcessingTake(userId, { ...marker, projectChat: true });
    }
    if (returnProject) {
      setHandoffTake(sessionId);
      return;
    }
    const known = chats.projects?.find((project) => project.arcId === owner);
    if (known) {
      openProjectChat(known);
      setHandoffTake(sessionId);
      return;
    }
    pendingProjectHandoff.current = sessionId;
    openProject(owner, sessionId);
  }

  // A2 — `flush` drops the TOP padding so the chat sits flush under the navbar
  // (no gap). Scoped to the home/Lounge call only; welcome keeps py-6.
  // `bare`: no top bar. The welcome is drawn without one in the locked
  // consent screens prototype (founder 2026-10-07, N60: "just the way it is
  // on the prototype"); the menu is back in the Lounge after "Enter the lab".
  // Nor any padding: the welcome scrolls itself and owns its 24px sides.
  const shell = (children: React.ReactNode, flush = false, bare = false, workspace = false) => (
    <main className="willab-chat flex h-full flex-col overflow-hidden bg-background">
      {bare || workspace ? null : (
        <div className="shrink-0" hidden={pickedProject !== null}>
          {/* A pull down from the top bar opens the dump screen (N517). */}
          <DumpPullBar>
            <DashboardHeader />
          </DumpPullBar>
        </div>
      )}
      {workspace ? children : <div
        className={`willab-canvas flex flex-1 flex-col overflow-hidden ${shellPadding(
          flush,
          bare,
        )}${pickedProject ? " relative" : ""}`}
      >
        {children}
      </div>}
    </main>
  );
  const consentedShell = (
    children: React.ReactNode,
    flush = false,
    bare = false,
    workspace = false,
  ) =>
    shell(
      <Mlc2FounderConsentGate
        founderEligible={founderConsentEligible}
      >
        {children}
      </Mlc2FounderConsentGate>,
      flush,
      bare,
      workspace,
    );

  // Phase-1 processing authorization sits BETWEEN Welcome and the Lounge, not
  // in front of everything: the landing hero is marketing, the acceptance is
  // the processing boundary, and the Lounge is what a receipt unlocks. Wrapping
  // `welcome_consent` too would mean the first thing a visitor ever saw was a
  // legal screen for a product they had not been shown yet.
  const authorizedShell = (children: React.ReactNode, flush = false, workspace = false) =>
    consentedShell(
      <Phase1AcceptanceGate>{children}</Phase1AcceptanceGate>,
      flush,
      false,
      workspace,
    );

  // Resolving the initial state post-mount (hydration-safe); and the wait
  // while a signed-up guest's Take is handed over, before its walk opens.
  if (flow.state === null || handingOverTake || linkWaits || skipWelcome) {
    return consentedShell(<LoadingState placement="surface" />);
  }

  // First-run, full-screen (no Lounge underneath yet).
  if (flow.state === "welcome_consent") {
    return consentedShell(
      <WelcomeConsent
        onAccept={() => {
          if (signedIn === false) countFirstVisit("enter");
          flow.acceptConsent();
        }}
      />,
      false,
      true,
    );
  }

  // The active chat and Lab share the scoped thread so the recorder can
  // append its result to the conversation it was opened from.
  if (chats.waiting) return authorizedShell(<LoadingState placement="surface" />);
  const draftKey = pickedProject ? `${userId ?? "guest"}:${pickedProject.arcId}` : "";
  const loungeState = flow.state;
  const lounge = (member?: MemberChatContent) => (
      <Lounge
        member={member}
        chatDrafts={loungeDrafts.current}
        state={loungeState}
        onRecordAnswer={recordAnswer}
        onStart={flow.startRecording}
        onStartNewProject={startNewProject}
        onStartInProject={() => {
          clearActiveSetupDraft(userId);
          flow.startRecordingSetup();
        }}
        onOpenProject={openProject}
        onOpenTakeInProject={openTakeInProject}
        projectChatActive={projectTake.chatActive}
        onProjectTakeReady={chats.speakingActive ? (arcId, sessionId, scoped) => {
          if (!scoped || pendingProjectHandoff.current === sessionId) openProject(arcId, sessionId);
        } : undefined}
        onStartPlanRecording={(topic, start) => {
          // After the first Take, the real talk is that project's Take 2
          // (backend N449 item 1): "How do you feel?" with its Skip, then
          // its set-up afresh, the topic the plan's (N401 item 4).
          if (start?.afterFirstTake && startRealTalk(userId, topic, flow.startNewTopicSetup)) return;
          clearExploreArc(userId);
          if (start?.firstTake?.length) {
            // The first Take is the onboarding (backend N401 item 2): its
            // project, the five questions as its deck, and the recording
            // screens at once, no set-up form and no feelings check.
            void startFirstTake(start.firstTake, userId, flow.startAnswerSetup);
            return;
          }
          // The plan's first practice (docs/flows/the-plan.md E5, B7): a new
          // project whose set-up arrives with the topic filled in; the two
          // ratings took the place of "How do you feel?" (N151). After the
          // first Take, the real talk: "How do you feel?" with its Skip
          // first, then the same set-up (backend N401 item 4).
          beginSetupDraftWithTopic(userId, topic);
          if (start?.afterFirstTake) flow.startNewTopicSetup();
          else flow.dispatch("setup_requested");
        }}
        dispatch={flow.dispatch}
        coachLink={coachLink}
        linkTake={linkTake}
        recordingProgress={recordingProgress}
        waitHandedOver={waitHandedOver}
        onWaitHandedOverShown={() => setWaitHandedOver(null)}
      />
  );
  const conversation = (
    <LoungeThreadProvider signedIn={signedIn} room={chats.takeRoom}>
      {chats.heading}
      {chats.pane}
      <div className={chats.loungeCovered ? "hidden" : "flex min-h-0 flex-1 flex-col"}>
        {chats.hosted ? chats.hosted(lounge) : lounge()}
      </div>
      {/* Context-aware setup — WHICH project, asked before the Lab opens.
          Picking a title seeds the arc so the setup form prefills from it and
          the take continues that project's master document; "new project"
          clears the seed so the blank flow is genuinely blank. */}
      {flow.state === "lab_project_pick" && (
        <ProjectPicker
          ownerId={userId}
          onNewTopic={() => {
            clearExploreArc(userId);
            // A fresh draft slot: the setup saves into it from the first
            // answered question, so an interruption leaves it resumable.
            beginSetupDraft(userId);
            // The existing emotion check happens once, before Take 1. A
            // continuation reuses the project without asking it again.
            flow.startNewTopicSetup();
          }}
          onResumeDraft={(draft) => {
            // A draft is a brand-new project that was interrupted — same
            // entry as "Start a new project", with its answers restored.
            clearExploreArc(userId);
            resumeSetupDraft(userId, draft.id);
            flow.startNewTopicSetup();
          }}
          onContinue={(arc) => {
            clearActiveSetupDraft(userId);
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
            setHandoffTake(null);
            openProjectChat(arc);
            flow.closeLab(); // dismiss the picker; the project chat takes over
          }}
          // Nothing to choose (no projects, or the list is unreachable) →
          // skip the question entirely rather than leave "Start a new project"
          // as the only answer, which would WIPE a seeded arc (review R-pp7).
          // Deliberately NOT onNewTopic: this must not clear the seed.
          onSkip={() => {
            clearActiveSetupDraft(userId);
            flow.startRecordingSetup();
          }}
          onClose={flow.closeLab}
        />
      )}
      {/* An existing project opens its own conversation. Its two durable
          results reopen the source Feedback walk and Ideal Text; recording
          always starts from this project, never from Will. */}
      {pickedProject ? (
        <ProjectChat
          key={projectChatKey(pickedProject.arcId, projectReview)}
          project={pickedProject}
          initialReview={projectReview && projectReview.target}
          handoffTake={handoffTake}
          beforeLeaveRef={projectExit}
          initialDraft={projectDrafts.current.get(draftKey) ?? ""}
          onDraftChange={(draft) => projectDrafts.current.set(draftKey, draft)}
          recordingInProgress={recordingInProgress}
          pendingRecording={projectTake.pending.find((take) => take.projectId === pickedProject.arcId)}
          onOpenPendingRecording={projectTake.openWait}
          onBack={leaveProject}
          onRecord={(arcId) => {
            // Repeat/continue is allowed to arrive here from a remounted
            // project chat. Seed the selected arc again at the recorder
            // boundary so the Take cannot silently become a new project.
            const cached = readExploreArc(userId);
            const latest = [...(pickedProject.takes ?? [])]
              .sort((a, b) => (a.takeIndex ?? 0) - (b.takeIndex ?? 0))
              .pop();
            const nextTakeIndex = (latest?.takeIndex ?? pickedProject.takeCount ?? 0) + 1;
            if (
              cached?.arcId !== arcId ||
              (cached?.nextTakeIndex ?? 0) < nextTakeIndex ||
              cached?.sessionId !== latest?.sessionId
            ) {
              writeExploreArc(
                userId,
                arcId,
                Math.max(cached?.nextTakeIndex ?? 0, nextTakeIndex),
                cached?.arcId === arcId ? cached.deck : undefined,
                latest?.sessionId ?? cached?.sessionId,
              );
            }
            setRecordingInProgress(true);
            setHandoffTake(null);
            setReturnProject(pickedProject);
            setPickedProject(null);
            flow.startRecordingSetup();
          }}
          onRecordingSettled={() => {
            setRecordingInProgress(false);
            setHandoffTake(null);
            closeWait();
            void refreshProjectTrainings();
          }}
        />
      ) : <PendingProjectChat take={projectTake.preview} onOpen={projectTake.openWait} />}
      {flow.labOverlayOpen && (
        <LabOverlay
          state={flow.state}
          sessionId={null}
          dispatch={flow.dispatch}
          onClose={() => {
            if (cancelsPendingProjectRecording(flow.state)) {
              setRecordingInProgress(false);
            }
            flow.closeLab();
            // An answer's project was never the speaker's current one.
            endAnswer();
          }}
          onWaitHandedOver={handoffRecording}
          onProjectRecordingHandoff={handoffProjectRecording}
          onProjectRecordingFailure={projectTake.fail}
          onProjectRecordingAccepted={projectTake.acknowledge}
          onRecordingProgress={setRecordingProgress}
        />
      )}
      {projectTake.wait ? <PendingProjectWait key={`wait:${projectTake.wait.key}`} take={projectTake.wait}
        onClose={closeWait} /> : null}
      {/* The Lab's screens fade back out over the Lounge (Q-B14 A, D-RC-7). */}
      <LabFadeOut open={flow.labOverlayOpen} />
    </LoungeThreadProvider>
  );
  return authorizedShell(chats.enabled ? (
    <ChatWorkspace key={userId} sidebar={chats.sidebar} viewKey={chats.activeChat}
      suspended={flow.labOverlayOpen || flow.state === "lab_project_pick"}>
      {conversation}
    </ChatWorkspace>
  ) : conversation, true, chats.enabled);
}

/** The steps of a first visit the flow itself shows (backend N271): the
 *  recording screen opening, the Take going to processing, and its result.
 *  Counted only for a visitor without an account; firstVisit.ts counts each
 *  once per tab. */
const FIRST_VISIT_STEP: Partial<Record<WillabState, FirstVisitStep>> = {
  lab_recording: "recording",
  lab_processing: "recorded",
};

function useFirstVisitSteps(state: WillabState | null, signedIn: boolean | null) {
  useEffect(() => {
    const step = state ? FIRST_VISIT_STEP[state] : undefined;
    if (step && signedIn === false) countFirstVisit(step);
  }, [state, signedIn]);
}

/** The shell's padding. The welcome (`bare`) has none: it scrolls itself
 *  from its true top and owns its 24px sides (consent lock 2026-10-07). The
 *  Lounge (`flush`) sits flush under the navbar; every other shell keeps
 *  pt-6. */
function shellPadding(flush: boolean, bare: boolean): string {
  if (bare) return "";
  return `px-4 pb-2 ${flush ? "pt-0" : "pt-2"}`;
}

// Founder-Approved: contact-point chat, 2026-11-18; keep the project Feedback actions inside the canvas above the global footer.
