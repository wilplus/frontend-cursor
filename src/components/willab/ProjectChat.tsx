"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject, type RefObject } from "react";
import { fetchTrainings, type TrainingArc, type TrainingTake } from "@/services/api/trainings";
import {
  newestStamp,
  stampLoungeMessage,
  type LoungeMessage,
} from "@/services/api/loungeMessages";
import type { ChatQueryResponse } from "@/services/api/chatQuery";
import { postWillQuestion } from "@/services/api/willQuestion";
import { fetchArcSetup } from "@/services/api/arcSetup";
import {
  CHAT_FAILURE_BODY,
  isPersistedTerminalReplay,
  isReplayedTerminalReply,
  openProjectQuestion,
  orderedProjectMessages,
  projectConversationHistory,
  typedProjectTurnMetadata,
} from "@/lib/willab/projectChat";
import {
  retryIdealTextGeneration,
  retryLabProcessing,
} from "@/services/api/labRecording";
import {
  clearProcessingTake,
  readProcessingTake,
  writeProcessingTake,
  type ProcessingTake,
} from "@/lib/willab/processingTake";
import { useLoungeThreadCtx } from "./LoungeThreadContext";
import { useChatTurnOutbox, type PendingChatTurn } from "./useChatTurnOutbox";
import { ChatTurnRetry } from "./ChatTurnRetry";
import FeedbackWalkCard, { type FeedbackWalkChunk } from "./FeedbackWalkCard";
import IdealTextOverlay from "./IdealTextOverlay";
import TakeTranscriptSheet from "./TakeTranscriptSheet";
import TypingDots, { TypingGlyph } from "./TypingDots";
import WillQuestionBubble, { SOMETHING_ELSE, TYPE_YOUR_ANSWER } from "./WillQuestion";
import { LetterCircle } from "./chats/ChatList";
import { TopBar } from "./chats/TopBar";
import { useBackDismiss } from "./useBackDismiss";
import { usePublishedCoach } from "@/lib/willab/chatBuilder/usePublishedCoach";
import { recordLabel } from "@/lib/willab/chatBuilder/screenCopy";
import { useUserId } from "./useUserId";
import { refreshLiveIdealDoc } from "./ReportCard";
import {
  practiceSelection,
  readPracticeCheckpoint,
  writePracticeResume,
  type PracticeDecision,
} from "@/lib/willab/practiceResume";
import { WILLAB_CONTENT_RAIL } from "@/lib/willab/layout";
import { usePinThreadBottom } from "./usePinThreadBottom";
import TakeReview, { type ReviewExit, type ReviewFocus, type TakeReviewTarget } from "./TakeReview";
import TakeReviewMessage, { readyForReview } from "./TakeReviewMessage";
import { readReviewRuns, type ReviewRuns } from "@/services/api/takeReview";
import ChatComposer from "./chats/ChatComposer";
import { useUpdateSlides } from "./UpdateSlides";
import { useWorkspaceSidebar } from "./chats/ChatWorkspace";
import { PROJECT_SPEAKER_BUBBLE, scrollWithinProject } from "./walk/InlineWalkHost";
import CoachMoment from "./CoachMoment";
import { withoutCoachTranscriptFooter } from "./willabHelpers";

type Opened = "walk" | "ideal" | "decision" | null;

type ProjectReviewSelection = {
  coachTake: string | null;
  reviewTake: string | null;
  reviewTakeIndex: number | null;
  reviewSlideRange: { startSlide: number; endSlide: number } | null;
};

function projectReviewSelection(
  opened: Opened,
  practice: FeedbackWalkChunk | null,
): ProjectReviewSelection {
  if (opened !== "walk" || !practice) {
    return { coachTake: null, reviewTake: null, reviewTakeIndex: null, reviewSlideRange: null };
  }
  return {
    coachTake: practice.latestSessionId,
    reviewTake: practice.latestSessionId,
    reviewTakeIndex: practice.takeIndex ?? null,
    reviewSlideRange: {
      startSlide: practice.startSlide,
      endSlide: practice.endSlide,
    },
  };
}

type PendingTapTurn = {
  question: LoungeMessage;
  user: LoungeMessage;
  phase: "sending" | "send_failed";
};

function latestTypedAnswer(outbox: ReturnType<typeof useChatTurnOutbox>): PendingTapTurn | null {
  const turn = outbox.turns.at(-1);
  if (!turn?.question) return null;
  return { user: turn.user, question: turn.question, phase: outbox.isSending(turn) ? "sending" : "send_failed" };
}

function projectTurnKey(
  visibleMessages: readonly LoungeMessage[],
  pendingAnswer: PendingTapTurn | null,
  pendingTyped: PendingTapTurn | null,
  sending: boolean,
): string {
  let state = "idle";
  if (pendingTyped && pendingTyped.phase !== "sending") state = pendingTyped.phase;
  else if (sending) state = "thinking";
  return [
    visibleMessages.at(-1)?.client_id ?? "empty",
    pendingAnswer?.user.client_id ?? "settled",
    state,
  ].join(":");
}

