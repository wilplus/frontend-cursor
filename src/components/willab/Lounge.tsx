"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Plus, Send, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import Linkified from "./Linkified";
import CoachWalkEntry from "./coachwalk/CoachWalkEntry";
import SnippetWavePlayer from "./SnippetWavePlayer";
import LoungeAiVoiceBubble, { aiVoiceOfMeta } from "./LoungeAiVoiceBubble";
import { CHUNK_SHEET_COPY } from "./idealEditCopy";
import { postChatQuery } from "@/services/api/chatQuery";
import { refreshNewCoachFeedback, type LoungeMessage } from "@/services/api/loungeMessages";
import { useLoungeThreadCtx } from "./LoungeThreadContext";
import {
  isRetiredLoungeMessage,
  isUploadAsk,
  loungeToHistory,
  splitBotMessage,
} from "./willabHelpers";
import { useLabReadoutLive } from "./useLabReadoutLive";
import { useDocumentSettle } from "./useDocumentSettle";
import {
  useFailedTakeRecheck,
  probeTakeVerdict,
  type FailedTakeVerdict,
} from "./useFailedTakeRecheck";
import { useUserId } from "./useUserId";
import {
  readProcessingTake,
  clearProcessingTake,
  markProcessingTakeFailed,
  markProcessingTakeIdealTextUnconfirmed,
  transitionProcessingTakeToDocument,
  updateProcessingTakeProgress,
  writeProcessingTake,
  type ProcessingPhase,
} from "@/lib/willab/processingTake";
import {
  retryIdealTextGeneration,
  retryLabProcessing,
} from "@/services/api/labRecording";
import { stageLabUpload } from "./labUploadStage";
import { validateAudioUpload } from "./audioUploadValidation";
import ReportCard, {
  refreshLiveIdealDoc,
  type FeedbackBubbleTarget,
  type IdealTextRetryTarget,
} from "./ReportCard";
import { latestIdealBubbleIds } from "./unreadFeedback";
import { idealTextReadyDraft, idealTextUnconfirmedDraft } from "./loungeReports";
import { FLOW_COPY } from "./flowCopy";
import LoadingState, { VoiceMark } from "./LoadingState";
import { PROCESSING_STAGES } from "./ProcessingWait";
import FeedbackOverlay from "./FeedbackOverlay";
import DeckSlidePreview from "./DeckSlidePreview";
import IdealTextOverlay, { type IdealTextLaunchMode } from "./IdealTextOverlay";
import type { WalkStepTarget } from "@/lib/willab/feedbackWalkModel";
import LibraryOverlay from "./LibraryOverlay";
import {
  clearExploreArc,
  readExploreArc,
  writeExploreArc,
} from "@/lib/willab/exploreArc";
import { clearInsightsReady } from "./sendStatus";
import { isLabOverlay, type WillabEvent, type WillabState } from "./useWillabFlow";
import { useUserProfile } from "./useUserProfile";
import LoungeTopUpCard from "./LoungeTopUpCard";
import ConfidencePracticeOverlay from "./ConfidencePracticeOverlay";
import {
  useInstallOffer,
  InstallOfferActions,
  type InstallOffer,
} from "./WillabInstallPrompt";
import {
  useWhatsAppOffer,
  WhatsAppOfferActions,
  type WhatsAppOffer,
} from "./WillabWhatsAppPrompt";
import SymmetricPair from "./SymmetricPair";
import OfferBubble from "./OfferBubble";
import {
  offerDraft,
  readOfferType,
  hasOffer,
  type OfferType,
} from "./loungeOffers";
import {
  CHIP_LABEL,
  coerceSuggestedAction,
  coerceSuggestedActions,
  type ChipAction,
} from "./loungePrompts";
import type { RecordingProgress } from "@/services/api/recordingProgress";
import { useLifeTags } from "@/lib/life/useLifeTags";
import { applyPick } from "@/lib/life/hashtags";
import { LifeChatCard, LifeTagPicker } from "@/components/life/LifeChatLayer";
import {
  announceDiscoveriesFromPersistedMessages,
  productActionFromMetadata,
  productSpec,
} from "@/lib/productDiscovery";
import ProcessingResumeOverlay from "./ProcessingResumeOverlay";
import { usePinThreadBottom } from "./usePinThreadBottom";

/* -------------------------------------------------------------------------- */
/*  Lounge — the always-mounted science-chat home (§3 / §6a / §7)             */
/*                                                                            */
/*  Replaces the LoungeStub: a persistent thread (useLoungeThread — server     */
/*  when signed in, localStorage when not), a librarian bot over the existing  */
/*  /v2/chat/query endpoint (we read `.answer`; the funnel-only flags are      */
/*  ignored), the single-active status region (§6a: parked / review / ready),  */
/*  and the entry into the Lab. Audio, KPIs and labels live in the Lab — the   */
/*  Lounge is text-only and never judges (§7 librarian-not-judge).            */
/*                                                                            */
/*  Coach-mode addition (§F.1): when the signed-in user's profile carries     */
/*  `is_coach: true`, the chat thread also surfaces review-queue rows as       */
/*  inbound bubbles, chronologically interleaved with regular messages.        */
/*  Non-coach users see exactly the same Lounge as before.                    */
/* -------------------------------------------------------------------------- */

/** Discriminated union of items rendered in the Lounge thread. Carries the
 *  sort key + react key explicitly so the merge stays type-safe. */
type ThreadItem = {
  kind: "message";
  sortKey: string;
  reactKey: string;
  message: LoungeMessage;
};

/** Which take's failed note is on screen, if any. Under the Lab the Lab owns
 *  the wait, so no recheck runs there. Pure, so the sheet's own function does
 *  not grow a branch for it (complexity ratchet). */
function failedNoteSession(
  labOpen: boolean,
  resume: { sessionId: string; status: "analyzing" | "failed" } | null,
): string | null {
  if (labOpen || !resume || resume.status !== "failed") return null;
  return resume.sessionId;
}

