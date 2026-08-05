"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Upload, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import Linkified from "./Linkified";
import { postChatQuery } from "@/services/api/chatQuery";
import { homeworkApi } from "@/lib/api/homework-client";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import {
  groupReviewQueueByStudent,
  type ReviewStudentGroup,
} from "@/services/api/reviewQueue";
import { useLoungeThreadCtx } from "./LoungeThreadContext";
import {
  batchTake,
  isUploadAsk,
  loungeToHistory,
  splitBotMessage,
} from "./willabHelpers";
import { useLabReadoutLive } from "./useLabReadoutLive";
import {
  readProcessingTake,
  clearProcessingTake,
} from "@/lib/willab/processingTake";
import { stageLabUpload } from "./labUploadStage";
import { validateAudioUpload } from "./audioUploadValidation";
import ReportCard, { type FeedbackBubbleTarget } from "./ReportCard";
import { FLOW_COPY } from "./flowCopy";
import LoadingState, { VoiceMark } from "./LoadingState";
import FeedbackOverlay from "./FeedbackOverlay";
import IdealTextOverlay from "./IdealTextOverlay";
import LibraryOverlay from "./LibraryOverlay";
import BestPresentationOverlay from "./BestPresentationOverlay";
import BreakthroughsOverlay from "./BreakthroughsOverlay";
import StudentRosterOverlay from "./StudentRosterOverlay";
import StudentDetailOverlay from "./StudentDetailOverlay";
import CoachReviewOverlay from "./CoachReviewOverlay";
import CoachStarVerdictOverlay from "./CoachStarVerdictOverlay";
import ReviewGroupOverlay from "./ReviewGroupOverlay";
import { readExploreArc, writeExploreArc } from "@/lib/willab/exploreArc";
import { clearInsightsReady } from "./sendStatus";
import { isLabOverlay, type WillabState } from "./useWillabFlow";
import { useUserProfile } from "./useUserProfile";
import { useReviewQueue } from "./useReviewQueue";
import CoachReviewGroupBubble from "./CoachReviewGroupBubble";
import LoungeSpeakerSexPrompt from "./LoungeSpeakerSexPrompt";
import ReflectionGamePrompt from "./ReflectionGamePrompt";
import CoachReflectionQueue from "./CoachReflectionQueue";
import {
  useInstallOffer,
  InstallOfferActions,
  type InstallOffer,
} from "./WillabInstallPrompt";
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
  type ChipAction,
} from "./loungePrompts";
import type { RecordingProgress } from "@/services/api/recordingProgress";
import { useLifeTags } from "@/lib/life/useLifeTags";
import { applyPick } from "@/lib/life/hashtags";
import {
  LifeChatCard,
  LifeTagPicker,
} from "@/components/life/LifeChatLayer";

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
type ThreadItem =
  | {
      kind: "message";
      sortKey: string;
      reactKey: string;
      message: LoungeMessage;
    }
  | {
      kind: "review";
      sortKey: string;
      reactKey: string;
      // FP-4 — one item per student (grouped), not per session.
      group: ReviewStudentGroup;
    }
  ;