function useProjectChatScroll(
  scrollRef: RefObject<HTMLDivElement | null>,
  projectId: string,
  turnKey: string,
): () => void {
  const didInitScrollRef = useRef(false);
  const pinBottom = usePinThreadBottom(scrollRef, turnKey, false, didInitScrollRef);
  useEffect(() => {
    didInitScrollRef.current = true;
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [projectId, scrollRef]);
  return pinBottom;
}

function ProjectChatTurnError({ pendingTap }: { pendingTap: PendingTapTurn | null }) {
  if (pendingTap?.phase !== "send_failed") return null;
  return (
    <div
      data-project-chat-error
      role="alert"
      className="mr-auto max-w-[86%] whitespace-pre-wrap rounded-[18px] bg-muted px-4 py-2.5 text-[15px] leading-relaxed text-foreground"
    >
      {CHAT_FAILURE_BODY}
    </div>
  );
}

function PendingProjectAnswer({
  pending,
  visibleMessages,
}: {
  pending: PendingTapTurn | null;
  visibleMessages: readonly LoungeMessage[];
}) {
  if (!pending || visibleMessages.some((message) => message.client_id === pending.user.client_id)) {
    return null;
  }
  return (
    <div
      data-project-pending-answer
      className="ml-auto max-w-[86%] whitespace-pre-wrap rounded-[18px] bg-primary px-4 py-2.5 text-[15px] leading-relaxed text-primary-foreground"
    >
      {pending.user.body}
    </div>
  );
}

type AcceptedProjectTake = {
  sessionId: string;
  takeIndex: number | null;
};

function acceptedProjectTake(
  messages: readonly LoungeMessage[],
  arcId: string,
): AcceptedProjectTake | null {
  const message = messages.findLast((candidate) => {
    const metadata = candidate.metadata ?? {};
    return candidate.kind === "recording_summary" &&
      metadata.arc_id === arcId &&
      typeof metadata.session_id === "string" &&
      metadata.session_id.length > 0;
  });
  const sessionId = message?.metadata?.session_id;
  if (typeof sessionId !== "string") return null;
  const takeIndex = message?.metadata?.take_index;
  return {
    sessionId,
    takeIndex: typeof takeIndex === "number" ? takeIndex : null,
  };
}

function neutralTakeChunk({
  sessionId,
  takeIndex,
  checkpoint,
  feedbackAvailable,
}: {
  sessionId: string;
  takeIndex: number;
  checkpoint: number;
  feedbackAvailable: boolean;
}): FeedbackWalkChunk {
  return {
    startSlide: 1,
    endSlide: Math.max(1, checkpoint + 1),
    attempts: null,
    deliveryLabel: null,
    latestSessionId: sessionId,
    takeIndex,
    pendingLabel: `Take ${Math.max(1, takeIndex)}`,
    pendingStatus: feedbackAvailable ? "Feedback ready" : "Processing",
  };
}

function projectPracticeView(
  project: TrainingArc,
  messages: readonly LoungeMessage[],
  checkpoint: number,
): { hasPractice: boolean; chunks: FeedbackWalkChunk[] } {
  const latestTake = [...project.takes]
    .sort((a, b) => a.takeIndex - b.takeIndex)
    .at(-1) ?? null;
  const accepted = acceptedProjectTake(messages, project.arcId);
  const acceptedAlreadyListed = accepted !== null && project.takes.some(
    (take) => take.sessionId === accepted.sessionId,
  );
  const takeIndexBySession = new Map(project.takes.map((take) => [take.sessionId, take.takeIndex]));
  const knownChunks: FeedbackWalkChunk[] = project.practiceChunks.map((chunk) => ({
    ...chunk,
    takeIndex: takeIndexBySession.get(chunk.latestSessionId) ?? null,
  }));
  const acceptedPending = accepted && !acceptedAlreadyListed
    ? neutralTakeChunk({
        sessionId: accepted.sessionId,
        takeIndex: accepted.takeIndex ?? Math.max(1, project.takeCount + 1),
        checkpoint,
        feedbackAvailable: false,
      })
    : null;
  const fallback = knownChunks.length === 0 && !acceptedPending && latestTake
    ? neutralTakeChunk({
        sessionId: latestTake.sessionId,
        takeIndex: latestTake.takeIndex,
        checkpoint,
        feedbackAvailable: latestTake.feedbackAvailable,
      })
    : null;
  return {
    hasPractice: project.takeCount > 0 || latestTake !== null || accepted !== null,
    chunks: [
      ...knownChunks,
      ...(fallback ? [fallback] : []),
      ...(acceptedPending ? [acceptedPending] : []),
    ],
  };
}

function replyBody(response: ChatQueryResponse): string | null {
  const bubbles = response.bubbles?.map((bubble) => bubble.trim()).filter(Boolean) ?? [];
  if (bubbles.length > 0) return bubbles.join("\n\n");
  const answer = response.answer?.trim() ?? "";
  return answer || null;
}

function projectVersion(project: TrainingArc): string {
  const latest = project.takes.at(-1);
  return JSON.stringify({
    takeCount: project.takeCount,
    progress: project.practiceProgress,
    latest: latest
      ? [latest.sessionId, latest.takeIndex, latest.feedbackAvailable, latest.reviewAvailable]
      : null,
    chunks: project.practiceChunks,
  });
}

function useProjectRecordingLifecycle({
  project,
  userId,
  thread,
  recordingInProgress,
  handoffTake,
  onRecordingSettled,
}: {
  project: TrainingArc;
  userId: string | null;
  thread: ReturnType<typeof useLoungeThreadCtx>;
  recordingInProgress: boolean;
  handoffTake: string | null;
  onRecordingSettled?: () => void;
}) {
  const [liveProject, setLiveProject] = useState(project);
  const [recordingActive, setRecordingActive] = useState(recordingInProgress || handoffTake !== null);
  const [freshReview, setFreshReview] = useState<TrainingTake | null>(null);
  const [processingMarker, setProcessingMarker] = useState<ProcessingTake | null>(null);
  const [retrying, setRetrying] = useState(false);
  const threadRef = useRef(thread);
  const candidateSessionRef = useRef<string | null>(null);
  const settledSession = useRef<string | null>(null);
  const returnToReview = useRef(recordingInProgress || handoffTake !== null);
  threadRef.current = thread;
  const activeProject = liveProject.arcId === project.arcId ? liveProject : project;

  useEffect(() => {
    setLiveProject(project);
    setRecordingActive(recordingInProgress || (handoffTake !== null && handoffTake !== settledSession.current));
  }, [project, recordingInProgress, handoffTake]);

  useEffect(() => {
    const sync = () => {
      const marker = readProcessingTake(userId);
      if (marker?.arcId === activeProject.arcId && marker.sessionId !== settledSession.current) {
        setProcessingMarker(marker);
        setRecordingActive(true);
      } else if (!recordingActive) {
        setProcessingMarker(null);
      }
    };
    sync();
    window.addEventListener("storage", sync);
    if (!recordingActive) {
      return () => window.removeEventListener("storage", sync);
    }
    const id = window.setInterval(sync, 500);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("storage", sync);
    };
  }, [activeProject.arcId, recordingActive, userId]);

  useEffect(() => {
    if (!recordingActive) {
      candidateSessionRef.current = null;
      return;
    }
    let active = true;
    const refresh = async () => {
      // This is a live processing read, not initial boot data: it must see a
      // newly completed Take while still sharing any concurrent refresh.
      const list = await fetchTrainings({ force: true });
      if (!active || !list) return;
      const next = list.find((candidate) => candidate.arcId === activeProject.arcId);
      if (!next) return;
      const previousLatest = activeProject.takes.at(-1)?.sessionId ?? null;
      const latest = next.takes.at(-1) ?? null;
      if (
        !candidateSessionRef.current &&
        latest &&
        latest.sessionId !== previousLatest
      ) {
        candidateSessionRef.current = latest.sessionId;
      }
      setLiveProject((current) =>
        projectVersion(current) === projectVersion(next) ? current : next,
      );
      const expectedSession = handoffTake ?? processingMarker?.sessionId ?? candidateSessionRef.current;
      const completed = next.takes.find((take) => take.sessionId === expectedSession && readyForReview(take));
      if (completed && completed.sessionId !== settledSession.current) {
        settledSession.current = completed.sessionId;
        if (returnToReview.current) setFreshReview(completed);
        returnToReview.current = false;
        clearProcessingTake(userId, completed.sessionId);
        setRecordingActive(false);
        setProcessingMarker(null);
        refreshLiveIdealDoc(activeProject.arcId);
        onRecordingSettled?.();
        await Promise.resolve(threadRef.current.reload()).catch(() => undefined);
      }
    };
    void refresh();
    const id = window.setInterval(() => void refresh(), 2_000);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [activeProject, handoffTake, onRecordingSettled, processingMarker?.sessionId, recordingActive, userId]);

  const failed =
    recordingActive &&
    (processingMarker?.status === "failed" ||
      processingMarker?.status === "failed_ideal_text_unconfirmed");

  async function retryProcessing(): Promise<void> {
    const marker = processingMarker;
    if (!marker || retrying) return;
    setRetrying(true);
    const restarted = await (
      marker.status === "failed_ideal_text_unconfirmed"
        ? retryIdealTextGeneration(marker.sessionId)
        : retryLabProcessing(marker.sessionId)
    ).catch(() => false);
    if (restarted) {
      returnToReview.current = true;
      const now = Date.now();
      const next: ProcessingTake = {
        ...marker,
        projectChat: true,
        status: "processing",
        phase: "analysis",
        startedAt: now,
        phaseStartedAt: now,
        progress: { stage: "processing_recording", percent: 0 },
      };
      writeProcessingTake(userId, next);
      setProcessingMarker(next);
      setRecordingActive(true);
    }
    setRetrying(false);
  }

  return {
    activeProject,
    freshReview,
    failed,
    processingMarker,
    recordingActive,
    retrying,
    retryProcessing,
    startRecording: () => {
      candidateSessionRef.current = null;
      returnToReview.current = true;
      setRecordingActive(true);
    },
  };
}

function useProjectPracticeHistory(project: TrainingArc, messages: readonly LoungeMessage[]) {
  const [runs, setRuns] = useState<ReviewRuns>({});
  const [refresh, setRefresh] = useState(0);
  const enabled = project.takes.some(readyForReview);
  const receipts = messages.filter((message) =>
    message.kind === "walk_step" && message.role === "user" &&
    message.metadata?.arc_id === project.arcId &&
    (message.metadata?.step === "tempo:try" || String(message.metadata?.step).startsWith("try:")),
  ).length;
  useEffect(() => {
    if (!enabled) return;
    let current = true;
    void readReviewRuns(project.arcId).then((result) => {
      if (current && result) setRuns(result);
    }).catch(() => undefined);
    return () => { current = false; };
  }, [project.arcId, enabled, receipts, refresh]);
  return { enabled, runs, refreshRuns: () => setRefresh((n) => n + 1) };
}

function ProjectReviewContext({ topic, target, onReturn, onClear }: {
  topic: string; target: TakeReviewTarget; onReturn: () => void; onClear: () => void;
}) {
  const slide = target.focus.slide_index;
  return <div className={`${WILLAB_CONTENT_RAIL} flex items-center justify-between gap-3 px-4 text-xs text-muted-foreground`}>
    <span>{topic} · Take {target.take.takeIndex}{slide === undefined ? "" : ` · Slide ${slide + 1}`}</span>
    <span className="flex items-center gap-2">
      <button type="button" className="min-h-10 shrink-0 underline" onClick={onReturn}>Back to review</button>
      <button type="button" aria-label="Clear review context" className="h-10 w-8" onClick={onClear}>×</button>
    </span>
  </div>;
}

function ProjectChatHeader({ project, onBack }: {
  project: TrainingArc; onBack?: () => void;
}) {
  return <TopBar circle={<LetterCircle id={project.arcId} name={project.topic} size={36} />}
    title={project.topic} onBack={onBack} />;
}

function samePending(
  turn: PendingChatTurn, answer: string, take: string, question: LoungeMessage | null, focus: ReviewFocus | undefined,
): boolean {
  return turn.request.question === answer && turn.request.sessionId === take &&
    turn.question?.client_id === question?.client_id &&
    JSON.stringify(turn.request.presentationContext?.review_focus) === JSON.stringify(focus);
}

function typedQuestionTarget(project: TrainingArc, active: LoungeMessage | null, target: TakeReviewTarget | null, retry?: PendingChatTurn) {
  const focus = retry ? retry.request.presentationContext?.review_focus : target?.focus;
  const question = retry ? retry.question : focus ? null : active;
  const take = retry?.request.sessionId ?? target?.take.sessionId ?? question?.metadata?.take_session_id ??
    project.takes.at(-1)?.sessionId;
  return { focus, question, take };
}

function ProjectProcessingStatus({ active, failed, retrying, onRetry }: {
  active: boolean; failed: boolean; retrying: boolean; onRetry: () => void;
}) {
  if (failed) return (
    <div data-processing-error role="alert"
      className="mr-auto flex max-w-[88%] flex-col gap-2 rounded-[16px] bg-destructive/10 px-3 py-2 text-[14px] leading-[1.45] text-destructive">
      <span>We couldn&apos;t finish preparing your feedback.</span>
      <button type="button" disabled={retrying} onClick={onRetry}
        className="self-start underline underline-offset-2 disabled:opacity-60">
        {retrying ? "Trying again…" : "Try processing again"}
      </button>
    </div>
  );
  if (!active) return null;
  return <div className="mr-auto flex max-w-[88%] items-end gap-1.5">
    <div data-processing-bubble role="status"
      className="flex items-center gap-2.5 rounded-[16px] bg-muted px-3 py-2 text-left text-[15px] leading-[1.45] text-foreground">
      <TypingGlyph />
      <span>Processing your recording</span>
    </div>
  </div>;
}

export default function ProjectChat({
  project,
  analysisPending = false,
  recordingInProgress = false,
  handoffTake = null,
  initialReview = null,
  beforeLeaveRef,
  initialDraft = "",
  onDraftChange,
  onBack,
  onRecord,
  onRecordingSettled,
}: {
  project: TrainingArc;
  analysisPending?: boolean;
  /** Set when this chat returns from its own recorder. It bridges the short
   *  gap before the accepted Take has a session/processing marker. */
  recordingInProgress?: boolean;
  handoffTake?: string | null;
  initialReview?: TakeReviewTarget | null;
  beforeLeaveRef?: MutableRefObject<ReviewExit | null>;
  initialDraft?: string;
  onDraftChange?: (draft: string) => void;
  onBack: () => void;
  onRecord: (arcId: string) => void;
  onRecordingSettled?: () => void;
}) {
  const workspace = useWorkspaceSidebar();
  const reviewExit = useRef<ReviewExit | null>(null);
  const leavingReview = useCallback((action: () => void) => (reviewExit.current ?? ((afterSave) => afterSave()))(action), []);
  const back = () => leavingReview(onBack);
  useBackDismiss(back);
  const coach = usePublishedCoach();
  const userId = useUserId();
  const thread = useLoungeThreadCtx();
  const {
    activeProject,
    freshReview,
    failed,
    processingMarker,
    recordingActive,
    retrying,
    retryProcessing,
    startRecording,
  } = useProjectRecordingLifecycle({
    project,
    userId,
    thread,
    recordingInProgress,
    handoffTake,
    onRecordingSettled,
  });
  const [opened, setOpened] = useState<Opened>(null);
  const [openedPractice, setOpenedPractice] = useState<FeedbackWalkChunk | null>(null);
  const [takeReview, setTakeReview] = useState<TakeReviewTarget | null>(initialReview);
  const [recordingDock, setRecordingDock] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!beforeLeaveRef) return;
    beforeLeaveRef.current = (action) => {
      if (recordingDock?.querySelector("[data-chat-capture]")) {
        recordingDock.querySelector<HTMLButtonElement>("[data-chat-mic]")?.focus();
      } else leavingReview(action);
    };
    return () => { beforeLeaveRef.current = null; };
  }, [beforeLeaveRef, leavingReview, recordingDock]);
  const [askTarget, setAskTarget] = useState<TakeReviewTarget | null>(null);
  const slides = useUpdateSlides(activeProject.arcId, {
    hasDeck: activeProject.takes.some((take) => take.hasSlides), takeCount: activeProject.takeCount,
  });
  const { enabled: takeReviewEnabled, runs, refreshRuns } = useProjectPracticeHistory(activeProject, thread.messages);
  const [openedTranscript, setOpenedTranscript] = useState<{
    sessionId: string;
    takeIndex: number;
  } | null>(null);
  const reviewSelection = projectReviewSelection(opened, openedPractice);
  const [draft, setDraft] = useState(initialDraft);
  useEffect(() => { onDraftChange?.(draft); }, [draft, onDraftChange]);
  const [sendingHere, setSending] = useState(false);
  const [typingQuestion, setTypingQuestion] = useState<string | null>(null);
  const outbox = useChatTurnOutbox(thread, userId, JSON.stringify(["project", activeProject.arcId]));
  const sending = outbox.busy(sendingHere);
  const pendingTyped = latestTypedAnswer(outbox);
  const sendingRef = useRef(false);
  const [pendingTap, setPendingTap] = useState<PendingTapTurn | null>(null);
  const [slideCount, setSlideCount] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messages = useMemo(
    () => orderedProjectMessages(outbox.messages, activeProject.arcId).filter(
      (message) => !isPersistedTerminalReplay(message, thread.messages),
    ),
    [outbox.messages, thread.messages, activeProject.arcId],
  );
  const visibleMessages = messages.filter(
    (message) => !["walk_step", "ideal_text", "recording_summary", "feedback", "transcript_ready"].includes(message.kind),
  );
  const question = openProjectQuestion(messages);
  const failedTurns = new Map(outbox.turns.filter((t) => !outbox.isSending(t)).map((t) => [t.user.client_id, t]));
  const pendingAnswer = pendingTyped ?? pendingTap;
  const activeQuestion = question ?? pendingAnswer?.question ?? null;
  const typingAnswer = activeQuestion !== null && typingQuestion === activeQuestion.client_id;
  const questionMeta = activeQuestion?.metadata ?? {};
  const chips = Array.isArray(questionMeta.chips)
    ? questionMeta.chips.filter((chip): chip is string => typeof chip === "string" && chip.length > 0)
    : [];
  const checkpoint = readPracticeCheckpoint(userId, activeProject.arcId);
  const { hasPractice, chunks: practiceChunks } = projectPracticeView(
    activeProject,
    thread.messages,
    checkpoint,
  );
  const recordingTakes = [...activeProject.takes].sort(
    (a, b) => a.takeIndex - b.takeIndex,
  );
  useEffect(() => {
    if (freshReview) leavingReview(() => setTakeReview({ take: freshReview, focus: { step: "feedback" } }));
  }, [freshReview, leavingReview]);
  const pinBottom = useProjectChatScroll(
    scrollRef,
    activeProject.arcId,
    projectTurnKey(visibleMessages, pendingAnswer, pendingTyped, sending),
  );

  useEffect(() => {
    let active = true;
    void fetchArcSetup(activeProject.arcId).then((setup) => {
      if (!active || !setup) return;
      // Deckless practice uses the product's three-part default deck.
      setSlideCount(Math.max(1, setup.slides.length || 3));
    });
    return () => {
      active = false;
    };
  }, [activeProject.arcId]);

  async function answerChip(choice: string): Promise<void> {
    const take = questionMeta.take_session_id;
    if (sending || !activeQuestion || typeof take !== "string") return;
    const optimistic = stampLoungeMessage({
      role: "user",
      kind: "text",
      body: choice,
      metadata: {
        arc_id: activeProject.arcId,
        take_session_id: take,
        will_question_step: "answer",
      },
    }, newestStamp(messages));
    setPendingTap({ question: activeQuestion, user: optimistic, phase: "sending" });
    setSending(true);
    pinBottom();
    try {
      const accepted = await postWillQuestion(activeProject.arcId, take, choice);
      if (!accepted) throw new Error("Will question was not accepted");
      await thread.reload();
      setPendingTap(null);
    } catch {
      const durable = thread.appendRecoverable({
        role: "user",
        kind: "text",
        body: choice,
        metadata: optimistic.metadata,
      });
      setPendingTap({
        question: activeQuestion,
        user: durable.message,
        phase: "send_failed",
      });
    } finally {
      setSending(false);
    }
  }

  async function answerChoice(choice: string): Promise<void> {
    if (choice === SOMETHING_ELSE) {
      setDraft("");
      setTypingQuestion(activeQuestion?.client_id ?? null);
      return;
    }
    await answerChip(choice);
  }

  async function answerText(retry?: PendingChatTurn): Promise<void> {
    const answer = retry?.request.question ?? draft.trim();
    const { focus: reviewFocus, question, take } = typedQuestionTarget(activeProject, activeQuestion, askTarget, retry);
    const arc = activeProject.arcId;
    if (!answer || sending || sendingRef.current || !outbox.ready || typeof take !== "string") return;
    const existing = retry ?? outbox.turns.findLast((t) => samePending(t, answer, take, question, reviewFocus));
    if (existing && outbox.isSending(existing)) return;
    sendingRef.current = true;
    setSending(true);
    setDraft((current) => !retry || current === retry.draft ? "" : current);
    setTypingQuestion(null);
    pinBottom();
    const scope = { arcId: arc, takeSessionId: take, questionClientId: question?.client_id ?? "", place: "speaking" };
    const pendingIds = new Set(outbox.turns.map((t) => t.user.client_id));
    const turn = existing ?? outbox.begin(draft, {
      role: "user", kind: "text", body: answer, metadata: {
        ...typedProjectTurnMetadata({ ...scope, role: "answer" }),
        ...(reviewFocus ? { review_focus: reviewFocus } : {}),
      },
    }, question, {
      question: answer, history: projectConversationHistory(messages.filter((m) => !pendingIds.has(m.client_id)), arc),
      historySource: "screen", projectId: arc, sessionId: take, place: "speaking", persist: thread.signedIn,
      presentationContext: {
        has_current_project: true, completed_takes: Math.max(activeProject.takeCount, activeProject.takes.length),
        has_pdf: activeProject.takes.some((t) => t.hasSlides),
        ...(reviewFocus ? { review_focus: reviewFocus } : {}),
      },
    });
    try {
      const result = await outbox.deliver(turn, (response) => {
        const body = replyBody(response);
        if (!body || isReplayedTerminalReply(body, thread.messages)) throw new Error("Missing contextual reply");
        return { role: "bot", kind: "text", body,
          metadata: { ...typedProjectTurnMetadata({ ...scope, role: "reply" }), ...response.row_metadata } };
      });
      if (result && outbox.isCurrent()) await thread.reload();
    } catch {
      if (outbox.isPending(turn)) {
        setDraft((current) => current || turn.draft);
        setTypingQuestion(question?.client_id ?? null);
      }
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  const closeResult = () => {
    setOpened(null);
    setOpenedPractice(null);
    void thread.reload();
  };

  function finishReview() {
    const closed = takeReview?.take.sessionId;
    setTakeReview(null);
    refreshRuns();
    void thread.reload();
    if (closed) window.requestAnimationFrame(() => {
      const entry = Array.from(scrollRef.current?.querySelectorAll<HTMLElement>("[data-project-take]") ?? [])
        .find((item) => item.dataset.projectTake === closed);
      const preview = entry?.querySelector<HTMLButtonElement>("[data-take-review-message]");
      scrollWithinProject(preview);
      preview?.focus({ preventScroll: true });
    });
  }

  function openReview(target: TakeReviewTarget) {
    leavingReview(() => setTakeReview(target));
  }

  function reviewLink(message: LoungeMessage) {
    const coords = message.metadata?.review_focus as Partial<ReviewFocus> | null;
    if (!coords || !["feedback", "practise", "ideal"].includes(coords.step ?? "")) return null;
    const take = recordingTakes.find((part) => part.sessionId === message.metadata?.take_session_id);
    if (!take) return null;
    const label = typeof coords.slide_index === "number" ? ` · Slide ${coords.slide_index + 1}` : "";
    return <button type="button" className="block min-h-8 text-xs underline" onClick={() => openReview({
      take, focus: coords as ReviewFocus,
    })}>Take {take.takeIndex}{label} · Back to review</button>;
  }

  function startPractice(scope: "fragment" | "whole", chunk: FeedbackWalkChunk | undefined): void {
    const span = activeProject.practiceChunks.find((item) => item.latestSessionId === chunk?.latestSessionId);
    writePracticeResume(userId, activeProject.arcId, practiceSelection(scope, span));
    setOpened(null);
    startRecording();
    onRecord(activeProject.arcId);
  }

  function practiceDecisionFor(chunk: FeedbackWalkChunk | undefined): PracticeDecision | undefined {
    if (!hasPractice) return undefined;
    return {
      deliveryLabel: chunk?.deliveryLabel ?? undefined,
      onFragment: () => { finishReview(); startPractice("fragment", chunk); },
      onWholePresentation: () => { finishReview(); startPractice("whole", chunk); },
    };
  }

  function recordNext(chunk: FeedbackWalkChunk | null = null) {
    if (hasPractice) {
      setOpenedPractice(chunk);
      setOpened("decision");
      return;
    }
    startRecording();
    onRecord(activeProject.arcId);
  }

  return (
    <div data-project-chat className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
      <ProjectChatHeader project={activeProject} onBack={workspace ? undefined : back} />

      <div ref={scrollRef} data-project-scroll className="scrollbar-none flex-1 overflow-y-auto px-4 py-4">
        <div className={`${WILLAB_CONTENT_RAIL} flex min-h-full flex-col justify-end gap-2`}>
          {recordingTakes.map((take) => {
            const chunk = practiceChunks.find((entry) => entry.latestSessionId === take.sessionId);
            const range = chunk && !chunk.pendingStatus ? { startSlide: chunk.startSlide, endSlide: chunk.endSlide } : undefined;
            const selected = takeReview?.take.sessionId === take.sessionId ? { ...takeReview, walkRange: range } : null;
            const forTake = messages.filter((message) => message.metadata?.take_session_id === take.sessionId);
            const preview = forTake.find((message) => message.kind === "walk_step" && message.body.trim() &&
              ["praise", "best", "fix", "tempo:open"].includes(String(message.metadata?.step)))?.body ?? null;
            return <div key={take.sessionId} data-project-take={take.sessionId} className="flex flex-col gap-2">
              <div data-project-recording={take.sessionId}
                className={PROJECT_SPEAKER_BUBBLE + " ml-auto max-w-[86%] rounded-[18px] px-4 py-3"}>
              <p className="text-[15px] font-semibold">Your recording · Take {take.takeIndex}</p>
              <button
                type="button"
                onClick={() => setOpenedTranscript({
                  sessionId: take.sessionId,
                  takeIndex: take.takeIndex,
                })}
                className="mt-1 text-left text-[13px] underline underline-offset-2"
              >
                Open raw transcript
              </button>
              </div>
              {selected ? <TakeReview key={take.sessionId} project={activeProject} target={selected}
                runs={runs[take.sessionId] ?? []} messages={forTake} recordingDock={recordingDock} exitRef={reviewExit}
                practiceDecision={practiceDecisionFor(chunk)}
                onAsk={setAskTarget} onClose={finishReview}
                onPracticeEnded={() => { refreshRuns(); void thread.reload(); }}
                onNextTake={() => {
                  finishReview();
                  recordNext(chunk);
                }} /> : readyForReview(take) ? <TakeReviewMessage take={take} preview={preview}
                  count={runs[take.sessionId]?.length ?? 0}
                  onOpen={() => openReview({ take, focus: { step: "feedback" } })} /> : null}
            </div>;
          })}
          {!takeReviewEnabled && hasPractice ? (
            <div data-project-results className="mb-2 w-full max-w-[480px] self-start">
              <FeedbackWalkCard
                progress={activeProject.practiceProgress}
                chunks={practiceChunks}
                onFeedback={(chunk) => {
                  const take = recordingTakes.find((item) => item.sessionId === chunk.latestSessionId);
                  if (take && !chunk.pendingStatus) {
                    openReview({ take, focus: { step: "feedback" }, openWalk: true });
                    return;
                  }
                  setOpenedPractice(chunk);
                  setOpened("walk");
                }}
                onIdealText={() => {
                  setOpenedPractice(null);
                  setOpened("ideal");
                }}
              />
            </div>
          ) : null}

          {visibleMessages.map((message) => (
            message.client_id === activeQuestion?.client_id ? (
              <div key={message.client_id} data-project-message={message.client_id} className="contents">
                <WillQuestionBubble
                  body={message.body}
                  chips={chips}
                  open={pendingAnswer === null}
                  disabled={sending}
                  onAnswer={answerChoice}
                />
              </div>
            ) : (
              <Fragment key={message.client_id}>
              <div
                data-project-message={message.client_id}
                className={`max-w-[86%] whitespace-pre-wrap rounded-[18px] px-4 py-2.5 text-[15px] leading-relaxed empty:hidden ${
                  message.role === "user"
                    ? "ml-auto " + PROJECT_SPEAKER_BUBBLE
                    : "mr-auto bg-muted text-foreground"
                }`}
              >
                {message.role === "bot" ? withoutCoachTranscriptFooter(message.body) : message.body}
                {reviewLink(message)}
              </div>
                {message.role === "bot" && <CoachMoment raw={message.metadata?.coach_moment}
                  artifact={message.metadata?.chat_artifact}
                  project={activeProject.arcId} recordingDock={recordingDock} />}
                {failedTurns.has(message.client_id) && (
                  <div data-project-chat-error>
                    <ChatTurnRetry disabled={sending || outbox.readingHistory} onRetry={() => void answerText(failedTurns.get(message.client_id))} />
                  </div>
                )}
              </Fragment>
            )
          ))}
          <PendingProjectAnswer pending={pendingAnswer} visibleMessages={visibleMessages} />
          <ProjectChatTurnError pendingTap={pendingTap} />
          <ProjectProcessingStatus active={recordingActive} failed={failed}
            retrying={retrying} onRetry={() => void retryProcessing()} />
          {sending ? <TypingDots label="Will is replying" /> : null}
        </div>
      </div>

      {askTarget ? <ProjectReviewContext topic={activeProject.topic} target={askTarget}
        onReturn={() => openReview(askTarget)} onClear={() => setAskTarget(null)} /> : null}
      <div ref={setRecordingDock} data-project-walk-capture className={WILLAB_CONTENT_RAIL + " peer empty:hidden"} />
      <div className="peer-[:not(:empty)]:hidden">
      <ChatComposer key={activeProject.arcId} className={WILLAB_CONTENT_RAIL}
        formAttrs={{ "data-project-question-composer": "" }} placeholder={activeQuestion ? TYPE_YOUR_ANSWER : "Message about this project"}
        inputLabel="Answer about this take" sendLabel="Send answer" value={draft} onValue={setDraft} onSend={() => answerText()}
        autoFocus={typingAnswer || Boolean(askTarget) || pendingTyped?.phase === "send_failed"} busy={sending}
        files={slides.item ? [{ label: slides.item.label, open: slides.item.onOpen }] : undefined}
        mic={{ label: recordLabel(coach, Boolean(hasPractice)), start: () => leavingReview(() => recordNext()), attrs: { "data-project-record": "" } }} />
      </div>
      {slides.layer}
      {opened ? (
        <IdealTextOverlay
          arcId={activeProject.arcId}
          {...reviewSelection}
          analysisPending={analysisPending}
          initialMode={opened === "walk" ? "review" : undefined}
          requireFeedbackWalk={opened === "walk"}
          projectFlow={opened === "walk"}
          onClose={closeResult}
          onReadAloud={() => {
            startRecording();
            onRecord(activeProject.arcId);
          }}
          practiceDecision={practiceDecisionFor(openedPractice ?? practiceChunks.at(-1))}
        />
      ) : null}
      {openedTranscript ? (
        <TakeTranscriptSheet
          projectTopic={activeProject.topic}
          takeIndex={openedTranscript.takeIndex}
          takeSessionId={openedTranscript.sessionId}
          onClose={() => setOpenedTranscript(null)}
        />
      ) : null}
    </div>
  );
}

// Founder-Approved: the black Feedback CTA stays in the selected Feedback Walk, and project practice shows that fragment's readiness beside the two recording choices, 2026-11-18.