export default function Lounge({
  state,
  onStart,
  onStartNewProject,
  onStartInProject,
  dispatch,
  initialBestPresentationArcId = null,
  initialIdealTextArcId = null,
  initialIdealTextFeedback = false,
  recordingProgress = null,
}: {
  state: WillabState;
  onStart: () => void;
  /** Bypass project selection after the user explicitly chose a fresh project. */
  onStartNewProject?: () => void;
  /** Scenario B (founder 2026-07-22) — recording from INSIDE a project: the
   *  project is already known, so the picker is skipped entirely and the Lab
   *  opens straight onto the prefilled setup. */
  onStartInProject?: () => void;
  /** What happened; useWillabFlow's table decides the state. */
  dispatch: (event: WillabEvent) => void;
  /** C — when set (from /chat?arc=<arc_id>), open the BestPresentationOverlay
   *  for that arc once on mount. */
  initialBestPresentationArcId?: string | null;
  /** When set (from /chat?idealArc=<arc_id>), open the IdealTextOverlay for
   *  that arc once on mount — the coach-feedback email's CTA. */
  initialIdealTextArcId?: string | null;
  /** With `&feedback=1`, open that notebook on the coach's feedback. */
  initialIdealTextFeedback?: boolean;
  /** Seed from the upload response; reserved for future per-take state. */
  recordingProgress?: RecordingProgress | null;
}) {
  const userId = useUserId();
  const thread = useLoungeThreadCtx();
  const { messages, reload } = thread;
  const [draftText, setDraftText] = useState("");
  // R4-12 — the composer is an auto-grow textarea (multi-line). Re-fit its
  // height to the content on every change, capped so it never eats the thread.
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = "auto";
    // The BORDER has to be added back. `scrollHeight` covers content + padding
    // and stops there, but the box is `border-box` (Tailwind's global reset),
    // so assigning that number as the height makes the browser fit the borders
    // INSIDE it — the content box comes out 2px short of the text it was just
    // measured from. The result was a permanently-overflowing field: from the
    // second line on, the textarea grew to exactly the wrong height and drew a
    // scrollbar over a box that had just been sized to fit.
    const cs = window.getComputedStyle(el);
    const border =
      parseFloat(cs.borderTopWidth || "0") +
      parseFloat(cs.borderBottomWidth || "0");
    el.style.height = `${Math.min(el.scrollHeight + border, 160)}px`;
  }, [draftText]);
  // FE-5 — the Life Panel's # layer. `enabled` is false for every user who has
  // not consented AND completed setup, which is everyone until they opt in, so
  // for them nothing below mounts and this component behaves exactly as it did
  // before the panel existed. Anonymous visitors make no request for it at all.
  // Sending is untouched either way: routing happens on the backend, and the
  // composer still posts the same /v2/chat/query.
  const lifeTags = useLifeTags(thread.signedIn);
  const [botThinking, setBotThinking] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  // F2/F7 — the offer (install / legacy joke) whose action pair is open in
  // the footer (replacing the record button). null → the record button shows.
  // The offers themselves persist as thread bubbles (loungeOffers); this only
  // tracks which one is currently "armed".
  const [activeOffer, setActiveOffer] = useState<OfferType | null>(null);
  // E3 — coach-only student roster overlay.
  // U1 (native scroll): scroll the thread CONTAINER, and stick to the bottom
  // only when the user is already there. The old code called scrollIntoView on
  // a bottom sentinel on every new message + every bot-typing toggle, which
  // (a) could pan the whole page / iOS viewport, and (b) yanked the user back
  // down whenever they'd scrolled up to read history — the non-native feel.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // THE WHOLE PAGE SCROLLS THE CHAT (founder 2026-10-12): a wheel on the
  // white margins either side of the column scrolls the thread too.
  useEffect(() => forwardMarginWheel(() => scrollRef.current), []);
  const atBottomRef = useRef(true);
  const didInitScrollRef = useRef(false);
  // U3 — baseline of message ids present on first load (historical). A bot
  // message NOT in this set, rendered as the last thread item, is a freshly-
  // arrived reply → it reveals sequentially (animate). Set once, post first load.
  const baselineRef = useRef<Set<string> | null>(null);

  // §F.0 / §F.1 — coach-mode surface. is_coach is the RENDER gate (the BE
  // role-gates each endpoint independently via require_admin_or_coach, so a
  // tampered FE flag wouldn't get past the upstream wall). Non-coach users
  // see exactly the same Lounge as today.
  const { isCoach } = useUserProfile();
  // The coach's walk (founder 2026-09-30; on since group 4) is the coach's
  // one door, under the thread. The per-student bubbles, the roster, the
  // take-review overlay and the arc-level delivery that once hung off this
  // hub are gone (founder 2026-09-30, B3 to B6; P2-19).

  const threadItems = useMemo<ThreadItem[]>(() => {
    // #10 — dedupe by client_id: the BE thread is the source of truth and its
    // idempotent client_ids are the identity. A double-insert (retry, optimistic
    // + server echo) must never render twice (also keeps React keys unique).
    const seenIds = new Set<string>();
    const items: ThreadItem[] = [];
    for (const m of messages) {
      if (isRetiredLoungeMessage(m)) continue;
      if (m.client_id) {
        if (seenIds.has(m.client_id)) continue;
        seenIds.add(m.client_id);
      }
      items.push({
        kind: "message",
        sortKey: m.client_created_at,
        reactKey: m.client_id,
        message: m,
      });
    }
    // SD — the audit-progress line ("N more takes to the full training") is
    // retired with the 3-take arc: takes are open-ended now.
    items.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    return cardBeforeSummary(items);
  }, [messages]);
  // Each project's latest Ideal Text bubble wears the unread-feedback dot
  // (founder 2026-09-25, Q39 B).
  const latestIdealIds = useMemo(() => latestIdealBubbleIds(threadItems), [threadItems]);
  // "Continue review" (founder lock 2026-10-12, section 1): the newest walk
  // step names its project and is not the review's end.
  const reviewToContinue = useMemo(() => continueReviewArc(threadItems), [threadItems]);
  // The step it waits on wears the orange outline (same section).
  const waitingStep = useMemo(() => waitingStepId(threadItems, reviewToContinue), [threadItems, reviewToContinue]);
  // Each bubble's Take, and each project's newest: an older Take's steps are
  // history ("🔒 Take N" on its helper words, section 2.3).
  const olderTake = useMemo(() => olderTakeOf(threadItems), [threadItems]);
  // A coach update is new (orange) until it is opened.
  const [seenUpdates, setSeenUpdates] = useState<ReadonlySet<string>>(readSeenUpdates);
  const stepWaits = (m: LoungeMessage) =>
    waitingStep === m.client_id || (m.metadata?.coach_update === true && !seenUpdates.has(m.client_id));
  // Helper words a later pick replaced: struck in the chat (prototype v31).
  const replacedWords = useMemo(() => replacedWordIds(threadItems), [threadItems]);

  // U6 — opening the in-thread insight card is the single "mark read" path now
  // that the top banner is gone: open the overlay, and if we were in the unread
  // insights_ready state, clear the flag + return the status machine to idle
  // (exactly what the banner's "Read ›" button used to do).

  // C8 — every quick-action CTA lands in ONE place: the Trainings library
  // (trainings / audit). audit previously routed to /audits; it now opens the
  // Trainings library like the rest so the chips don't scatter. No record chip:
  // the bot points at the permanent record button in words. (arc_checkout, the
  // $25 pay note, was retired with the paywall — only $5 moments is paid now.)
  function onChip(action: ChipAction): void {
    const project = readExploreArc(userId);
    if (
      action === "create_new_project" ||
      action === "create_project_from_updated_deck"
    ) {
      postAnswerBubble(CHIP_LABEL[action]);
      clearExploreArc(userId);
      (onStartNewProject ?? onStart)();
      return;
    }
    if (action === "replace_pdf") {
      // The backend only offers this before Take 1; repeat the guard locally so
      // a stale, persisted button cannot reopen deck mutation after a take.
      if (project && Math.max(0, project.nextTakeIndex - 1) === 0) {
        postAnswerBubble(CHIP_LABEL[action]);
        dispatch("setup_requested");
      }
      return;
    }
    if (action === "edit_current_slide") {
      if (project?.arcId) {
        postAnswerBubble(CHIP_LABEL[action]);
        openIdealText(project.arcId, "notebook");
      }
      return;
    }
    if (action === "keep_current_project") {
      postAnswerBubble(CHIP_LABEL[action]);
      return;
    }
    setLibraryOpen(true);
  }

  function openIdealText(
    arcId: string,
    mode: IdealTextLaunchMode = "notebook",
    at: WalkStepTarget | null = null,
  ): void {
    setIdealTextReviewAt(at);
    if (state === "insights_ready") {
      clearInsightsReady();
      dispatch("insights_opened");
    }
    setIdealTextLaunchMode(mode);
    setIdealTextArcId(arcId);
  }

  // D3 — user results email deep-link (/chat?insight=<id>): open the insights
  // overlay for that session once on mount. Not coach-gated (InsightsOverlay
  // fetches the owner-auth readout); fire-once so closing it doesn't reopen.

  // C — the old best-presentation deep-link (/chat?arc=<arc_id>). Best
  // Presentation is retired (L1; second plan, 2026-10-05): the link opens the
  // arc's Ideal Text instead, once on mount, so closing it doesn't reopen.
  const bestPresLinkOpenedRef = useRef(false);
  useEffect(() => {
    if (bestPresLinkOpenedRef.current || !initialBestPresentationArcId) return;
    bestPresLinkOpenedRef.current = true;
    openIdealText(initialBestPresentationArcId);
    // openIdealText is a plain function of this render; the link fires once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBestPresentationArcId]);

  // THE COACH-FEEDBACK EMAIL LANDS ON THE TEXT ITSELF (founder 2026-08-15:
  // "does the link from the email lead to this particular ideal text that
  // holds these reviews? if not make it a deep link").
  //
  // It did not — the CTA opened bare /chat, so the one email that is entirely
  // about ONE talk handed the student a thread to search. Same fire-once shape
  // as the best-presentation link above: closing the notebook must not reopen
  // it, or the student cannot get back to the chat the link landed them in.
  const idealLinkOpenedRef = useRef(false);
  useEffect(() => {
    if (idealLinkOpenedRef.current || !initialIdealTextArcId) return;
    idealLinkOpenedRef.current = true;
    if (initialIdealTextFeedback) setIdealTextLaunchMode("feedback");
    setIdealTextArcId(initialIdealTextArcId);
  }, [initialIdealTextArcId, initialIdealTextFeedback]);

  // Wave-3 — no standing / every-visit offer. The proactive strong-sides nudge
  // fires once at the post-send moment (A-4 / B-2); otherwise the bot stays
  // quietly standing by. Intent-driven buttons come from the BE (B-1).

  // Voice input has been removed from the Lounge (product call): only
  // the **official recording** holds the mic. Off-task chat is
  // text-only — keeps the Lounge composer visually distinct from the
  // Lab's "Start official recording" CTA so users never confuse the
  // calm off-stage surface with the high-stakes on-stage one. The
  // Web Speech machinery (`useSpeechInput`) was deleted in the
  // founder-approved dead-code sweep; recover it from git history if
  // a future surface (e.g. an accessibility opt-in) wants it back.

  // Jump to bottom once the thread finishes loading — always open at the latest
  // message. Re-pin after the next frame + a short delay so async content
  // (slide images, report cards) that grows the thread doesn't leave us short
  // of the true bottom.
  useEffect(() => {
    if (didInitScrollRef.current || thread.loading || messages.length === 0) {
      return;
    }
    didInitScrollRef.current = true;
    const el = scrollRef.current;
    if (!el) return;
    const toBottom = () => {
      el.scrollTop = el.scrollHeight;
    };
    toBottom();
    requestAnimationFrame(toBottom);
    const t = setTimeout(toBottom, 150);
    return () => clearTimeout(t);
  }, [thread.loading, messages.length]);

  // F2 — install affordance primitives (platform + dismiss state). Drives both
  // whether to surface the install offer and the footer action pair.
  const install = useInstallOffer();

  // FE-4 — the "practice mode" state that made the record CTA read "Record the
  // next take" and skip the project choice is gone with the shortcut it drove.
  // A cached arc says where the LAST take went, which is not an answer to
  // where this one should go.

  // When the user asks to upload a file, the footer's record button becomes a
  // file picker (deckless upload). Tracks the LATEST intent so it reverts once
  // the user moves on. Detection is FE-side (the bot doesn't classify it).
  const [uploadAskActive, setUploadAskActive] = useState(false);
  const uploadFileRef = useRef<HTMLInputElement | null>(null);
  // Bug 1 — a picked file that fails the audio/size guard shows inline under
  // the button instead of silently opening the Lab with a doomed upload.
  const [uploadPickError, setUploadPickError] = useState<string | null>(null);

  // Delivery layer — the tapped feedback bubble (per-take page) and the purple
  // ideal-text bubble's notebook.
  const [feedbackTarget, setFeedbackTarget] =
    useState<FeedbackBubbleTarget | null>(null);
  const [idealTextArcId, setIdealTextArcId] = useState<string | null>(null);
  const [idealTextReviewAt, setIdealTextReviewAt] = useState<WalkStepTarget | null>(null);
  const [idealTextLaunchMode, setIdealTextLaunchMode] =
    useState<IdealTextLaunchMode>("notebook");
  const [confidencePracticeId, setConfidencePracticeId] = useState<
    string | null
  >(null);

  // Async analysis (delivery layer) — a take left mid-analysis keeps finishing
  // server-side; resume its persisted marker and subscribe until terminal:
  // push-first via the readout SSE bridge, with the original 5s poll as the
  // automatic fallback tier inside useLabReadoutLive. Re-arms whenever the Lab
  // overlay CLOSES (state-driven, not mount-only — the Lounge is
  // always-mounted, so a marker written mid-session must be picked up the
  // moment the user comes back from the Lab). While the Lab is open it owns
  // the live subscription, so this stands down.
  const [processingResume, setProcessingResume] = useState<{
    sessionId: string;
    takeIndex: number | null;
    status: "analyzing" | "failed";
    startedAt: number;
    progress: { stage: string; percent: number | null } | null;
    /* Carried so the resumed view can say WHICH wait it is. The marker has
       always known; this state used to drop it on the way to the screen. */
    phase: ProcessingPhase;
    /* And WHEN that wait began, for the same reason. The bar's document tail
       is measured from it; without it the screen can only time itself from
       its own mount, which restarts the tail on every remount. */
    phaseStartedAt: number;
  } | null>(null);
  // A presentation key, not a second lifecycle owner. The job observer below
  // stays mounted in the Lounge while this exact session is shown full-screen.
  const [openedProcessingSessionId, setOpenedProcessingSessionId] = useState<
    string | null
  >(null);
  const processingTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [retryingProcessing, setRetryingProcessing] = useState(false);
  const [resumeWatch, setResumeWatch] = useState<{
    sessionId: string;
    takeIndex: number | null;
    startedAt: number;
  } | null>(null);
  const idealTextFailurePublishRef = useRef(new Set<string>());
  const publishIdealTextUnconfirmed = useCallback(
    async (target: {
      sessionId: string;
      arcId: string;
      takeIndex: number | null;
    }) => {
      if (!target.arcId || target.takeIndex !== 1) return;
      if (idealTextFailurePublishRef.current.has(target.sessionId)) return;
      idealTextFailurePublishRef.current.add(target.sessionId);
      try {
        // EVIDENCE BEFORE THE CLAIM (founder 2026-09-24). This card is
        // durable and it is what the speaker reads, so it may not rest on a
        // timer alone — the document cap expiring in this tab says nothing
        // about whether the backend made the document.
        const verdict = await probeTakeVerdict(target.sessionId);
        if (verdict === "recovered") {
          // The take is done. There was never a failure to publish.
          clearProcessingTake(userId, target.sessionId);
          setProcessingResume(null);
          setResumeWatch(null);
          await reload().catch(() => undefined);
          return;
        }
        if (verdict === "running") {
          // Still working. The cap released the screen; that is all it may
          // do. PUT THE MARKER BACK -- syncMarker re-enters this path every
          // 500ms while the marker reads terminal, so returning without
          // repairing it would poll the readout twice a second. Same repair
          // the failed-note recheck makes on the same verdict.
          const marker = readProcessingTake(userId);
          if (marker?.sessionId === target.sessionId) {
            const now = Date.now();
            writeProcessingTake(userId, {
              ...marker,
              status: "processing",
              phase: "analysis",
              startedAt: now,
              phaseStartedAt: now,
              progress: { stage: "processing_recording", percent: 0 },
            });
          }
          return;
        }

        const existing = readProcessingTake(userId);
        if (existing?.sessionId === target.sessionId) {
          markProcessingTakeIdealTextUnconfirmed(userId, target.sessionId);
        } else {
          const now = Date.now();
          writeProcessingTake(userId, {
            sessionId: target.sessionId,
            arcId: target.arcId,
            takeIndex: 1,
            startedAt: now,
            phaseStartedAt: now,
            phase: "analysis",
            status: "failed_ideal_text_unconfirmed",
            progress: { stage: "ideal_text", percent: null },
          });
        }
        setResumeWatch(null);
        try {
          await thread.append(
            idealTextUnconfirmedDraft({
              sessionId: target.sessionId,
              arcId: target.arcId,
              takeIndex: 1,
            }),
          );
          // Clear only after the session-keyed card has been durably
          // appended. If delivery fails, the terminal marker survives and
          // this observer retries instead of letting the failure disappear.
          clearProcessingTake(userId, target.sessionId);
          setProcessingResume(null);
        } catch {
          await reload().catch(() => undefined);
        }
      } finally {
        idealTextFailurePublishRef.current.delete(target.sessionId);
      }
    },
    [reload, thread, userId],
  );
  useEffect(() => {
    if (isLabOverlay(state)) {
      // The LabOverlay owns the live subscription while open. Entering the
      // Lab is also the ACT that retires a failure note (W6): the note's
      // second line points at recording again, and this is that path.
      setProcessingResume((prev) => (prev?.status === "failed" ? null : prev));
      setResumeWatch(null);
      return;
    }
    const syncMarker = () => {
      const marker = readProcessingTake(userId);
      if (!marker) {
        // W6 (founder 2026-08-10) — a FAILED note survives idle state changes.
        // It used to be wiped here by the first state flip after the 10s timer
        // was removed, which re-created the vanishing it was meant to fix: a
        // failed take must stay on screen until the user acts on it (opens the
        // Lab) or a fresh take replaces it below.
        setProcessingResume((prev) =>
          prev?.status === "failed" ? prev : null,
        );
        setResumeWatch(null);
        return;
      }
      if (marker.status === "failed_ideal_text_unconfirmed") {
        if (marker.arcId && marker.takeIndex === 1) {
          void publishIdealTextUnconfirmed({
            sessionId: marker.sessionId,
            arcId: marker.arcId,
            takeIndex: 1,
          });
        } else {
          clearProcessingTake(userId, marker.sessionId);
        }
        return;
      }
      const status = marker.status === "failed" ? "failed" : "analyzing";
      setProcessingResume((previous) => {
        const unchanged =
          previous?.sessionId === marker.sessionId &&
          previous.takeIndex === marker.takeIndex &&
          previous.status === status &&
          previous.startedAt === marker.startedAt &&
          // PHASE IS PART OF "unchanged". The analysis → document transition
          // can happen with the stage and percent identical on both sides, and
          // without this the screen would keep the old phase's label for the
          // rest of the job — the exact mislabel this carries the phase to fix.
          previous.phase === marker.phase &&
          previous.progress?.stage === marker.progress?.stage &&
          previous.progress?.percent === marker.progress?.percent;
        return unchanged
          ? previous
          : {
              sessionId: marker.sessionId,
              takeIndex: marker.takeIndex,
              status,
              startedAt: marker.startedAt,
              progress: marker.progress,
              phase: marker.phase,
              phaseStartedAt: marker.phaseStartedAt,
            };
      });
      if (marker.status === "failed" || marker.phase === "document") {
        // The readout is done in document phase; there is no analysis stream
        // to watch. The settle hook below owns the remaining wait.
        setResumeWatch(null);
        return;
      }
      setResumeWatch((previous) =>
        previous?.sessionId === marker.sessionId &&
        previous.takeIndex === marker.takeIndex &&
        previous.startedAt === marker.startedAt
          ? previous
          : {
              sessionId: marker.sessionId,
              takeIndex: marker.takeIndex,
              startedAt: marker.startedAt,
            },
      );
    };
    syncMarker();
    // Same-tab writes do not emit `storage`; the cheap local marker check also
    // covers those. Cross-tab replacements are picked up immediately.
    const markerPoll = window.setInterval(syncMarker, 500);
    window.addEventListener("storage", syncMarker);
    return () => {
      window.clearInterval(markerPoll);
      window.removeEventListener("storage", syncMarker);
    };
  }, [state, userId, publishIdealTextUnconfirmed]);
  useLabReadoutLive(
    // Gate from the rendered flow state, not from the effect-lagging local
    // state. A real Lab mount therefore tears this transport down in the same
    // commit before the Lab can subscribe. The local resume overlay does not
    // change flow state, so this one watcher continues without reconnecting.
    !isLabOverlay(state) ? (resumeWatch?.sessionId ?? null) : null,
    (r) => {
      if (!resumeWatch) return;
      const currentMarker = readProcessingTake(userId);
      // A late response for session A must not mutate session B's marker OR
      // the currently displayed progress/failure state. A terminal analysis
      // has already moved to the document phase, so it is monotonic too: no
      // late processing/failure envelope may pull it backwards.
      if (
        currentMarker?.sessionId !== resumeWatch.sessionId ||
        currentMarker.phase !== "analysis" ||
        currentMarker.status !== "processing"
      ) {
        return;
      }
      if (r.processing) {
        const latestProgress = updateProcessingTakeProgress(
          userId,
          resumeWatch.sessionId,
          r.processing,
        );
        setProcessingResume((current) =>
          current?.sessionId === resumeWatch.sessionId &&
          current.status === "analyzing" &&
          latestProgress
            ? { ...current, progress: latestProgress }
            : current,
        );
      }
      const hasContent =
        r.readout.snippets.length > 0 ||
        r.readout.instantChunks.length > 0 ||
        r.readout.fullTranscriptChunks.length > 0;
      if (r.state === "failed_ideal_text_unconfirmed") {
        if (currentMarker.arcId && currentMarker.takeIndex === 1) {
          void publishIdealTextUnconfirmed({
            sessionId: currentMarker.sessionId,
            arcId: currentMarker.arcId,
            takeIndex: 1,
          });
        }
        return;
      }
      if (r.state === "failed") {
        markProcessingTakeFailed(userId, resumeWatch.sessionId);
        const failedMarker = readProcessingTake(userId);
        setProcessingResume({
          sessionId: resumeWatch.sessionId,
          takeIndex: resumeWatch.takeIndex,
          status: "failed",
          startedAt: resumeWatch.startedAt,
          progress:
            failedMarker?.sessionId === resumeWatch.sessionId
              ? failedMarker.progress
              : null,
          phase:
            failedMarker?.sessionId === resumeWatch.sessionId
              ? failedMarker.phase
              : "analysis",
          phaseStartedAt:
            failedMarker?.sessionId === resumeWatch.sessionId
              ? failedMarker.phaseStartedAt
              : resumeWatch.startedAt,
        });
        setResumeWatch(null);
        // W6 (founder 2026-08-10) — the failure note used to clear itself
        // after 10 seconds. A failed take that vanishes from the screen is
        // halfway to a failed take that never happened: look away for ten
        // seconds and there is no evidence anything went wrong. It now stays
        // until the user ACTS — opening the Lab (the retry path, which this
        // note's second line points at) clears it via the state effect above,
        // and a fresh analysing marker replaces it. Same copy, longer life.
        return;
      }
      if (
        r.state === "ready" ||
        r.state === "readout_ready" ||
        (r.state !== "processing" && hasContent)
      ) {
        const marker = readProcessingTake(userId);
        if (marker?.sessionId === resumeWatch.sessionId && marker.arcId) {
          const cached = readExploreArc(userId);
          writeExploreArc(
            userId,
            marker.arcId,
            (marker.takeIndex ?? 0) + 1,
            cached?.arcId === marker.arcId ? cached.deck : undefined,
            marker.sessionId,
          );
        }
        if (marker?.arcId) {
          // Every spoken Take owns a durable review version. Hold until the
          // served Ideal Text proves that exact 1.0/2.0/3.0 state landed.
          transitionProcessingTakeToDocument(userId, resumeWatch.sessionId);
          setProcessingResume((current) =>
            current?.sessionId === resumeWatch.sessionId &&
            current.status === "analyzing"
              ? {
                  ...current,
                  progress: { stage: "document_assembly", percent: null },
                }
              : current,
          );
        } else {
          clearProcessingTake(userId, resumeWatch.sessionId);
          setProcessingResume(null);
        }
        setResumeWatch(null);
      }
    },
    5000,
  );

  // SPEC-lockin-loop §1 — the document-phase authority. Probes the served
  // ideal text while a take's document assembles and clears the marker on
  // evidence the new text landed (or the bounded cap). Disabled under the
  // Lab, which owns its own settle watch there.
  const documentSettle = useDocumentSettle({
    enabled: !isLabOverlay(state),
    onSettled: (take) => {
      setProcessingResume((prev) => (prev?.status === "failed" ? prev : null));
      // A guest left the Lab while the text was being made: post the "your
      // text is ready" bubble the server posts only for an account
      // (founder live test 2026-10-05).
      if (!thread.signedIn && take.arcId) {
        void thread.append(idealTextReadyDraft({
          arcId: take.arcId,
          version: take.takeIndex,
        }));
      }
      // The reload brings the Take's bubble; the journey message is no longer
      // posted (the closing summary takes over, lock 2026-10-12, section 3).
      // THE REVIEW OPENS BY ITSELF when the Take's feedback is ready, even if
      // the speaker left the processing screen for the chat (section 1).
      void reload().catch(() => undefined);
      if (take.arcId) openIdealText(take.arcId, "review");
    },
    onExpired: (take) => {
      if (take.arcId && take.takeIndex === 1) {
        void publishIdealTextUnconfirmed({
          sessionId: take.sessionId,
          arcId: take.arcId,
          takeIndex: 1,
        });
      }
      /* RELEASE THE SCREEN, which `onSettled` does and this did not.
       *
       * FOUNDER 2026-09-21: the wait sat on "Building your Ideal Text" for
       * ten minutes after a job that `processing_jobs` shows finished in
       * twenty seconds — waited 3s, ran 20s, completed, no error. The
       * backend was never slow.
       *
       * `takeInFlight` is `status === "analyzing" || documentSettle.pending`.
       * The ready path swaps only `progress` and leaves `status` at
       * "analyzing", so the analysis clause carries the screen through the
       * whole document phase. `expire` then sets the HOOK's marker terminal
       * — `pending` goes false — and that clause is still true, with nothing
       * left that can clear it. Not a slow release: no release. Ten minutes
       * is simply when he gave up watching.
       *
       * So expiry ends the wait the same way settling does. "failed" rather
       * than null because it IS the terminal state — `publishIdealText-
       * Unconfirmed` above has just said so — and the failure note is built
       * to stay until the speaker acts (W6), where a silent clear would
       * leave them looking at a document that never arrived with nothing
       * saying why. */
      setProcessingResume((prev) =>
        prev?.sessionId === take.sessionId && prev.status === "analyzing"
          ? { ...prev, status: "failed", progress: null }
          : prev,
      );
    },
  });
  // The ONE in-flight predicate: the analysis phase (chip + resume watch)
  // or the document phase (settle hook). Record holds and the ideal text
  // blocks on the SAME truth, so the two can never disagree about whether
  // a take is being worked.
  const takeInFlight =
    processingResume?.status === "analyzing" || documentSettle.pending;

  const closeProcessingOverlay = useCallback(() => {
    setOpenedProcessingSessionId(null);
    requestAnimationFrame(() =>
      processingTriggerRef.current?.focus({ preventScroll: true }),
    );
  }, []);

  // The open view is pinned to one job identity. Completion, failure, or a
  // replacement marker closes it instead of silently showing another take.
  useEffect(() => {
    if (!openedProcessingSessionId) return;
    if (
      !processingResume ||
      processingResume.sessionId !== openedProcessingSessionId ||
      processingResume.status !== "analyzing"
    ) {
      closeProcessingOverlay();
    }
  }, [openedProcessingSessionId, processingResume, closeProcessingOverlay]);

  /** A FAILED NOTE IS CLEARED BY EVIDENCE, NOT BY TIME (founder 2026-09-21).
   *  While the red note is on screen, useFailedTakeRecheck asks the server
   *  whether the take really failed. W6 keeps the note across idle state
   *  flips; this is not an idle flip — it is the server contradicting it.
   *    recovered → the job finished behind our back: clear the marker, drop
   *                the note, reload so the Take's card shows.
   *    running   → the queue sweep requeued it: put the marker back into the
   *                analysing state and let syncMarker resume the watch.
   *    otherwise → the note stays, exactly as W6 says. */
  function onFailedTakeVerdict(
    sessionId: string,
    verdict: FailedTakeVerdict,
  ): void {
    const marker = readProcessingTake(userId);
    if (verdict === "recovered") {
      clearProcessingTake(userId, sessionId);
      setProcessingResume(null);
      void reload();
      return;
    }
    if (verdict === "running" && marker?.sessionId === sessionId) {
      const now = Date.now();
      writeProcessingTake(userId, {
        ...marker,
        status: "processing",
        phase: "analysis",
        startedAt: now,
        phaseStartedAt: now,
        progress: { stage: "processing_recording", percent: 0 },
      });
    }
  }
  useFailedTakeRecheck({
    sessionId: failedNoteSession(isLabOverlay(state), processingResume),
    onVerdict: onFailedTakeVerdict,
  });

  /** THE CARD MUST NOT OUTLIVE THE FAILURE EITHER (founder 2026-09-24).
   *
   *  The rule above was written for the local note. The Lounge card is
   *  DURABLE, and it is the one the founder was looking at: "we couldn't
   *  create your Ideal Text" sitting directly under the card announcing that
   *  the ideal text is ready. Nothing on any path ever withdrew it.
   *
   *  Same rule, same evidence. While such a card is the newest thing said
   *  about this project's document, ask the server about its take; when the
   *  server says the take is done, the backend has already retracted the card
   *  on that same read, so reloading the thread is all this has to do.
   *
   *  Bounded on purpose: only the NEWEST ideal-text card is watched, so an
   *  honest old failure the speaker has moved on from is not re-probed for
   *  the life of the thread. */
  const unconfirmedCardSession = useMemo<string | null>(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.kind !== "ideal_text") continue;
      const md = m.metadata as Record<string, unknown> | null | undefined;
      if (!md || md.variant !== "ideal_text_unconfirmed") return null;
      return typeof md.take_session_id === "string"
        ? md.take_session_id
        : null;
    }
    return null;
  }, [messages]);
  useFailedTakeRecheck({
    sessionId: unconfirmedCardSession,
    onVerdict: (_sessionId, verdict) => {
      if (verdict === "recovered") void reload();
    },
  });

  /** Re-open the durable backend job against the original stored audio. */
  const retryPreservedProcessing = async () => {
    if (retryingProcessing) return;
    const marker = readProcessingTake(userId);
    if (!marker || marker.status !== "failed") return;
    setRetryingProcessing(true);
    const restarted = await retryLabProcessing(marker.sessionId);
    setRetryingProcessing(false);
    if (!restarted) return;
    const now = Date.now();
    writeProcessingTake(userId, {
      ...marker,
      status: "processing",
      phase: "analysis",
      startedAt: now,
      phaseStartedAt: now,
      progress: { stage: "processing_recording", percent: 0 },
    });
    setProcessingResume({
      sessionId: marker.sessionId,
      takeIndex: marker.takeIndex,
      status: "analyzing",
      startedAt: now,
      progress: { stage: "processing_recording", percent: 0 },
      // Mirrors the marker written immediately above: this retry re-enters
      // audio analysis, so the recording labels are the true ones here.
      phase: "analysis",
      phaseStartedAt: now,
    });
    setResumeWatch({
      sessionId: marker.sessionId,
      takeIndex: marker.takeIndex,
      startedAt: now,
    });
  };

  /** The Take 1 card's primary action. This starts the dedicated document job;
   *  unlike retryPreservedProcessing it never re-enters audio analysis. */
  const retryIdealTextFromCard = async (
    target: IdealTextRetryTarget,
  ): Promise<boolean> => {
    const restarted = await retryIdealTextGeneration(target.takeSessionId);
    if (!restarted) return false;
    const now = Date.now();
    writeProcessingTake(userId, {
      sessionId: target.takeSessionId,
      arcId: target.arcId,
      takeIndex: 1,
      startedAt: now,
      status: "processing",
      phase: "analysis",
      phaseStartedAt: now,
      progress: { stage: "ideal_text", percent: null },
    });
    setProcessingResume({
      sessionId: target.takeSessionId,
      takeIndex: 1,
      status: "analyzing",
      startedAt: now,
      progress: { stage: "ideal_text", percent: null },
      // Mirrors its marker. This job "never re-enters audio analysis", and the
      // `ideal_text` stage already resolves above the audio labels — but the
      // marker says analysis, so this says analysis. One source of truth.
      phase: "analysis",
      phaseStartedAt: now,
    });
    setResumeWatch({
      sessionId: target.takeSessionId,
      takeIndex: 1,
      startedAt: now,
    });
    setOpenedProcessingSessionId(target.takeSessionId);
    return true;
  };

  // Auto-open an offer in the footer, respecting priority so that when several
  // fire at the same post-send moment the most urgent wins the slot (the others
  // remain clickable bubbles in the thread). An explicit bubble tap bypasses
  // this and opens that offer directly.
  const openOffer = useCallback((type: OfferType) => {
    // SD/FE-4 — the joke onboarding is deleted; a legacy joke bubble in an old
    // thread stays visible but inert.
    if (type === "joke") return;
    const rank: Record<OfferType, number> = { joke: 2, install: 1, whatsapp: 0 };
    setActiveOffer((prev) => (prev && rank[prev] >= rank[type] ? prev : type));
  }, []);

  // FE-1 — the eviction-proof source of an arc's prior session id: the newest
  // recording-summary bubble for that arc (server-backed for signed-in). Seeded
  // into the explore arc at the "record next take" sites so the Lab can restore
  // the deck from the server when localStorage lost it.
  const latestArcSessionId = useCallback(
    (arcId: string): string | undefined => {
      for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        if (m.kind !== "recording_summary") continue;
        const md = m.metadata as Record<string, unknown> | null | undefined;
        if (md && md.arc_id === arcId && typeof md.session_id === "string") {
          return md.session_id;
        }
      }
      return undefined;
    },
    [messages],
  );

  // The settle stamp: a recording_summary minted AFTER the thread settled is
  // the "just recorded this session" signal (consumed by the install offer
  // below). The joke onboarding that used to arm here is deleted (SD/FE-4).
  const settleTimeRef = useRef<string | null>(null);
  // FE-4 fix — a synchronous in-flight guard for runSend. botThinking only arms
  // AFTER the awaited user-turn append (a network POST when signed in), leaving
  // a window where a fast double-tap re-enters and double-sends.
  const sendingRef = useRef(false);
  useEffect(() => {
    if (thread.loading) return;
    if (settleTimeRef.current === null) {
      settleTimeRef.current = new Date().toISOString();
    }
  }, [thread.loading]);

  // F2 — surface the install offer once, post-send, on an installable platform.
  // Gated on a FRESH in-session recording (a recording_summary minted after the
  // settle stamp) so a plain reload / status reconcile that lands on
  // review_pending never auto-opens it. hasOffer (+ the ref) dedups the append.
  const installHandledRef = useRef(false);
  useEffect(() => {
    if (thread.loading || settleTimeRef.current === null) return;
    if (state !== "review_pending" || !install.canOffer) return;
    if (installHandledRef.current || hasOffer(messages, "install")) return;
    const settle = settleTimeRef.current;
    const freshSend = messages.some(
      (m) => m.kind === "recording_summary" && m.client_created_at > settle,
    );
    if (!freshSend) return;
    installHandledRef.current = true;
    void thread.append(offerDraft("install"));
    openOffer("install");
  }, [
    state,
    install.canOffer,
    thread.loading,
    messages,
    thread.append,
    openOffer,
  ]);

  // The second offer (founder 2026-10-12): a WhatsApp number for "The feedback
  // from your coach is in!". It waits for the install offer and a free footer;
  // its trigger lives in the hook (same fresh-send gate as install above).
  const whatsapp = useWhatsAppOffer({
    state,
    messages,
    threadLoading: thread.loading,
    append: thread.append,
    settleTimeRef,
    installCanOffer: install.canOffer,
    activeOffer,
    openOffer,
  });

  useEffect(() => {
    // Stick to bottom only if the user hasn't scrolled up. Scroll the container
    // itself (not a sentinel) so the page/viewport never moves.
    if (!atBottomRef.current) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, botThinking]);

  // A NEW BUBBLE IS ALWAYS SHOWN (founder 2026-09-28), even when the thread
  // was scrolled up, and See next steps lands on the newest one. Only a new
  // message moves the thread; reading history otherwise stays where it is.
  usePinThreadBottom(scrollRef, messages.length, thread.loading, didInitScrollRef);

  // U3 — capture the historical baseline once the thread first loads, so only
  // messages that arrive AFTER it (new bot replies) animate.
  useEffect(() => {
    if (baselineRef.current === null && messages.length > 0) {
      baselineRef.current = new Set(messages.map((m) => m.client_id));
    }
  }, [messages]);

  // Track whether the thread is parked at the bottom. Within 80px counts as
  // "at bottom" (sub-pixel rounding + a partially-visible last bubble).
  function handleThreadScroll() {
    const el = scrollRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  // §6c: when the coach publishes (status flips to insights_ready), pull the
  // thread so the BE-appended "insights ready" ping shows in-chat at once — the
  // status card already flips live. The BE is the sole writer; we only re-read.
  useEffect(() => {
    if (state === "insights_ready") void reload();
  }, [state, reload]);

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    const q = draftText.trim();
    // Guard BEFORE clearing the input so a send while the bot is busy keeps the
    // user's text rather than silently dropping it.
    if (!q || botThinking) return;
    setDraftText("");
    await runSend(q);
  }

  // ── R4-2 · LOCKED INVARIANT ────────────────────────────────────────────────
  // Every quick-reply ANSWER a user gives by TAPPING A BUTTON (the joke pills,
  // any "about WillpowerLab" answer buttons, and every future offer button)
  // MUST post through postAnswerBubble. thread.append is the exact persistent
  // path a TYPED message uses — server `lounge_messages` when signed in,
  // localStorage when guest — so a tapped answer survives reload identically to
  // a typed one. Do NOT post an answer via appendLocalOnly (that is bot-turn
  // only, for turns the BE persists) or any non-persisted path. New answer
  // buttons: route the label through here, full stop.
  function postAnswerBubble(label: string) {
    void thread.append({ role: "user", kind: "text", body: label });
  }

  // The shared send core — used by the composer. Returns true when this call
  // actually sent, false when it was a guarded no-op (empty / bot busy / an
  // in-flight send). sendingRef closes the double-send window that botThinking
  // alone leaves open (it only arms after the awaited user-turn append).
  async function runSend(q: string): Promise<boolean> {
    if (!q || botThinking || sendingRef.current) return false;
    sendingRef.current = true;
    // finally guarantees the guard clears on every exit, including a rejected
    // append (else a throw would wedge sendingRef=true and block all sends).
    try {
      // Track upload intent so the footer record button swaps to a file picker
      // (and reverts the moment the user's next message is about something else).
      setUploadAskActive(isUploadAsk(q));
      atBottomRef.current = true; // sending always scrolls to your own message
      const history = loungeToHistory(messages); // snapshot of prior turns (pre-append)
      // The user turn always persists (optimistic + FE write); for signed-in the
      // BE also writes it from the client_id we pass below, and the server dedups
      // on (user_id, client_id) so it collapses to one row (#2).
      const userMsg = await thread.append({
        role: "user",
        kind: "text",
        body: q,
      });

      setBotThinking(true);
      try {
        const activeProject = readExploreArc(userId);
        const resp = await postChatQuery({
          question: q,
          history,
          // #2 — let the BE own persistence for signed-in turns. It writes the
          // user turn with our client_id (dedup) and the bot turn with the chip
          // in its metadata; the FE then shows the bot turn optimistically only.
          persist: thread.signedIn,
          clientId: userMsg.client_id,
          clientCreatedAt: userMsg.client_created_at,
          presentationContext: {
            has_current_project: activeProject !== null,
            completed_takes: activeProject
              ? Math.max(0, activeProject.nextTakeIndex - 1)
              : 0,
            has_pdf: Boolean(activeProject?.deck?.presentationRef),
          },
        });
        // B-1 — the one quick-action the BE suggests for this turn (S1),
        // rendered as an in-bubble chip (trainings / audit).
        const suggested = coerceSuggestedAction(resp.suggested_action);
        const suggestedActions = coerceSuggestedActions(resp.suggested_actions);
        const productAction = productActionFromMetadata({
          product_action: resp.product_action,
        });
        const answer = (resp.answer ?? "").trim();
        // RULE F (seam 1) — the BE owns the bubble split; render `bubbles` 1:1.
        // We persist the joined body and the thread re-splits on the same
        // blank-line marker, so a reload shows exactly the bubbles that were sent.
        const body =
          resp.bubbles && resp.bubbles.length > 0
            ? resp.bubbles.join("\n\n")
            : answer || "I know nothing about that, at least yet 😏";
        const botDraft = {
          role: "bot" as const,
          kind: "text" as const,
          body,
          // B-1 — the chip rides in the bot row's metadata so it survives reload
          // and scroll-back. For signed-in, the BE persists this same row (chip
          // included) — see #2; we show it optimistically without re-persisting
          // to avoid a duplicate. Anonymous → the FE persists it locally.
          metadata: {
            ...(suggestedActions.length > 0
              ? { suggested_actions: suggestedActions }
              : suggested
                ? { suggested_action: suggested }
                : {}),
            ...(productAction ? { product_action: productAction } : {}),
          },
        };
        if (thread.signedIn) {
          const botMessage = thread.appendLocalOnly(botDraft);
          if (resp.persisted) {
            announceDiscoveriesFromPersistedMessages([botMessage]);
          }
        } else {
          await thread.append(botDraft);
        }
      } catch {
        await thread.append({
          role: "bot",
          kind: "text",
          body: "I'm having trouble reaching the lab right now. Give it another try in a moment.",
        });
      } finally {
        setBotThinking(false);
      }
      return true;
    } finally {
      sendingRef.current = false;
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-hidden">
      {/* Founder 2026-07-30 — the status region above the thread is GONE, and
          with it the last top banner. U5 moved the sent confirmation into the
          thread and U6 did the same for insights ready; the parked card was
          the one left, and it announced "Ideal text N.0 is waiting for you"
          directly above the thread's own ideal-text card, which says the same
          thing about the same document and opens it. Two banners for one
          document, one of them outside the conversation the product is. */}
      <div
        ref={scrollRef}
        onScroll={handleThreadScroll}
        /* `overflow-x-hidden` is load-bearing: `overflow-y-auto` alone computes
           overflow-x to auto, so any bubble content wider than the column (a
           long unbroken token, a wide card) makes the WHOLE thread pan
           sideways — every bubble slides off the left edge of the screen. */
        className="scrollbar-none flex flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden overscroll-contain"
      >
        {thread.hasMore && (
          <button
            type="button"
            onClick={() => void thread.loadOlder()}
            disabled={thread.loadingOlder}
            className="mx-auto text-[12px] text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            {thread.loadingOlder ? "Loading…" : "Load earlier messages"}
          </button>
        )}

        {thread.loading ? (
          <LoadingState placement="surface" />
        ) : threadItems.length === 0 ? (
          <LoungeEmptyState onStart={onStartNewProject ?? onStart} />
        ) : (
          threadItems.map((item, i) => item.message.kind === "walk_step" ? (
            <WalkStepBubble
              key={item.reactKey}
              message={item.message}
              card={reviewCardOf(item.message, threadItems)}
              replaced={replacedWords.has(item.message.client_id)}
              waiting={stepWaits(item.message)}
              lockedTake={olderTake(item.message.metadata)}
              onOpened={() => setSeenUpdates(keepSeenUpdate(item.message.client_id))}
              onOpenIdealText={openIdealText}
            />
          ) : item.message.metadata?.summary === true ? (
            <SummaryBubble key={item.reactKey} message={item.message} />
          ) : (
            <Bubble
              key={item.reactKey}
              message={item.message}
              onOpenBestPresentation={(arcId) =>
                openIdealText(arcId)
              }
              onOpenTranscripts={() => setLibraryOpen(true)}
              // A GUEST'S WAY BACK TO THE TEXT (founder live test
              // 2026-10-05): the coach's feedback page needs an account, and
              // a guest gets no "your text is ready" bubble, so a guest's
              // recording bubble opens the Ideal Text it made.
              onOpenFeedback={
                thread.signedIn
                  ? setFeedbackTarget
                  : (target) => openIdealText(target.arcId)
              }
              onOpenIdealText={openIdealText}
              latestForArc={latestIdealIds.has(item.message.client_id)}
              onRetryIdealText={retryIdealTextFromCard}
              onOpenConfidencePractice={setConfidencePracticeId}
              onChip={onChip}
              activeOffer={activeOffer}
              onOpenOffer={setActiveOffer}
              animate={
                i === threadItems.length - 1 &&
                baselineRef.current !== null &&
                !baselineRef.current.has(item.message.client_id)
              }
            />
          ))
        )}

        {/* While a Take processes (founder lock 2026-10-12, section 1): a
            bubble in the chat with the breathing mark; its tap opens the
            processing view. */}
        {processingResume?.status === "analyzing" ? (
          <div className="mr-auto flex max-w-[88%] items-end gap-1.5">
            <ChatAvatar />
            <button
              ref={processingTriggerRef}
              type="button"
              aria-haspopup="dialog"
              onClick={() => setOpenedProcessingSessionId(processingResume.sessionId)}
              className="flex items-center gap-2.5 rounded-[16px] bg-muted px-3 py-2 text-left text-[15px] leading-[1.45] text-foreground"
            >
              <VoiceMark size={64} />
              <span>{PROCESSING_STAGES[0]}</span>
            </button>
          </div>
        ) : null}

        {/* Out of tokens — the paid plans as tappable chips, one tap to
            Stripe. FIRST of the in-thread cards on purpose: being unable to
            continue outranks an optional profile question. Stacking is
            allowed and needs no logic (founder ruling) — if someone qualifies
            for two cards they render as two bubbles, each with its own gate,
            neither knowing the other exists. */}
        <LoungeTopUpCard state={state} threadLoading={thread.loading} />

        {botThinking && <TypingDots />}
      </div>

      {/* The coach's one door (founder 2026-09-30, A1): the walk. Coaches can
          still record, so this sits above the record CTA, not instead of it. */}
      {isCoach && <CoachWalkEntry />}

      {/* Async analysis (delivery layer): a take left mid-analysis (closed tab /
          locked phone) keeps finishing server-side — this chip resumes a calm
          indicator from the persisted marker and clears itself when done. */}
      {processingResume?.status === "failed" ? (
        <p className="mb-1.5 flex items-center justify-center gap-2 rounded-full bg-destructive/10 px-4 py-1.5 text-center text-[13px] text-destructive">
          {FLOW_COPY.failed}
        </p>
      ) : null}
      {/* Failure keeps its damage-bounding line before the retry. Active
          processing deliberately has only the approved primary status; that
          status becomes the doorway back into the processing view. */}
      {processingResume?.status === "failed" ? (
        <p className="mb-1.5 px-4 text-center text-[12px] leading-relaxed text-muted-foreground">
          {FLOW_COPY.failedNext}
        </p>
      ) : null}
      {processingResume?.status === "failed" ? (
        <Button
          type="button"
          variant="outline"
          disabled={retryingProcessing}
          onClick={() => void retryPreservedProcessing()}
          className="mb-2 h-10 w-full rounded-full"
        >
          {retryingProcessing ? "Restarting…" : "Try processing again"}
        </Button>
      ) : null}

      {/* The record-button slot. While an offer is "armed" (freshly triggered,
          or re-opened by tapping its thread bubble) its action pair REPLACES the
          black record button; resolving it returns the record button (U2). The
          offer's prompt + outcome live in the thread as durable bubbles. */}
      {activeOffer ? (
        <OfferActions
          type={activeOffer}
          install={install}
          whatsapp={whatsapp}
          onResolve={() => setActiveOffer(null)}
        />
      ) : uploadAskActive ? (
        // The user asked to upload — the record button becomes a file picker.
        // Picking a file stashes it and opens the Lab, which collects the topic
        // (analysis needs it) then submits the upload (deckless).
        <>
          <input
            ref={uploadFileRef}
            type="file"
            accept="audio/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              const err = validateAudioUpload(f);
              if (err) {
                setUploadPickError(err);
                return;
              }
              setUploadPickError(null);
              stageLabUpload(f);
              setUploadAskActive(false);
              // A staged upload is a standalone deckless file, never a take of
              // a project — skip the picker so the Lab mounts on the same tick
              // and consumes the staged File atomically (review R-pp2).
              (onStartInProject ?? onStart)();
            }}
            className="hidden"
          />
          <Button
            type="button"
            onClick={() => uploadFileRef.current?.click()}
            className="h-12 w-full gap-2 rounded-full bg-foreground text-background hover:bg-foreground/90"
          >
            <Upload className="h-4 w-4" aria-hidden />
            Upload a recording
          </Button>
          {uploadPickError ? (
            <p className="mt-1.5 text-center text-[13px] text-destructive">
              {uploadPickError}
            </p>
          ) : null}
        </>
      ) : // FE-2 (founder 2026-07-27) — the full-width "Start official
      // recording" CTA is DELETED. The record affordance is the small control
      // inside the composer and nothing else, so there is no second, louder
      // button competing with it. The upload picker above keeps its own
      // full-width button: it is a different action, and it only appears when
      // the user has asked to upload.
      null}

      {/* Wave-3 — no standing chip row above the composer; quick actions are
          single in-thread buttons (A-4 / B-1). Footer is just the CTA + input. */}
      {/* A5 — the send button lives INSIDE the input (right edge): grey when the
          field is empty, black once there's text. A4 — the input height (h-12)
          matches the record CTA. B3 — "Will" persona in the placeholder + aria. */}
      {/* Typing "#" alone opens the tag list. Renders nothing when the layer is
          off, and nothing when the draft is not a leading "#" token. */}
      {lifeTags.enabled && (
        <LifeTagPicker
          draft={draftText}
          entries={lifeTags.entries}
          onPick={(tag) => {
            setDraftText((current) => applyPick(current, tag));
            composerRef.current?.focus();
          }}
        />
      )}

      {/* FE-2 (founder 2026-07-27, revised) — the record control is its own
          bordered button NEXT TO the text input, not inside it. Two controls
          on one row, and everything fits on a single line at every width:
          the input flexes and the button takes only what it needs.

          Send lives inside the input and only exists once there is something
          to send. That is where the input's width comes back — an empty field
          pays nothing for a button that could not be pressed anyway, which is
          the "measurably wider input" the original story wanted and could not
          get by removing a "+" this composer never had. */}
      {reviewToContinue ? (
        <button
          type="button"
          data-testid="continue-review"
          onClick={() => openIdealText(reviewToContinue, "review")}
          className="mb-2 flex h-[46px] w-full items-center justify-center rounded-full bg-foreground text-[15px] font-semibold text-background"
        >
          Continue review
        </button>
      ) : null}
      <form onSubmit={handleSend} className="flex items-end gap-1">
        {/* THE "+" (founder 2026-10-12, WhatsApp-like): it opens the
            projects, where "Start a new project" starts one. It replaced the
            Record button. Held while a Take is still landing, for the same
            reason that button was (the spoken take count is the version). */}
        <button
          type="button"
          onClick={onStart}
          disabled={takeInFlight}
          aria-label="Your projects"
          title={takeInFlight ? FLOW_COPY.recordHeld : undefined}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted disabled:cursor-default disabled:text-muted-foreground/50 disabled:hover:bg-transparent"
        >
          <Plus className="h-5 w-5" aria-hidden />
        </button>
        <div className="relative flex-1">
          <textarea
            ref={composerRef}
            rows={1}
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            onKeyDown={(e) => {
              // R4-12 — Enter sends; Shift+Enter inserts a newline.
              // requestSubmit fires the form's onSubmit (handleSend) with a
              // real submit event.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            // Founder 2026-07-27. Short by design: it sits on one line at the
            // narrowest supported width, where the original copy wrapped to
            // two and made a chat field read as a text area.
            placeholder="Type here"
            /* B9 — kill any autofill / password-manager overlay that can ghost
               a second line of placeholder text over a chat composer. R4-12 —
               autocorrect ON now (this is prose, not a password field). */
            autoComplete="off"
            autoCorrect="on"
            autoCapitalize="sentences"
            spellCheck
            /* `scrollbar-none` + `overflow-x-hidden`: past the 160px cap the
               field does scroll, but a bar inside a rounded chat input reads as
               a broken control, and a textarea has no business scrolling
               sideways at all — it soft-wraps. */
            className={`scrollbar-none block max-h-40 min-h-[40px] w-full resize-none overflow-x-hidden rounded-3xl border border-border bg-background py-2 pl-3.5 text-[15px] leading-snug outline-none focus:border-primary ${
              draftText.trim() ? "pr-12" : "pr-4"
            }`}
            aria-label="Message Will"
          />
          {/* Only once there is text: an always-present grey Send is a button
              that cannot be pressed, and it costs the field 32px to say so. */}
          {draftText.trim() ? (
            <button
              type="submit"
              disabled={botThinking}
              aria-label="Send"
              className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full text-foreground transition-colors disabled:cursor-default disabled:text-muted-foreground"
            >
              <Send className="h-5 w-5" />
            </button>
          ) : null}
        </div>
      </form>

      {/* Delivery layer — the 4 bubbles' destinations. */}
      {feedbackTarget && (
        <FeedbackOverlay
          arcId={feedbackTarget.arcId}
          takeSessionId={feedbackTarget.takeSessionId}
          takeIndex={feedbackTarget.takeIndex}
          onClose={() => setFeedbackTarget(null)}
        />
      )}
      {idealTextArcId && (
        <IdealTextOverlay
          arcId={idealTextArcId}
          initialMode={idealTextLaunchMode}
          reviewAt={idealTextReviewAt}
          // W4/W5 — while a take is in flight (EITHER phase: analysing, or
          // the document still assembling) the overlay shows its blocking
          // state instead of last take's words; when this flips false (the
          // settle hook resolves) the overlay refetches, so a completion
          // that lands while the student is READING arrives in place too.
          analysisPending={takeInFlight}
          onClose={() => {
            // The dot follows what was opened (Q40 B, Q42 A).
            refreshLiveIdealDoc(idealTextArcId);
            // So does the "new" outline: read again once the walk's shows
            // have landed (D-FW-19).
            if (thread.signedIn) void refreshNewCoachFeedback();
            setIdealTextArcId(null);
            setIdealTextLaunchMode("notebook");
          }}
          // SD — "Read it aloud": the re-read is just another recording. Seed
          // THIS presentation (only when the cache holds a different arc; the
          // BE reconciles the real take index on upload) and open the Lab.
          onReadAloud={(version) => {
            const arcId = idealTextArcId;
            const cached = readExploreArc(userId);
            if (cached?.arcId !== arcId) {
              // Seed the next-take index from the SD version hint (≈ takes so
              // far); the BE reconciles the real take_index on upload.
              writeExploreArc(
                userId,
                arcId,
                (version ?? 0) + 1,
                undefined,
                latestArcSessionId(arcId),
              );
            }
            setIdealTextArcId(null);
            // The arc is already seeded above — never ask WHICH project.
            (onStartInProject ?? onStart)();
          }}
        />
      )}
      {confidencePracticeId && (
        <ConfidencePracticeOverlay
          practiceId={confidencePracticeId}
          onClose={() => setConfidencePracticeId(null)}
        />
      )}
      {libraryOpen && (
        <LibraryOverlay
          onClose={() => setLibraryOpen(false)}
          onOpenBestPresentation={(arcId) => openIdealText(arcId)}
          onRecordAnother={(arc) => {
            // Continue this deck's arc: seed the explore-arc (id + next index +
            // deck) so the Lab carries arc_id and pre-fills the deck, then open
            // the Lab. The BE appends the take to the same arc. The session id
            // (FE-1) lets the Lab re-fetch the deck from the server if the
            // cached one is stale/incomplete; trainings-mode arcs pass their
            // own (latest take's) id, else derive from the thread. A deckless
            // seed (trainings mode carries no slide bodies) must not WIPE a
            // deck already cached for this same arc — keep it.
            const cached = readExploreArc(userId);
            const deck =
              arc.deck ??
              (cached?.arcId === arc.arcId ? cached.deck : undefined);
            writeExploreArc(
              userId,
              arc.arcId,
              arc.nextTakeIndex,
              deck,
              arc.sessionId ?? latestArcSessionId(arc.arcId),
            );
            setLibraryOpen(false);
            // The arc is seeded immediately above — never ask WHICH project
            // (the picker's new-topic exit would clear it, and the take would
            // mint a new project instead of joining this one — review R-pp0).
            (onStartInProject ?? onStart)();
          }}
        />
      )}

      {openedProcessingSessionId &&
      processingResume?.sessionId === openedProcessingSessionId &&
      processingResume.status === "analyzing" ? (
        <ProcessingResumeOverlay
          progress={processingResume.progress}
          phase={processingResume.phase}
          cycleStartedAt={processingResume.startedAt}
          phaseStartedAt={processingResume.phaseStartedAt}
          onClose={closeProcessingOverlay}
        />
      ) : null}
    </div>
  );
}