export default function Lounge({
  state,
  onStart,
  onStartInProject,
  goTo,
  initialReviewSessionId = null,
  initialBestPresentationArcId = null,
  recordingProgress = null,
}: {
  state: WillabState;
  onStart: () => void;
  /** Scenario B (founder 2026-07-22) — recording from INSIDE a project: the
   *  project is already known, so the picker is skipped entirely and the Lab
   *  opens straight onto the prefilled setup. */
  onStartInProject?: () => void;
  goTo: (s: WillabState) => void;
  /** U12 — when set (from /chat?review=<id>), open the CoachReviewOverlay for
   *  that session once on mount. Coach-gated; ignored for non-coaches. */
  initialReviewSessionId?: string | null;
  /** C — when set (from /chat?arc=<arc_id>), open the BestPresentationOverlay
   *  for that arc once on mount. */
  initialBestPresentationArcId?: string | null;
  /** Seed from the upload response; reserved for future per-take state. */
  recordingProgress?: RecordingProgress | null;
}) {
  const router = useRouter();
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
      parseFloat(cs.borderTopWidth || "0") + parseFloat(cs.borderBottomWidth || "0");
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
  // F2 — best-presentation overlay. arcId drives which arc to show.
  const [bestPresentationArcId, setBestPresentationArcId] = useState<string | null>(null);
  // Star Verdict (2026-07-27) — the coach's star-review overlay for one arc.
  // A SIBLING of the review overlay on purpose (N1): the verdict surface
  // shows the machine's guesses, so it never mounts inside the blind
  // labeling flow — the two only meet here, in the hub.
  const [starVerdictArcId, setStarVerdictArcId] = useState<string | null>(null);
  // #5 — arc's coach-confirmed breakthrough moments overlay (sibling of best-pres).
  const [breakthroughsArcId, setBreakthroughsArcId] = useState<string | null>(null);
  // F2/F7 — the offer (install / legacy joke) whose action pair is open in
  // the footer (replacing the record button). null → the record button shows.
  // The offers themselves persist as thread bubbles (loungeOffers); this only
  // tracks which one is currently "armed".
  const [activeOffer, setActiveOffer] = useState<OfferType | null>(null);
  // E3 — coach-only student roster overlay.
  const [rosterOpen, setRosterOpen] = useState(false);
  // U1 (native scroll): scroll the thread CONTAINER, and stick to the bottom
  // only when the user is already there. The old code called scrollIntoView on
  // a bottom sentinel on every new message + every bot-typing toggle, which
  // (a) could pan the whole page / iOS viewport, and (b) yanked the user back
  // down whenever they'd scrolled up to read history — the non-native feel.
  const scrollRef = useRef<HTMLDivElement | null>(null);
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
  const reviewQueue = useReviewQueue(isCoach);
  // §F.2 — overlay sessionId. null = closed. Setting to a sessionId mounts
  // the CoachReviewOverlay over the Lounge; closing it returns to the chat
  // thread underneath with no remount of the queue.
  const [reviewSessionId, setReviewSessionId] = useState<string | null>(null);
  // FP-4 — a student-grouped review bubble opens either the full
  // StudentDetailOverlay (when the group carries a user_id) or, pre-BE-4, the
  // local recordings list built from the group's queue rows.
  const [studentDetail, setStudentDetail] = useState<{
    id: string;
    pseudonym: string;
  } | null>(null);
  // Hold only the group KEY, not the group object — the live group is looked up
  // from reviewGroups each render so the open overlay stays fresh (FP-4 review).
  const [reviewGroupKey, setReviewGroupKey] = useState<string | null>(null);

  // Interleave the coach's review queue rows with regular Lounge messages so
  // a "new session ready to label" bubble appears chronologically alongside
  // the rest of the chat — that's the §3 design ("message in his chat from
  // that user"). Sort by created_at / sent_at ascending so oldest sits at
  // the top and newest at the bottom (matching how the existing thread
  // already reads).
  // FP-4 — the review queue collapsed to one group per student. Derived from
  // the LIVE rows so an open ReviewGroupOverlay reflects a just-published take
  // (its row flips to done → the group's rows update) rather than a frozen
  // snapshot taken at open time.
  const reviewGroups = useMemo<ReviewStudentGroup[]>(
    () => (isCoach ? groupReviewQueueByStudent(reviewQueue.rows) : []),
    [isCoach, reviewQueue.rows]
  );
  // The live group behind an open ReviewGroupOverlay (null when none open or the
  // group emptied out). Looked up by key so it tracks row-state changes.
  const activeReviewGroup = reviewGroupKey
    ? reviewGroups.find((g) => g.key === reviewGroupKey) ?? null
    : null;

  const threadItems = useMemo<ThreadItem[]>(() => {
    // #10 — dedupe by client_id: the BE thread is the source of truth and its
    // idempotent client_ids are the identity. A double-insert (retry, optimistic
    // + server echo) must never render twice (also keeps React keys unique).
    const seenIds = new Set<string>();
    const items: ThreadItem[] = [];
    for (const m of messages) {
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
    if (isCoach) {
      // FP-4 — one item per student, sorted by the group's earliest-waiting
      // session.
      for (const group of reviewGroups) {
        items.push({
          kind: "review",
          sortKey: group.earliestSentAt || "",
          reactKey: `review:${group.key}`,
          group,
        });
      }
    }
    // SD — the audit-progress line ("N more takes to the full training") is
    // retired with the 3-take arc: takes are open-ended now.
    items.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    return items;
  }, [messages, isCoach, reviewGroups]);

  // §F.2 — open the review overlay over the Lounge. No navigation: the chat
  // thread stays mounted beneath the overlay so closing returns the coach
  // to the same scroll position, same queue, same chat history. The
  // overlay refetches via useCoachReview on its own.
  function openReview(sessionId: string): void {
    setReviewSessionId(sessionId);
  }

  function closeReview(): void {
    setReviewSessionId(null);
    // Refresh the queue so the bubble's state badge (pending → in_progress)
    // reflects any per-snippet saves the coach made inside the overlay.
    void reviewQueue.refresh();
  }

  // FP-4 — a per-student review bubble opens that student's recordings list.
  // With a user_id (BE-4) → the full StudentDetailOverlay (goal, ideal-ready
  // cues, whole history). Without one, a lone session opens its review directly
  // (no regression), and a multi-session group opens the local list built from
  // the queue rows. Either way each recording still opens CoachReviewOverlay.
  function openReviewGroup(group: ReviewStudentGroup): void {
    // T4 — an annotation upload is never a student: open its own session
    // directly, NEVER a per-student roster detail (its user_id, if any, must not
    // route here). Grouping already nulls the id; this guard makes the
    // destination explicit and stays correct even if a group ever backfills one.
    if (group.annotationMode) {
      if (group.rows[0]) openReview(group.rows[0].sessionId);
      return;
    }
    if (group.userId) {
      setStudentDetail({ id: group.userId, pseudonym: group.pseudonym });
    } else if (group.rows.length === 1) {
      openReview(group.rows[0].sessionId);
    } else {
      setReviewGroupKey(group.key);
    }
  }

  // U6 — opening the in-thread insight card is the single "mark read" path now
  // that the top banner is gone: open the overlay, and if we were in the unread
  // insights_ready state, clear the flag + return the status machine to idle
  // (exactly what the banner's "Read ›" button used to do).

  // C8 — every quick-action CTA lands in ONE place: the Trainings library
  // (trainings / audit). audit previously routed to /audits; it now opens the
  // Trainings library like the rest so the chips don't scatter. No record chip:
  // the bot points at the permanent record button in words. (arc_checkout, the
  // $25 pay note, was retired with the paywall — only $5 moments is paid now.)
  function onChip(): void {
    setLibraryOpen(true);
  }

  // U12 — coach email deep-link (/chat?review=<id>): open the review overlay for
  // that session once on mount. Coach-gated (isCoach is the render gate; the BE
  // role-gates the endpoint regardless). Fire-once so closing it doesn't
  // immediately reopen; isCoach can resolve async, so the effect re-runs when it
  // flips true.
  const deepLinkOpenedRef = useRef(false);
  useEffect(() => {
    if (deepLinkOpenedRef.current || !isCoach || !initialReviewSessionId) return;
    deepLinkOpenedRef.current = true;
    setReviewSessionId(initialReviewSessionId);
  }, [isCoach, initialReviewSessionId]);

  // D3 — user results email deep-link (/chat?insight=<id>): open the insights
  // overlay for that session once on mount. Not coach-gated (InsightsOverlay
  // fetches the owner-auth readout); fire-once so closing it doesn't reopen.

  // C — best-presentation deep-link (/chat?arc=<arc_id>): open the
  // BestPresentationOverlay for that arc once on mount; fire-once so closing it
  // doesn't reopen.
  const bestPresLinkOpenedRef = useRef(false);
  useEffect(() => {
    if (bestPresLinkOpenedRef.current || !initialBestPresentationArcId) return;
    bestPresLinkOpenedRef.current = true;
    setBestPresentationArcId(initialBestPresentationArcId);
  }, [initialBestPresentationArcId]);

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

  // Async analysis (delivery layer) — a take left mid-analysis keeps finishing
  // server-side; resume its persisted marker and subscribe until terminal:
  // push-first via the readout SSE bridge, with the original 5s poll as the
  // automatic fallback tier inside useLabReadoutLive. Re-arms whenever the Lab
  // overlay CLOSES (state-driven, not mount-only — the Lounge is
  // always-mounted, so a marker written mid-session must be picked up the
  // moment the user comes back from the Lab). While the Lab is open it owns
  // the live subscription, so this stands down.
  const [processingResume, setProcessingResume] = useState<{
    takeIndex: number | null;
    status: "analyzing" | "failed";
  } | null>(null);
  const [resumeWatch, setResumeWatch] = useState<{
    sessionId: string;
    takeIndex: number | null;
    startedAt: number;
  } | null>(null);
  // The failure note lingers briefly, then clears itself; a fresh analyzing
  // marker cancels a pending clear so it can't wipe the new chip.
  const failNoteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearFailNoteTimer = useCallback(() => {
    if (failNoteTimerRef.current) {
      clearTimeout(failNoteTimerRef.current);
      failNoteTimerRef.current = null;
    }
  }, []);
  useEffect(() => clearFailNoteTimer, [clearFailNoteTimer]);
  useEffect(() => {
    if (isLabOverlay(state)) {
      // The LabOverlay owns the live subscription while open.
      setResumeWatch(null);
      return;
    }
    const marker = readProcessingTake();
    if (!marker) {
      setProcessingResume(null);
      setResumeWatch(null);
      return;
    }
    // A marker older than 30 min is stale (the accepted redeploy-mid-job gap
    // leaves `processing` forever) — clear quietly instead of an eternal chip.
    if (Date.now() - marker.startedAt > 30 * 60_000) {
      clearProcessingTake(marker.sessionId);
      setResumeWatch(null);
      return;
    }
    clearFailNoteTimer();
    setProcessingResume({ takeIndex: marker.takeIndex, status: "analyzing" });
    setResumeWatch({
      sessionId: marker.sessionId,
      takeIndex: marker.takeIndex,
      startedAt: marker.startedAt,
    });
  }, [state, clearFailNoteTimer]);
  // The stale cutoff applies while watching too — a long-lived tab must not
  // keep an orphaned "analyzing" chip alive forever.
  useEffect(() => {
    if (!resumeWatch) return;
    const id = setTimeout(() => {
      clearProcessingTake(resumeWatch.sessionId);
      setProcessingResume(null);
      setResumeWatch(null);
    }, Math.max(0, resumeWatch.startedAt + 30 * 60_000 - Date.now()));
    return () => clearTimeout(id);
  }, [resumeWatch]);
  useLabReadoutLive(
    resumeWatch?.sessionId ?? null,
    (r) => {
      if (!resumeWatch) return;
      const hasContent =
        r.readout.snippets.length > 0 ||
        r.readout.instantChunks.length > 0 ||
        r.readout.fullTranscriptChunks.length > 0;
      if (r.state === "failed") {
        clearProcessingTake(resumeWatch.sessionId);
        setProcessingResume({
          takeIndex: resumeWatch.takeIndex,
          status: "failed",
        });
        setResumeWatch(null);
        // The failure note lingers briefly, then clears itself.
        failNoteTimerRef.current = setTimeout(
          () => setProcessingResume(null),
          10_000
        );
        return;
      }
      if (
        r.state === "ready" ||
        r.state === "readout_ready" ||
        (r.state !== "processing" && hasContent)
      ) {
        clearProcessingTake(resumeWatch.sessionId);
        setProcessingResume(null);
        setResumeWatch(null);
        // FE-B — analysis just completed with the user back in the Lounge; the
        // BE appended the ideal-text bubble at the end of the pipeline, so
        // pull it into the thread now.
        void reload();
      }
    },
    5000
  );

  // Auto-open an offer in the footer, respecting priority so that when several
  // fire at the same post-send moment the most urgent wins the slot (the others
  // remain clickable bubbles in the thread). An explicit bubble tap bypasses
  // this and opens that offer directly.
  const openOffer = useCallback((type: OfferType) => {
    // SD/FE-4 — the joke onboarding is deleted; a legacy joke bubble in an old
    // thread stays visible but inert.
    if (type === "joke") return;
    const rank: Record<OfferType, number> = { joke: 2, install: 1 };
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
    [messages]
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
      (m) => m.kind === "recording_summary" && m.client_created_at > settle
    );
    if (!freshSend) return;
    installHandledRef.current = true;
    void thread.append(offerDraft("install"));
    openOffer("install");
  }, [state, install.canOffer, thread.loading, messages, thread.append, openOffer]);


  useEffect(() => {
    // Stick to bottom only if the user hasn't scrolled up. Scroll the container
    // itself (not a sentinel) so the page/viewport never moves.
    if (!atBottomRef.current) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, botThinking]);

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
      const userMsg = await thread.append({ role: "user", kind: "text", body: q });

      setBotThinking(true);
      try {
        const resp = await postChatQuery({
          question: q,
          history,
          // #2 — let the BE own persistence for signed-in turns. It writes the
          // user turn with our client_id (dedup) and the bot turn with the chip
          // in its metadata; the FE then shows the bot turn optimistically only.
          persist: thread.signedIn,
          clientId: userMsg.client_id,
          clientCreatedAt: userMsg.client_created_at,
        });
        // B-1 — the one quick-action the BE suggests for this turn (S1),
        // rendered as an in-bubble chip (trainings / audit).
        const suggested = coerceSuggestedAction(resp.suggested_action);
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
          metadata: suggested ? { suggested_action: suggested } : null,
        };
        if (thread.signedIn) thread.appendLocalOnly(botDraft);
        else await thread.append(botDraft);
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
          <LoadingState />
        ) : threadItems.length === 0 ? (
          <LoungeEmptyState onStart={onStart} />
        ) : (
          threadItems.map((item, i) =>
            item.kind === "message" ? (
              <Bubble
                key={item.reactKey}
                message={item.message}
                onOpenBestPresentation={(arcId) => setBestPresentationArcId(arcId)}
                onOpenBreakthroughs={(arcId) => setBreakthroughsArcId(arcId)}
                onOpenTranscripts={() => setLibraryOpen(true)}
                onOpenFeedback={setFeedbackTarget}
                onOpenIdealText={(arcId) => {
            // FE-5 — opening the deliverable is the "seen" signal now that the
            // legacy insight walker is gone; without this the status machine
            // would stick in insights_ready forever.
            if (state === "insights_ready") {
              clearInsightsReady();
              goTo("lounge_idle");
            }
            setIdealTextArcId(arcId);
          }}
                onChip={onChip}
                activeOffer={activeOffer}
                onOpenOffer={setActiveOffer}
                animate={
                  i === threadItems.length - 1 &&
                  baselineRef.current !== null &&
                  !baselineRef.current.has(item.message.client_id)
                }
              />
            ) : (
              <CoachReviewGroupBubble
                key={item.reactKey}
                group={item.group}
                onOpen={openReviewGroup}
              />
            )
          )
        )}

        {/* The speaker-sex ask, as the last item IN the thread — not a layer.
            /chat is where both signup routes land (OAuth users never see the
            signup field at all), so this is the only mount that reaches them.
            In-thread means it scrolls with the conversation and cannot cover a
            running take; the wrapper holds the stay-out-of-the-Lab rule. */}
        <LoungeSpeakerSexPrompt state={state} threadLoading={thread.loading} />

        {/* F2 §1 — the Reflection Game card: the machine's clipped moment as a
            question, in-thread for the same LIVE-LOOP reason as the ask above.
            Server-capped at 2/day; renders nothing when there's nothing to
            ask (or for guests). */}
        <ReflectionGamePrompt
          signedIn={thread.signedIn}
          threadLoading={thread.loading}
          active={!isLabOverlay(state)}
        />

        {/* F2 §1d — the coach's BLIND clip verification, the half that closes
            the loop (no verdict, no Confident Voices entry). Mounted LAST on
            purpose: text verification outranks clip verification (founder
            decision), and the review-queue bubbles above are that text work,
            so a backed-up coach meets them first. Renders nothing for
            non-coaches or an empty queue. */}
        <CoachReflectionQueue
          isCoach={isCoach}
          threadLoading={thread.loading}
          active={!isLabOverlay(state)}
        />

        {botThinking && <TypingDots />}
      </div>

      {/* E3 — coach-only entry to the student roster (pseudonymized). Coaches
          can still record, so this sits above the record CTA, not instead of it. */}
      {isCoach && (
        <Button
          type="button"
          variant="outline"
          onClick={() => setRosterOpen(true)}
          className="h-12 w-full gap-2 rounded-full"
        >
          <Users className="h-4 w-4" />
          Your students
        </Button>
      )}

      {/* Async analysis (delivery layer): a take left mid-analysis (closed tab /
          locked phone) keeps finishing server-side — this chip resumes a calm
          indicator from the persisted marker and clears itself when done. */}
      {processingResume ? (
        <p
          className={`mb-1.5 flex items-center justify-center gap-2 rounded-full px-4 py-1.5 text-center text-[13px] ${
            processingResume.status === "failed"
              ? "bg-destructive/10 text-destructive"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {processingResume.status === "failed" ? null : (
            <VoiceMark size={18} />
          )}
          {processingResume.status === "failed"
            ? FLOW_COPY.failed
            : FLOW_COPY.analysing}
        </p>
      ) : null}
      {/* The SECOND line — what happens next (docs/ideal-text-flow-
          communication.md, rule 3: one line of state, one of what's next).
          On the analysing path it grants permission to leave, which is what
          stops someone sitting and staring; on the failure path it bounds the
          damage before offering the retry. */}
      {processingResume ? (
        <p className="mb-1.5 px-4 text-center text-[12px] leading-relaxed text-muted-foreground">
          {processingResume.status === "failed"
            ? FLOW_COPY.failedNext
            : FLOW_COPY.analysingNext}
        </p>
      ) : null}

      {/* The record-button slot. While an offer is "armed" (freshly triggered,
          or re-opened by tapping its thread bubble) its action pair REPLACES the
          black record button; resolving it returns the record button (U2). The
          offer's prompt + outcome live in the thread as durable bubbles. */}
      {activeOffer ? (
        <OfferActions
          type={activeOffer}
          install={install}
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
      <form onSubmit={handleSend} className="flex items-end gap-2">
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
            className={`scrollbar-none block max-h-40 min-h-[48px] w-full resize-none overflow-x-hidden rounded-3xl border border-border bg-background py-3 pl-4 text-[15px] leading-snug outline-none focus:border-primary ${
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
              className="absolute bottom-1.5 right-1.5 flex h-9 w-9 items-center justify-center rounded-full text-foreground transition-colors disabled:cursor-default disabled:text-muted-foreground"
            >
              <Send className="h-5 w-5" />
            </button>
          ) : null}
        </div>
        {/* Its own control, with its own stroke — recording is not a thing you
            do TO the message you are typing. The dot is the recording signal
            (the one place red reads as "live action").

            It ALWAYS opens the project choice: never a last-used default,
            never an auto-continue, even when a cached arc exists. Founder
            2026-07-27 — that disconnection is deliberate. A take submitted
            with the wrong continue_arc_id lands in the wrong project, splits
            the arc, and corrupts the cross-take comparison the ideal text is
            ranked across. */}
        {/* WITHHELD WHILE A TAKE IS STILL LANDING (founder 2026-08-05: "there
            is no new button to record unless the text is displayed and
            waiting is finished").

            Disabled, not removed — an entry point that vanishes reads as a
            broken app, and the chip above already says why it is waiting.

            This is a correctness rule as much as a UX one: the ideal-text
            version is now the SPOKEN TAKE COUNT, so a take started while the
            previous one is still assembling races the version being written.
            A failed analysis does NOT hold the button — that is exactly when
            someone needs to record again. */}
        <button
          type="button"
          onClick={onStart}
          disabled={processingResume?.status === "analyzing"}
          title={
            processingResume?.status === "analyzing"
              ? FLOW_COPY.recordHeld
              : undefined
          }
          className="flex h-12 shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-3.5 text-[13px] font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-default disabled:border-border/60 disabled:text-muted-foreground disabled:hover:bg-background"
        >
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              processingResume?.status === "analyzing"
                ? "bg-muted-foreground/40"
                : "bg-red-500"
            }`}
            aria-hidden
          />
          Record
        </button>
      </form>

      {breakthroughsArcId && (
        <BreakthroughsOverlay
          arcId={breakthroughsArcId}
          onClose={() => setBreakthroughsArcId(null)}
        />
      )}
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
          onClose={() => {
            setIdealTextArcId(null);
          }}
          // SD — "Read it aloud": the re-read is just another recording. Seed
          // THIS presentation (only when the cache holds a different arc; the
          // BE reconciles the real take index on upload) and open the Lab.
          onReadAloud={(version) => {
            const arcId = idealTextArcId;
            const cached = readExploreArc();
            if (cached?.arcId !== arcId) {
              // Seed the next-take index from the SD version hint (≈ takes so
              // far); the BE reconciles the real take_index on upload.
              writeExploreArc(
                arcId,
                (version ?? 0) + 1,
                undefined,
                latestArcSessionId(arcId)
              );
            }
            setIdealTextArcId(null);
            // The arc is already seeded above — never ask WHICH project.
            (onStartInProject ?? onStart)();
          }}
        />
      )}
      {libraryOpen && (
        <LibraryOverlay
          onClose={() => setLibraryOpen(false)}
          onOpenBestPresentation={(arcId) => setBestPresentationArcId(arcId)}
          onRecordAnother={(arc) => {
            // Continue this deck's arc: seed the explore-arc (id + next index +
            // deck) so the Lab carries arc_id and pre-fills the deck, then open
            // the Lab. The BE appends the take to the same arc. The session id
            // (FE-1) lets the Lab re-fetch the deck from the server if the
            // cached one is stale/incomplete; trainings-mode arcs pass their
            // own (latest take's) id, else derive from the thread. A deckless
            // seed (trainings mode carries no slide bodies) must not WIPE a
            // deck already cached for this same arc — keep it.
            const cached = readExploreArc();
            const deck =
              arc.deck ??
              (cached?.arcId === arc.arcId ? cached.deck : undefined);
            writeExploreArc(
              arc.arcId,
              arc.nextTakeIndex,
              deck,
              arc.sessionId ?? latestArcSessionId(arc.arcId)
            );
            setLibraryOpen(false);
            // The arc is seeded immediately above — never ask WHICH project
            // (the picker's new-topic exit would clear it, and the take would
            // mint a new project instead of joining this one — review R-pp0).
            (onStartInProject ?? onStart)();
          }}
        />
      )}
      {rosterOpen && (
        <StudentRosterOverlay
          onClose={() => setRosterOpen(false)}
          onOpenReview={openReview}
          // FE-B — the ideal-ready badge opens the arc's coach panel view
          // (BestPresentationOverlay renders CoachIdealTextPanel for coaches
          // in every state, pre-3-takes included — never a dead end).
          onOpenArcIdeal={(arcId) => setBestPresentationArcId(arcId)}
          onOpenStarVerdicts={(arcId) => setStarVerdictArcId(arcId)}
        />
      )}
      {/* FP-4 — per-student drill-down opened from a grouped review bubble.
          Mounted BEFORE the review overlay so a review opened from here stacks
          on top (equal z-index → DOM order wins). */}
      {studentDetail && (
        <StudentDetailOverlay
          userId={studentDetail.id}
          fallbackPseudonym={studentDetail.pseudonym}
          onClose={() => {
            setStudentDetail(null);
            void reviewQueue.refresh();
          }}
          onOpenReview={openReview}
          onOpenArcIdeal={(arcId) => setBestPresentationArcId(arcId)}
          onOpenStarVerdicts={(arcId) => setStarVerdictArcId(arcId)}
        />
      )}
      {/* FP-4 pre-BE-4 fallback — the local recordings list for a group with no
          user_id. Uses the LIVE group (looked up by key) so a take published
          from the stacked review overlay flips to Delivered here on return. */}
      {activeReviewGroup && (
        <ReviewGroupOverlay
          group={activeReviewGroup}
          onClose={() => {
            setReviewGroupKey(null);
            void reviewQueue.refresh();
          }}
          onOpenReview={openReview}
        />
      )}
      {reviewSessionId && (
        <CoachReviewOverlay
          sessionId={reviewSessionId}
          onClose={closeReview}
          onPublished={reviewQueue.markDone}
          // The wrap-up cue opens the ideal-text panel (mounted last, so it
          // paints above this review; LIFO back-dismiss returns here).
          onOpenArcIdeal={(arcId) => setBestPresentationArcId(arcId)}
        />
      )}

      {/* Best-presentation overlay (the arc deliverable — the coach's ideal-text
          panel lives here). Mounted AFTER every overlay that opens into it
          (roster / student detail / review wrap-up all call
          setBestPresentationArcId), and nothing this mount renders opens on top
          of it. Equal z-40 → later in DOM wins, so it paints ABOVE the overlay
          it was opened from (that was the P0 "nothing happens" bug — it used to
          render first and hide behind an opaque z-40 sibling). Mount order also
          puts it above those openers in the LIFO back-dismiss stack. (The star
          verdict overlay below is a sibling, not an opener — neither ever opens
          the other, so their relative order carries no weight.) */}
      {bestPresentationArcId && (
        <BestPresentationOverlay
          arcId={bestPresentationArcId}
          onClose={() => setBestPresentationArcId(null)}
          onRecordNext={(takesDone) => {
            // Seed the arc THIS progress bar belongs to, so the take lands in
            // it (and "Take N of 3" + the interstitial parity read true) even
            // when localStorage holds a different / no arc.
            if (
              bestPresentationArcId &&
              readExploreArc()?.arcId !== bestPresentationArcId
            ) {
              // FE-1 — carry the arc's session id so the Lab can restore its
              // deck from the server (this seed omits the deck; localStorage was
              // lost or holds a different arc).
              writeExploreArc(
                bestPresentationArcId,
                takesDone + 1,
                undefined,
                latestArcSessionId(bestPresentationArcId)
              );
            }
            setBestPresentationArcId(null);
            // Seeded above — same rule as the library entry (review R-pp0).
            (onStartInProject ?? onStart)();
          }}
        />
      )}

      {/* Star Verdict — the coach judges the machine's fired stars for one
          arc. Mounted last for the same reason BestPresentationOverlay is
          (equal z-40 → last in DOM paints on top): it opens FROM the student
          detail overlay mounted above, so it must stack over it, and being
          the LIFO back-dismiss top means Back returns to the detail. Never
          opened from the review overlay (N1 — that flow labels blind). */}
      {starVerdictArcId && (
        <CoachStarVerdictOverlay
          arcId={starVerdictArcId}
          onClose={() => setStarVerdictArcId(null)}
        />
      )}

    </div>
  );
}

/** B-1 — a single intent-driven quick-action button (from the BE's
 *  suggested_action, S1). Lives inside the bot bubble it came with, persists
 *  in thread history, and is always clickable (action is idempotent). */
function ActionButton({ action, onClick }: { action: ChipAction; onClick: () => void }) {
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
  onResolve,
}: {
  type: OfferType;
  install: InstallOffer;
  onResolve: () => void;
}) {
  if (type === "install") {
    return <InstallOfferActions offer={install} onResolve={onResolve} />;
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
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
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
  onOpenBreakthroughs,
  onOpenTranscripts,
  onOpenFeedback,
  onOpenIdealText,
  onChip,
  activeOffer,
  onOpenOffer,
  animate = false,
}: {
  message: LoungeMessage;
  onViewInsights?: (sessionId: string) => void;
  /** C — open BestPresentationOverlay from the best_presentation_ready card. */
  onOpenBestPresentation?: (arcId: string) => void;
  /** C2 — open BreakthroughsOverlay from the ideal-text hero card. */
  onOpenBreakthroughs?: (arcId: string) => void;
  /** transcript_ready card — opens the Trainings library. */
  onOpenTranscripts?: () => void;
  /** Delivery layer — the grey feedback bubbles open their take's page. */
  onOpenFeedback?: (target: FeedbackBubbleTarget) => void;
  /** Delivery layer — every ideal-text bubble opens the live notebook. */
  onOpenIdealText?: (arcId: string) => void;
  onChip?: () => void;
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
        onOpenBreakthroughs={onOpenBreakthroughs}
        onOpenTranscripts={onOpenTranscripts}
        onOpenFeedback={onOpenFeedback}
        onOpenIdealText={onOpenIdealText}
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
    // B-1 — read the persisted action from metadata; render below the bubbles.
    const action =
      onChip && message.metadata
        ? coerceSuggestedAction(message.metadata.suggested_action)
        : null;
    return (
      <>
        {/* U3 (bubble-split): multi-paragraph answers reveal sequentially. */}
        <SequentialBotBubbles
          chunks={splitBotMessage(message.body)}
          animate={animate}
        />
        {action && (
          <ActionButton action={action} onClick={() => onChip!()} />
        )}
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
  // Founder 2026-07-27 — the Will greeting is replaced by the thing it was
  // asking for. An empty thread had a paragraph explaining that recording is
  // the point; now it IS the point: one big oval button and nothing else
  // competing with it.
  //
  // Same destination as the composer's Record: ALWAYS the project choice,
  // never a last-used default (FE-4).
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <button
        type="button"
        onClick={onStart}
        // ONE line, always: `whitespace-nowrap` is the guarantee, and the copy
        // plus the padding are sized so it holds at the narrowest supported
        // width without the label shrinking the dot or spilling the pill.
        className="flex w-full max-w-sm items-center justify-center gap-2.5 whitespace-nowrap rounded-full bg-foreground px-5 py-4 text-[16px] font-medium text-background transition-colors hover:bg-foreground/90 active:scale-[0.99]"
      >
        <span className="h-3 w-3 shrink-0 rounded-full bg-red-500" aria-hidden />
        Start your first recording
      </button>
    </div>
  );
}