/** B-1 — a single intent-driven quick-action button (from the BE's
 *  suggested_action, S1). Lives inside the bot bubble it came with, persists
 *  in thread history, and is always clickable (action is idempotent). */
function ActionButton({
  action,
  onClick,
}: {
  action: ChipAction;
  onClick: () => void;
}) {
  return (
    <div className="mr-auto flex max-w-[85%]">
      <button
        type="button"
        onClick={onClick}
        className="self-start rounded-full border border-border px-3 py-2 text-[15px] text-foreground transition-colors hover:border-primary/50"
      >
        {CHIP_LABEL[action]}
      </button>
    </div>
  );
}

/** The footer action pair for the currently-armed offer — it replaces the
 *  record button. The matching prompt bubble already lives in the thread; here
 *  we only render the grey/orange pair (install delegates to its platform-aware
 *  actions) and call onResolve to return the record button once the user picks. */
function OfferActions({
  type,
  install,
  whatsapp,
  onResolve,
}: {
  type: OfferType;
  install: InstallOffer;
  whatsapp: WhatsAppOffer;
  onResolve: () => void;
}) {
  if (type === "install") {
    return <InstallOfferActions offer={install} onResolve={onResolve} />;
  }
  if (type === "whatsapp") {
    return <WhatsAppOfferActions offer={whatsapp} onResolve={onResolve} />;
  }
  // The legacy joke offer is the only other type. Its onboarding was deleted
  // (SD/FE-4) and openOffer already refuses to arm it, so this is a dismiss-only
  // fallback for an old thread bubble rather than a live action pair.
  return (
    <SymmetricPair
      closeLabel="Close"
      onClose={onResolve}
      actionLabel="Close"
      onAction={onResolve}
    />
  );
}

/** U4 — animated "librarian is typing" indicator. Three dots bouncing out of
 *  phase (staggered negative animation-delays) in a bot-side bubble. Replaces
 *  the static "…" so the wait reads as a live, responsive chat — and pairs with
 *  the U3 bubble-split (typing → a few short bubbles land). */
function TypingDots() {
  return (
    <div
      role="status"
      aria-label="Librarian is typing"
      className="mr-auto flex items-center gap-1 rounded-2xl bg-muted px-3.5 py-3"
    >
      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60" />
    </div>
  );
}

/** U3 — gap between sequentially-revealed bubbles (ms of "typing"). */
const CHUNK_DELAY_MS = 750;

/** U3 — render a bot message's split chunks. A freshly-arrived reply
 *  (`animate`) reveals them one at a time with a typing indicator between, so
 *  it reads like a person sending a few short messages. Historical messages,
 *  single-chunk messages, and reduced-motion users render everything at once. */
function SequentialBotBubbles({
  chunks,
  animate,
}: {
  chunks: string[];
  animate: boolean;
}) {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    setReduceMotion(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
  }, []);

  const shouldAnimate = animate && !reduceMotion && chunks.length > 1;
  const [revealed, setRevealed] = useState(shouldAnimate ? 1 : chunks.length);

  useEffect(() => {
    if (!shouldAnimate) {
      setRevealed(chunks.length); // instant: historical / single / reduced-motion
      return;
    }
    if (revealed >= chunks.length) return;
    const id = setTimeout(() => setRevealed((n) => n + 1), CHUNK_DELAY_MS);
    return () => clearTimeout(id);
  }, [shouldAnimate, revealed, chunks.length]);

  const stillTyping = shouldAnimate && revealed < chunks.length;

  return (
    <div className="mr-auto flex max-w-[85%] flex-col gap-1.5">
      {chunks.slice(0, revealed).map((part, i) => (
        <div
          key={`${i}-${part.slice(0, 12)}`}
          className="whitespace-pre-wrap break-words rounded-2xl bg-muted px-3 py-2 text-[15px] text-foreground"
        >
          {/* FE-13 — Will's replies carry booking links; they were dead text. */}
          <Linkified text={part} />
        </div>
      ))}
      {stillTyping ? <TypingDots /> : null}
    </div>
  );
}

function Bubble({
  message,
  onViewInsights,
  onOpenBestPresentation,
  onOpenTranscripts,
  onOpenFeedback,
  onOpenIdealText,
  onRetryIdealText,
  onOpenConfidencePractice,
  onChip,
  activeOffer,
  onOpenOffer,
  animate = false,
  latestForArc = false,
}: {
  message: LoungeMessage;
  /** The project's latest Ideal Text bubble: it wears the dot (Q39 B). */
  latestForArc?: boolean;
  onViewInsights?: (sessionId: string) => void;
  /** C — open BestPresentationOverlay from the best_presentation_ready card. */
  onOpenBestPresentation?: (arcId: string) => void;
  /** transcript_ready card — opens the Trainings library. */
  onOpenTranscripts?: () => void;
  /** Delivery layer — the grey feedback bubbles open their take's page. */
  onOpenFeedback?: (target: FeedbackBubbleTarget) => void;
  /** Delivery layer — every ideal-text bubble opens the live notebook. */
  onOpenIdealText?: (arcId: string, mode?: IdealTextLaunchMode) => void;
  onRetryIdealText?: (
    target: IdealTextRetryTarget,
  ) => boolean | Promise<boolean>;
  /** Coach-shared exercise opens independently of the three-take journey. */
  onOpenConfidencePractice?: (practiceId: string) => void;
  onChip?: (action: ChipAction) => void;
  /** F1/F2/F7 — which offer's action pair is currently armed (for the ring). */
  activeOffer?: OfferType | null;
  /** Tap a persisted offer bubble to re-arm its action pair in the footer. */
  onOpenOffer?: (type: OfferType) => void;
  /** U3 — true only for a freshly-arrived last message → sequential reveal. */
  animate?: boolean;
}) {
  const offerType = readOfferType(message.metadata);
  if (offerType) {
    return (
      <OfferBubble
        type={offerType}
        body={message.body}
        active={activeOffer === offerType}
        onOpen={() => onOpenOffer?.(offerType)}
      />
    );
  }
  if (
    message.kind === "recording_summary" ||
    message.kind === "insight" ||
    message.kind === "best_presentation_ready" ||
    message.kind === "transcript_ready" ||
    message.kind === "feedback" ||
    message.kind === "ideal_text"
  ) {
    return (
      <ReportCard
        message={message}
        onViewInsights={onViewInsights}
        onOpenBestPresentation={onOpenBestPresentation}
        onOpenTranscripts={onOpenTranscripts}
        onOpenFeedback={onOpenFeedback}
        onOpenIdealText={onOpenIdealText}
        onRetryIdealText={onRetryIdealText}
        latestForArc={latestForArc}
      />
    );
  }
  if (message.role === "user") {
    return (
      <div className="ml-auto max-w-[85%] whitespace-pre-wrap break-words rounded-2xl bg-primary px-3 py-2 text-[15px] text-primary-foreground">
        {/* FE-13 — both sides of the thread, so a link the user pasted works
            the same as one Will sent. */}
        <Linkified text={message.body} />
      </div>
    );
  }
  if (message.role === "bot") {
    const productAction = productActionFromMetadata(message.metadata);
    const productDestination = productAction
      ? productSpec(productAction.product)
      : null;
    const confidenceCorrection =
      message.metadata?.confidence_material_correction === true &&
      typeof message.metadata?.arc_id === "string" &&
      typeof message.metadata?.take_session_id === "string"
        ? {
            arcId: message.metadata.arc_id,
            takeSessionId: message.metadata.take_session_id,
            takeIndex: null,
          }
        : null;
    const sharedPracticeId =
      message.metadata?.note === "confidence_practice_shared" &&
      typeof message.metadata?.practice_id === "string"
        ? message.metadata.practice_id
        : null;
    // B-1 — read the persisted action from metadata; render below the bubbles.
    const actions =
      onChip && message.metadata
        ? (() => {
            const many = coerceSuggestedActions(
              message.metadata.suggested_actions,
            );
            if (many.length > 0) return many;
            const one = coerceSuggestedAction(
              message.metadata.suggested_action,
            );
            return one ? [one] : [];
          })()
        : [];
    return (
      <>
        {/* U3 (bubble-split): multi-paragraph answers reveal sequentially. */}
        <SequentialBotBubbles
          chunks={splitBotMessage(message.body)}
          animate={animate}
        />
        {productDestination ? (
          <div className="mr-auto pt-1">
            <Button
              asChild
              variant="outline"
              className="h-9 rounded-full px-4 text-[13px]"
            >
              <Link href={productDestination.href}>
                {productDestination.actionLabel}
              </Link>
            </Button>
          </div>
        ) : null}
        {confidenceCorrection ? (
          <div className="mr-auto pt-1">
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-full px-4 text-[13px]"
              onClick={() => onOpenFeedback?.(confidenceCorrection)}
            >
              Review coach feedback
            </Button>
          </div>
        ) : null}
        {sharedPracticeId ? (
          <div className="mr-auto pt-1">
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-full px-4 text-[13px]"
              onClick={() => onOpenConfidencePractice?.(sharedPracticeId)}
            >
              Open exercise
            </Button>
          </div>
        ) : null}
        {actions.length > 0 ? (
          <div className="mr-auto flex max-w-[90%] flex-wrap gap-2 pt-1">
            {actions.map((action) => (
              <ActionButton
                key={action}
                action={action}
                onClick={() => onChip!(action)}
              />
            ))}
          </div>
        ) : null}
        {/* FE-5 — the life card rides in metadata exactly like the B-1 chip
            above, so it survives reload and scroll-back without a second write
            path. A turn that carried none passes undefined and renders null,
            which is every turn for a user who is not on the panel. */}
        <LifeChatCard raw={message.metadata?.life_card} />
      </>
    );
  }
  // system / status → centered meta line
  return (
    <div className="mx-auto max-w-[90%] break-words text-center text-[12px] text-muted-foreground">
      {message.body}
    </div>
  );
}

function LoungeEmptyState({ onStart }: { onStart: () => void }) {
  // ONE BUTTON, CENTRED, NOTHING ELSE (founder 2026-10-12). With no project
  // yet there is nothing to choose between, so it goes straight to the new
  // project's onboarding; the "+" beside the message box opens the projects.
  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <button
        type="button"
        onClick={onStart}
        className="flex h-12 items-center justify-center gap-2.5 whitespace-nowrap rounded-full bg-foreground px-6 text-[15px] font-medium text-background transition-colors hover:bg-foreground/90 active:scale-[0.99]"
      >
        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" aria-hidden />
        Start your first recording
      </button>
    </div>
  );
}

/** The project whose review waits in the thread: the newest walk step's,
 *  unless it is the review's end or its closing summary (the summary is the
 *  last step: seen, the review is finished). Null: nothing to continue. */
export function continueReviewArc(items: readonly ThreadItem[]): string | null {
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i];
    if (item.kind !== "message") continue;
    if (item.message.metadata?.summary === true) return null;
    if (item.message.kind !== "walk_step") continue;
    const meta = item.message.metadata ?? {};
    if (meta.step === "share" || meta.coach_update === true) continue;
    if (meta.step === "end") return null;
    return typeof meta.arc_id === "string" ? meta.arc_id : null;
  }
  return null;
}

/** The step the review `arc` waits on (lock 2026-10-12, section 1, the
 *  orange outline): its newest step, while that is the app's or the
 *  coach's. Null: none. */
export function waitingStepId(items: readonly ThreadItem[], arc: string | null): string | null {
  if (!arc) return null;
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const m = items[i].message;
    const meta = m.metadata ?? {};
    if (m.kind !== "walk_step" || meta.step === "share" || meta.coach_update === true) continue;
    return m.role === "bot" && meta.arc_id === arc ? m.client_id : null;
  }
  return null;
}

/** The review's Ideal Text card before its summary (lock 2026-10-12,
 *  section 3): the summary is written while its step shows, the card when
 *  the speaker moves past it, so the card is moved up to the summary. */
export function cardBeforeSummary(items: ThreadItem[]): ThreadItem[] {
  const out = [...items];
  for (let i = 0; i < out.length; i += 1) {
    const take = out[i].message.metadata?.summary === true ? out[i].message.metadata?.take_session_id : null;
    if (typeof take !== "string") continue;
    const end = out.findIndex(
      (x, j) => j > i && x.message.kind === "walk_step" && x.message.metadata?.step === "end" && x.message.metadata?.take_session_id === take,
    );
    if (end < 0) continue;
    out.splice(i, 0, ...out.splice(end, 1));
    i += 1;
  }
  return out;
}

/** The Take of an older review, once the thread holds a newer Take of the
 *  same project (lock 2026-10-12, section 2.3: "🔒 Take N"); null for the
 *  newest Take or one whose number is not known. The numbers come from the
 *  review steps and the summaries. */
export function olderTakeOf(items: readonly ThreadItem[]): (meta?: Record<string, unknown> | null) => number | null {
  const of = new Map<string, number>();
  const newest = new Map<string, number>();
  for (const { message } of items) {
    const m = message.metadata ?? {};
    if (typeof m.take_index !== "number" || typeof m.take_session_id !== "string" || typeof m.arc_id !== "string") continue;
    of.set(m.take_session_id, m.take_index);
    newest.set(m.arc_id, Math.max(newest.get(m.arc_id) ?? 0, m.take_index));
  }
  return (meta) => {
    const n = typeof meta?.take_session_id === "string" ? of.get(meta.take_session_id) : undefined;
    const last = typeof meta?.arc_id === "string" ? newest.get(meta.arc_id) : undefined;
    return n !== undefined && last !== undefined && n < last ? n : null;
  };
}

const SEEN_UPDATES = "lounge-coach-updates-seen";

/** The coach updates this browser has opened (their orange outline goes). */
function readSeenUpdates(): ReadonlySet<string> {
  try {
    const list: unknown = JSON.parse(window.localStorage.getItem(SEEN_UPDATES) ?? "[]");
    return new Set(Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

function keepSeenUpdate(id: string): (seen: ReadonlySet<string>) => ReadonlySet<string> {
  return (seen) => {
    if (seen.has(id)) return seen;
    const next = new Set([...seen, id]);
    try {
      window.localStorage.setItem(SEEN_UPDATES, JSON.stringify([...next].slice(-200)));
    } catch {
      // Not kept: it shows as new again next time.
    }
    return next;
  };
}

/** One step of a review, lens off (founder lock 2026-10-12, section 1): the
 *  speaker's orange on the right, the app's and the coach's light grey on
 *  the left with a small avatar (the coach's grey-blue); 15px text, 16px
 *  corners, 20px avatar. A tap turns the lens back on. */
function WalkStepBubble({
  message,
  card,
  replaced = false,
  waiting = false,
  lockedTake = null,
  onOpened,
  onOpenIdealText,
}: {
  message: LoungeMessage;
  /** The review's end: its Ideal Text card's words; null otherwise. */
  card: { title: string; take: number | null } | null;
  /** Helper words a later pick replaced: struck through. */
  replaced?: boolean;
  /** The step still waits, or a coach update not yet opened: the orange outline. */
  waiting?: boolean;
  /** An older Take's step, its number: history, with no ›. */
  lockedTake?: number | null;
  onOpened?: () => void;
  onOpenIdealText?: (arcId: string, mode?: IdealTextLaunchMode, at?: WalkStepTarget | null) => void;
}) {
  const meta = message.metadata ?? {};
  const arc = typeof meta.arc_id === "string" ? meta.arc_id : null;
  if (meta.step === "end") {
    // The project's first slide on the card; no `deck` from the server keeps the plain tile.
    const deck = meta.deck && typeof meta.deck === "object" ? (meta.deck as { presentation_ref?: unknown }) : null;
    const slideRef = deck ? (typeof deck.presentation_ref === "string" ? deck.presentation_ref : null) : undefined;
    return arc && card ? (
      <IdealTextCardBubble title={card.title} take={card.take} slideRef={slideRef} onOpen={() => onOpenIdealText?.(arc)} />
    ) : null;
  }
  const clip = walkClipOf(meta.clip);
  if (!message.body.trim() && !clip) return null;
  const mine = message.role === "user";
  const open = arc ? stepTap(meta, arc, lockedTake, onOpenIdealText, onOpened) : undefined;
  const hint = helpersHint(meta, lockedTake);
  const label = chatLabelOf(meta);
  const ai = clip || mine ? null : aiVoiceOfMeta(meta);
  return (
    <>
      {label ? <div className="self-center pt-1.5 text-[11.5px] text-muted-foreground">{label}</div> : null}
      {ai ? (
        <LoungeAiVoiceBubble
          body={message.body}
          practiceId={ai.practiceId}
          then={ai.then}
          seed={message.client_id}
          avatar={<ChatAvatar />}
          onOpen={open}
        />
      ) : clip ? (
        <ClipBubble clip={clip} seed={message.client_id} caption={message.body.trim() || null} />
      ) : mine ? (
        <div className="flex justify-end">
          <button
            type="button"
            data-walk-step-bubble
            onClick={open}
            className="max-w-[85%] whitespace-pre-wrap break-words rounded-[16px] bg-primary px-3 py-2 text-left text-[15px] leading-[1.45] text-primary-foreground"
          >
            <span className={replaced ? "line-through opacity-70" : undefined}>{message.body}</span>
          </button>
        </div>
      ) : (
        <AppStepBubble message={message} open={open} hint={hint} waiting={waiting && open !== undefined} />
      )}
    </>
  );
}


/** What a step's tap opens: that Take's step, found by its paragraph,
 *  answered or not. An older Take's steps are history, with no ›
 *  (prototype v31); an old judging bubble opens Other speakers afresh
 *  (founder 2026-10-13), and a coach update the coach's word on the latest
 *  Take's page. Sharing opens the sharing step. */
function stepTap(
  meta: Record<string, unknown>,
  arc: string,
  lockedTake: number | null,
  onOpenIdealText?: (arcId: string, mode?: IdealTextLaunchMode, at?: WalkStepTarget | null) => void,
  onOpened?: () => void,
): (() => void) | undefined {
  const step = typeof meta.step === "string" ? meta.step : null;
  const free = step === "others" || meta.coach_update === true;
  if (lockedTake !== null && !free) return undefined;
  if (step === "share") return () => onOpenIdealText?.(arc, "share");
  const target: WalkStepTarget | null = step
    ? {
        step,
        moment: typeof meta.moment === "number" ? meta.moment : null,
        take: free || typeof meta.take_session_id !== "string" ? null : meta.take_session_id,
        part: typeof meta.part_id === "string" ? meta.part_id : null,
      }
    : null;
  return () => {
    onOpened?.();
    onOpenIdealText?.(arc, "review", target);
  };
}

/** The helper words' hint: "Tap the words", or "🔒 Take N" once a newer
 *  Take exists (lock 2026-10-12, section 2.3). */
function helpersHint(meta: Record<string, unknown>, lockedTake: number | null): string | undefined {
  if (meta.step !== "helpers") return undefined;
  return lockedTake !== null ? `🔒 Take ${lockedTake}` : CHUNK_SHEET_COPY.cardTapWords;
}

/** The app's or the coach's step in the chat: light grey on the left; the
 *  exercise's video as a thumb under its first line (prototype v31
 *  `vthumb`, the lens plays it), and the small hint line under it. */
function AppStepBubble({
  message,
  open,
  hint: shownHint,
  waiting = false,
}: {
  message: LoungeMessage;
  open?: () => void;
  hint?: string;
  waiting?: boolean;
}) {
  const meta = message.metadata ?? {};
  const hint = shownHint ?? (typeof meta.hint === "string" ? meta.hint : null);
  const fresh = freshWordsOf(meta.new_words, message.body);
  const video = typeof meta.video === "string" && meta.video ? meta.video : null;
  const nl = message.body.indexOf("\n");
  const cut = video ? (nl >= 0 ? nl : message.body.length) : -1;
  return (
    <div className="mr-auto flex max-w-[88%] items-end gap-1.5">
      <ChatAvatar coach={meta.author === "coach"} />
      <button
        type="button"
        data-walk-step-bubble
        onClick={open}
        className={`relative whitespace-pre-wrap break-words rounded-[16px] bg-muted py-2 pl-3 text-left text-[15px] leading-[1.45] text-foreground ${open ? "pr-[30px]" : "pr-3"} ${waiting ? "ring-2 ring-primary" : ""}`}
      >
        {cut > 0 ? (
          <>
            {message.body.slice(0, cut)}
            <ExerciseThumb src={video as string} />
            {message.body.slice(cut + 1)}
          </>
        ) : fresh ? (
          <>
            {fresh.head}
            {fresh.pieces.map((p, i) => (
              <span key={i} className={p.fresh ? "text-primary" : undefined}>
                {p.text}
              </span>
            ))}
          </>
        ) : (
          message.body
        )}
        {hint ? <span className="mt-[3px] block text-[12.5px] text-muted-foreground">{hint}</span> : null}
        {open ? (
          <span aria-hidden="true" className="absolute right-[11px] top-1/2 -translate-y-1/2 text-[20px] text-muted-foreground">
            ›
          </span>
        ) : null}
      </button>
    </div>
  );
}

/** A clearer version's last line as its pieces, the words that arrive
 *  orange (prototype v31 `.new em`); null when the bubble has none or its
 *  words are not the pieces'. */
function freshWordsOf(value: unknown, body: string): { head: string; pieces: { text: string; fresh?: boolean }[] } | null {
  if (!Array.isArray(value)) return null;
  const pieces = value.filter(
    (p): p is { text: string; fresh?: boolean } => !!p && typeof p === "object" && typeof (p as { text?: unknown }).text === "string",
  );
  const head = body.slice(0, body.lastIndexOf("\n") + 1);
  return pieces.map((p) => p.text).join("").trim() === body.slice(head.length).trim() ? { head, pieces } : null;
}

type WalkChatClip = {
  src: string | null;
  start_ms: number | null;
  duration_ms: number | null;
  words: { text: string; cut?: boolean }[] | null;
};

/** The speaker's clip a walk step carries; null when none. */
function walkClipOf(value: unknown): WalkChatClip | null {
  if (!value || typeof value !== "object") return null;
  const c = value as Partial<WalkChatClip>;
  return {
    src: typeof c.src === "string" ? c.src : null,
    start_ms: typeof c.start_ms === "number" ? c.start_ms : null,
    duration_ms: typeof c.duration_ms === "number" ? c.duration_ms : null,
    words: Array.isArray(c.words) ? c.words : null,
  };
}

/** The line above a moment in the chat (prototype v31 `.meta-l`): "Slide 2 ·
 *  moment 1 of 2", "Moment 1 of 2" with no slide, or "Slide 3". */
export function chatLabelOf(meta: Record<string, unknown>): string | null {
  if (typeof meta.heading === "string") return meta.heading;
  const slide = typeof meta.slide_label === "string" ? meta.slide_label : null;
  const n = meta.green_n;
  const of = meta.green_of;
  if (typeof n !== "number" || typeof of !== "number" || n < 1) return slide;
  return slide ? `${slide} · moment ${n} of ${of}` : `Moment ${n} of ${of}`;
}

/** The speaker's own clip in the chat (prototype v31 `.lb.me.aud`): an
 *  orange bubble on the right, 78% wide, their words above the player where
 *  the feedback is about them, with what goes struck. */
function ClipBubble({ clip, seed, caption = null }: { clip: WalkChatClip; seed: string; caption?: string | null }) {
  return (
    <div className="flex justify-end">
      <div className="flex w-[78%] flex-col gap-1 rounded-[16px] bg-primary px-3 py-2 text-primary-foreground">
        {caption ? <span className="text-[13px] leading-[1.45] opacity-[0.92]">{caption}</span> : null}
        {clip.words ? (
          <span className="text-[13px] leading-[1.45] opacity-[0.92] [&_s]:text-white/[0.72] [&_s]:decoration-[1.5px]">
            {clip.words.map((p, i) => (p.cut ? <s key={i}>{p.text}</s> : <span key={i}>{p.text}</span>))}
          </span>
        ) : null}
        {clip.src ? (
          <SnippetWavePlayer
            seed={seed}
            src={clip.src}
            startOffsetMs={clip.start_ms}
            durationMs={clip.duration_ms}
            size="compact"
            tone="me"
            label={CHUNK_SHEET_COPY.pagerMoment}
          />
        ) : null}
      </div>
    </div>
  );
}

/** The exercise video's thumb in its chat bubble (prototype v31 `vthumb`):
 *  a dark 16:9 box with the play mark; the tap opens the lens, which plays. */
function ExerciseThumb({ src }: { src: string }) {
  // Its length in the corner ("0:42"), read from the video's metadata only.
  const [len, setLen] = useState<string | null>(null);
  return (
    <span aria-hidden="true" className="relative my-1.5 flex aspect-video w-[150px] items-center justify-center rounded-[10px] bg-gradient-to-br from-[#30343c] to-[#17191e]">
      <span className="relative h-[26px] w-[26px] rounded-full bg-white/[0.94]">
        <span className="absolute left-[10px] top-[7px] border-y-[6px] border-l-[9px] border-y-transparent border-l-[#121212]" />
      </span>
      {len ? <span className="absolute bottom-1 right-1.5 text-[10px] text-white">{len}</span> : null}
      <video
        src={src}
        preload="metadata"
        muted
        className="hidden"
        onLoadedMetadata={(e) => {
          const t = Math.round(e.currentTarget.duration);
          if (Number.isFinite(t) && t > 0) setLen(`${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`);
        }}
      />
    </span>
  );
}

/** The helper words a later pick for the same paragraph of the same Take
 *  replaced (prototype v31: the old pick stays, struck through). */
export function replacedWordIds(items: readonly ThreadItem[]): Set<string> {
  const latest = new Map<string, string>();
  const all: [string, string][] = [];
  for (const item of items) {
    const m = item.message.metadata ?? {};
    if (item.message.kind !== "walk_step" || typeof m.words_of !== "string") continue;
    const key = `${String(m.take_session_id)}|${m.words_of}`;
    latest.set(key, item.message.client_id);
    all.push([key, item.message.client_id]);
  }
  return new Set(all.filter(([key, id]) => latest.get(key) !== id).map(([, id]) => id));
}

/** The small grey silhouette beside the app's and the coach's bubbles (the
 *  coach's grey-blue). Phones only (founder 2026-10-12). */
function ChatAvatar({ coach = false }: { coach?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex h-5 w-5 shrink-0 items-end justify-center overflow-hidden rounded-full md:hidden ${coach ? "bg-[#bfc7d6]" : "bg-[#d9d9de]"}`}
    >
      <svg viewBox="0 0 24 24" className={`h-[15px] w-[15px] ${coach ? "fill-[#5d6b85]" : "fill-[#8a8a93]"}`} aria-hidden="true">
        <circle cx="12" cy="9" r="4.2" />
        <path d="M3.5 24c.6-5 4.1-8 8.5-8s7.9 3 8.5 8z" />
      </svg>
    </span>
  );
}

/** The Ideal Text card that ends a review in the chat (prototype .itcard):
 *  the slide thumb, the project's name, "AI-generated text · Take N", ›. */
function IdealTextCardBubble({
  title,
  take,
  slideRef,
  onOpen,
}: {
  title: string;
  take: number | null;
  /** The project's deck (null: the default deck); undefined: not known, the plain tile. */
  slideRef?: string | null;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      data-review-card
      onClick={onOpen}
      className="relative mr-auto flex w-[80%] max-w-sm items-center gap-2.5 rounded-[18px] border border-border bg-background p-2.5 pr-7 text-left transition-transform active:scale-[0.98]"
    >
      <span aria-hidden="true" className="aspect-video w-[72px] flex-none overflow-hidden rounded-md bg-gradient-to-br from-[#dde3ee] to-[#c7d0e0]">
        {slideRef !== undefined ? (
          // Drawn at 360px and shrunk to the 72px tile, so the slide keeps its own proportions.
          <span className="block w-[360px] origin-top-left scale-[0.2]">
            <DeckSlidePreview presentationRef={slideRef} pageIndex={0} className="" size="header" />
          </span>
        ) : null}
      </span>
      <span className="min-w-0">
        <b className="block truncate text-[15px] font-semibold">{title}</b>
        <small className="block text-[12px] text-muted-foreground">
          {take !== null ? `AI-generated text · Take ${take}` : "AI-generated text"}
        </small>
      </span>
      <span aria-hidden="true" className="absolute right-3 top-1/2 -translate-y-1/2 text-[20px] text-muted-foreground">
        ›
      </span>
    </button>
  );
}

/** The words on a review's Ideal Text card: the project's name (as its
 *  Ideal Text bubbles carry it) and the Take (as its summary carries it).
 *  Null when the message is not a review's end or no name is known. */
export function reviewCardOf(
  message: LoungeMessage,
  items: readonly ThreadItem[],
): { title: string; take: number | null } | null {
  const meta = message.metadata ?? {};
  if (meta.step !== "end" || typeof meta.arc_id !== "string") return null;
  let title: string | null = null;
  let take: number | null = null;
  for (const item of items) {
    const m = item.kind === "message" ? item.message.metadata ?? {} : {};
    if (m.arc_id !== meta.arc_id) continue;
    if (typeof m.topic === "string" && m.topic.trim()) title = m.topic.trim();
    if (m.summary === true && m.take_session_id === meta.take_session_id && typeof m.take_index === "number") {
      take = m.take_index;
    }
  }
  return title ? { title, take } : null;
}

/** The closing summary after a review (founder lock 2026-10-12, section 3):
 *  one plain bubble that is not tapped. Rewritten by a coach update, it
 *  keeps the earlier words one tap away; the update itself is its own
 *  bubble under "Later · from your coach". */
function SummaryBubble({ message }: { message: LoungeMessage }) {
  const [earlierOpen, setEarlierOpen] = useState(false);
  const meta = message.metadata ?? {};
  const earlier = meta.coach_update === true && typeof meta.earlier === "string" ? meta.earlier : null;
  return (
    <div data-summary-bubble className="mr-auto flex max-w-[88%] items-end gap-1.5">
      <ChatAvatar />
      <div className="whitespace-pre-wrap break-words rounded-[16px] bg-muted px-3 py-2 text-[15px] leading-[1.45] text-foreground">
        {message.body}
        {earlier ? (
          <>
            <button
              type="button"
              onClick={() => setEarlierOpen((open) => !open)}
              className="mt-2 block text-left text-[12.5px] text-muted-foreground underline underline-offset-[3px]"
            >
              {earlierOpen
                ? "Updated with your coach's note · hide the earlier version"
                : "Updated with your coach's note · see the earlier version"}
            </button>
            {earlierOpen ? (
              <span className="mt-1.5 block border-t border-border pt-1.5 text-[13.5px] text-muted-foreground">
                {earlier}
              </span>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

/** A wheel anywhere on the page outside the thread scrolls the thread,
 *  unless it lands in an overlay, a dialog or a field that scrolls itself.
 *  Returns the cleanup. */
export function forwardMarginWheel(scroller: () => HTMLElement | null): () => void {
  const onWheel = (event: WheelEvent) => {
    const el = scroller();
    const target = event.target as Element | null;
    if (!el || !target || el.contains(target)) return;
    if (target.closest(".fixed, [role='dialog'], textarea, input, select")) return;
    el.scrollTop += event.deltaY;
  };
  window.addEventListener("wheel", onWheel, { passive: true });
  return () => window.removeEventListener("wheel", onWheel);
}
