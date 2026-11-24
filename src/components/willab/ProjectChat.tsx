"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject, type RefObject } from "react";
import { fetchTrainings, type TrainingArc, type TrainingTake } from "@/services/api/trainings";
import {
  newestStamp,
  stampLoungeMessage,
  type LoungeMessage,
} from "@/services/api/loungeMessages";
import type { LoungeMessageDraft } from "@/services/api/loungeMessages";
import { keepChatReplyAudio, outboxOwner } from "@/lib/willab/voiceNoteOutbox";
import type { ChatQueryResponse } from "@/services/api/chatQuery";
import { postWillQuestion, transcribeChatAnswer, type SpokenChatAnswer } from "@/services/api/willQuestion";
import {
  CHAT_FAILURE_BODY,
  isPersistedTerminalReplay,
  isReplayedTerminalReply,
  offersNextTake,
  openProjectQuestion,
  orderedProjectMessages,
  projectConversationHistory,
  projectTimeline,
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
import TakeTranscriptSheet from "./TakeTranscriptSheet";
import TypingDots from "./TypingDots";
import { PendingRecordingBubbles, RecordingProcessingBubble } from "./ProjectRecordingBubbles";
import ProcessingResumeOverlay from "./ProcessingResumeOverlay";
import type { PendingProjectTake } from "./usePendingProjectTakes";
import WillQuestionBubble, { SOMETHING_ELSE, TYPE_YOUR_ANSWER } from "./WillQuestion";
import { LetterCircle } from "./chats/ChatList";
import { TopBar } from "./chats/TopBar";
import { useBackDismiss } from "./useBackDismiss";
import { useUserId } from "./useUserId";
import { refreshLiveIdealDoc } from "./ReportCard";
import { clearPracticeResume } from "@/lib/willab/practiceResume";
import { keepNextTakeShare } from "@/lib/willab/nextTakeShare";
import { WILLAB_CONTENT_RAIL } from "@/lib/willab/layout";
import { usePinThreadBottom } from "./usePinThreadBottom";
import TakeReview, { InlineTakeIdealText, REVIEW_STEPS, type ReviewExit, type ReviewFocus, type TakeReviewTarget } from "./TakeReview";
import { TakeConversation } from "./chats/TakeConversation";
import { useComposerVoice } from "./chats/useComposerVoice";
import RecordNextTakeLink from "./chats/RecordNextTakeLink";
import { isTakeExchangeMessage, offersIdealText, readyForReview, takeSessionOf, withProjectChatPlacement } from "@/lib/willab/takeExchange";
import { useHumanCoachReviewRows } from "./chats/useHumanCoachReviewRows";
import { readReviewRuns, type ReviewRuns } from "@/services/api/takeReview";
import ChatComposer from "./chats/ChatComposer";
import { useUpdateSlides } from "./UpdateSlides";
import { useWorkspaceSidebar } from "./chats/ChatWorkspace";
import { PROJECT_SPEAKER_BUBBLE, scrollWithinProject } from "./walk/InlineWalkHost";
import TakeConversationMessage, { hasTakeReplyContent } from "./chats/TakeConversationMessage";
import CoachWordingCard, { linkedSavedWordings } from "./CoachWordingCard";
import { withoutCoachTranscriptFooter } from "./willabHelpers";

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

function replyBody(response: ChatQueryResponse, messages: readonly LoungeMessage[]): string {
  const bubbles = response.bubbles?.map((bubble) => bubble.trim()).filter(Boolean) ?? [];
  const answer = bubbles.length > 0 ? bubbles.join("\n\n") : response.answer?.trim() ?? "";
  if (!answer || isReplayedTerminalReply(answer, messages, response)) throw new Error("Missing contextual reply");
  return answer;
}

function projectVersion(project: TrainingArc): string {
  return JSON.stringify([project.takeCount, project.takes, project.practiceCoverage]);
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
  }, [project]);

  useEffect(() => {
    const incoming = handoffTake !== null && handoffTake !== settledSession.current;
    if (incoming) returnToReview.current = true;
    setRecordingActive(recordingInProgress || incoming);
  }, [recordingInProgress, handoffTake]);

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
  return { runs, refreshRuns: () => setRefresh((n) => n + 1) };
}

function ProjectReviewContext({ target, onClear }: {
  target: TakeReviewTarget; onClear: () => void;
}) {
  const slide = target.focus.slide_index;
  return <div className="flex items-center gap-2 border-l-2 border-border pl-3 text-xs text-muted-foreground">
    <span className="min-w-0 flex-1">
      <span className="block font-medium">Take {target.take.takeIndex}{slide === undefined ? "" : ` · Slide ${slide + 1}`}</span>
      {target.quote ? <span className="block truncate">{target.quote}</span> : null}
    </span>
    <button type="button" aria-label="Clear review context" className="size-11 shrink-0" onClick={onClear}>×</button>
  </div>;
}

function ProjectChatHeader({ project, onBack }: {
  project: TrainingArc; onBack?: () => void;
}) {
  return <TopBar circle={<LetterCircle id={project.arcId} name={project.topic} size={36} />}
    title={project.topic} onBack={onBack} />;
}

function samePending(
  turn: PendingChatTurn, answer: string, take: string | undefined, question: LoungeMessage | null, focus: ReviewFocus | undefined,
): boolean {
  return !turn.user.metadata?.will_voice && turn.request.question === answer && turn.request.sessionId === take &&
    turn.question?.client_id === question?.client_id &&
    JSON.stringify(turn.request.presentationContext?.review_focus) === JSON.stringify(focus);
}

function typedQuestionTarget(project: TrainingArc, active: LoungeMessage | null, target: TakeReviewTarget | null, retry?: PendingChatTurn) {
  const focus = retry ? retry.request.presentationContext?.review_focus : target?.focus;
  const question = retry ? retry.question : focus ? null : active;
  const take = retry?.request.sessionId ?? target?.take.sessionId ?? question?.metadata?.take_session_id ??
    project.takes.at(-1)?.sessionId;
  return { focus, question, take: typeof take === "string" ? take : undefined };
}

function questionInTakeView(
  active: LoungeMessage | null, review: TakeReviewTarget | null, reviewed: ReadonlySet<string>,
) {
  const questionTake = takeSessionOf(active ?? {});
  if (review) return questionTake === review.take.sessionId ? active : null;
  return reviewed.has(questionTake ?? "") ? null : active;
}

function leaveAfterSave(exit: ReviewExit | null, action: () => void) {
  if (exit) exit(action);
  else action();
}

function idealOfferTake(message: LoungeMessage | undefined, takes: readonly TrainingTake[]) {
  if (!message || message.role !== "bot" || !offersIdealText(message)) return undefined;
  const take = takeSessionOf(message);
  return takes.find((item) => item.sessionId === take);
}

function placementForTurn(
  review: TakeReviewTarget | null,
  focus: TakeReviewTarget | null,
  question: LoungeMessage | null,
) {
  return {
    take_exchange: Boolean(review || question),
    live_take_feedback: Boolean(review?.live || focus?.live || focus?.focus.step === "ideal"),
  };
}

function takePreview(messages: readonly LoungeMessage[]): string | null {
  const feedback = messages.filter((message) =>
    message.role === "bot" && isTakeExchangeMessage(message) && message.body.trim(),
  );
  return feedback.find((message) => message.kind === "walk_step" &&
    ["praise", "best", "fix", "tempo:open"].includes(String(message.metadata?.step)))?.body ??
    feedback[0]?.body ?? null;
}

function ProjectProcessingStatus({ active, failed, retrying, marker, onRetry }: {
  active: boolean;
  failed: boolean;
  retrying: boolean;
  marker: ProcessingTake | null;
  onRetry: () => void;
}) {
  const [waitOpenedAt, setWaitOpenedAt] = useState<number | null>(null);
  useEffect(() => {
    if (!active || failed) setWaitOpenedAt(null);
  }, [active, failed]);
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
  return <>
    <RecordingProcessingBubble onOpen={() => setWaitOpenedAt(Date.now())} />
    {waitOpenedAt !== null ? <ProcessingResumeOverlay progress={marker?.progress ?? null}
      phase={marker?.phase} cycleStartedAt={marker?.startedAt ?? waitOpenedAt} phaseStartedAt={marker?.phaseStartedAt}
      onClose={() => setWaitOpenedAt(null)} /> : null}
  </>;
}

export default function ProjectChat({
  project,
  recordingInProgress = false,
  handoffTake = null,
  pendingRecording,
  onOpenPendingRecording,
  initialReview = null,
  beforeLeaveRef,
  initialDraft = "",
  onDraftChange,
  onBack,
  onRecord,
  onRecordingSettled,
}: {
  project: TrainingArc;
  /** Set when this chat returns from its own recorder. It bridges the short
   *  gap before the accepted Take has a session/processing marker. */
  recordingInProgress?: boolean;
  handoffTake?: string | null;
  pendingRecording?: PendingProjectTake;
  onOpenPendingRecording?: (take: PendingProjectTake) => void;
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
  const documentExit = useRef<ReviewExit | null>(null);
  const leavingReview = useCallback((action: () => void) =>
    leaveAfterSave(reviewExit.current, () => leaveAfterSave(documentExit.current, action)), []);
  const [openedIdealReply, setOpenedIdealReply] = useState<string | null>(null);
  const back = () => leavingReview(onBack);
  useBackDismiss(back);
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
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const reviewFocusRef = useRef<TakeReviewTarget | null>(null);
  const slides = useUpdateSlides(activeProject.arcId, {
    hasDeck: activeProject.takes.some((take) => take.hasSlides), takeCount: activeProject.takeCount,
  });
  const { runs, refreshRuns } = useProjectPracticeHistory(activeProject, thread.messages);
  const [openedTranscript, setOpenedTranscript] = useState<{
    sessionId: string;
    takeIndex: number;
  } | null>(null);
  const [draft, setDraft] = useState(initialDraft);
  useEffect(() => { onDraftChange?.(draft); }, [draft, onDraftChange]);
  const [sendingHere, setSending] = useState(false);
  const [typingQuestion, setTypingQuestion] = useState<string | null>(null);
  const outbox = useChatTurnOutbox(thread, userId, JSON.stringify(["project", activeProject.arcId]));
  const sending = outbox.busy(sendingHere);
  const pendingTyped = latestTypedAnswer(outbox);
  const sendingRef = useRef(false);
  const [pendingTap, setPendingTap] = useState<PendingTapTurn | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messages = useMemo(
    () => withProjectChatPlacement(orderedProjectMessages(outbox.messages, activeProject.arcId)).filter(
      (message) => !isPersistedTerminalReplay(message, thread.messages),
    ),
    [outbox.messages, thread.messages, activeProject.arcId],
  );
  const linkedWording = linkedSavedWordings(messages);
  const visibleMessages = messages.filter(
    (message) => !["walk_step", "ideal_text", "recording_summary", "feedback", "transcript_ready"].includes(message.kind),
  );
  const question = openProjectQuestion(messages);
  const failedTurns = new Map(outbox.turns.filter((t) => !outbox.isSending(t)).map((t) => [t.user.client_id, t]));
  const pendingAnswer = pendingTyped ?? pendingTap;
  const activeQuestion = question ?? pendingAnswer?.question ?? null;
  const reviewContext = askTarget ?? takeReview;
  const currentReviewContext = useRef(reviewContext);
  currentReviewContext.current = reviewContext;
  const voiceScope = JSON.stringify([userId, activeProject.arcId, reviewContext?.take.sessionId, reviewContext?.focus]);
  const [preparedVoice, setPreparedVoice] = useState<{
    scope: string; answer: SpokenChatAnswer; target: ReturnType<typeof turnTarget>;
  } | null>(null);
  const stagedVoice = preparedVoice?.scope === voiceScope ? preparedVoice : null;
  const voice = useComposerVoice({
    enabled: thread.signedIn,
    held: sending || !outbox.ready,
    maxSeconds: 120,
    label: "Record your answer",
    prepareOnStop: true,
    scope: voiceScope,
    onSend: async (audio, duration, turnId) => {
      if (!outbox.isCurrent()) return false;
      const captured = turnTarget();
      const take = captured.take ? { arcId: activeProject.arcId, takeId: captured.take } : undefined;
      const spoken = await transcribeChatAnswer(audio, duration, take, {
        turnId, projectId: activeProject.arcId, snippetId: captured.focus?.snippet_id,
      });
      if (!spoken || !turnId || !outbox.isCurrent() || currentReviewContext.current !== reviewContext) return false;
      const answer = { ...spoken, turnId, audio };
      setPreparedVoice({ scope: voiceScope, answer, target: captured });
      setDraft(spoken.text);
      return true;
    },
  });
  const typingAnswer = activeQuestion !== null && typingQuestion === activeQuestion.client_id;
  const questionMeta = activeQuestion?.metadata ?? {};
  const chips = Array.isArray(questionMeta.chips)
    ? questionMeta.chips.filter((chip): chip is string => typeof chip === "string" && chip.length > 0)
    : [];
  const recordingTakes = [...activeProject.takes].sort(
    (a, b) => a.takeIndex - b.takeIndex,
  );
  const reviewedTakeIds = new Set(recordingTakes.filter(readyForReview).map((take) => take.sessionId));
  const humanCoachRows = useHumanCoachReviewRows(activeProject, thread.signedIn);
  const timeline = humanCoachRows.length
    ? orderedProjectMessages([...visibleMessages, ...humanCoachRows]
        .sort((a, b) => a.client_created_at.localeCompare(b.client_created_at)), activeProject.arcId)
    : visibleMessages;
  const ordinaryMessages = timeline.filter((message) =>
    !isTakeExchangeMessage(message) || !reviewedTakeIds.has(takeSessionOf(message) ?? ""));
  useEffect(() => {
    if (freshReview) leavingReview(() => setTakeReview({ take: freshReview, focus: { step: "feedback" }, live: true }));
  }, [freshReview, leavingReview]);
  const pinBottom = useProjectChatScroll(
    scrollRef,
    activeProject.arcId,
    [projectTurnKey(timeline, pendingAnswer, pendingTyped, sending),
      recordingTakes.at(-1)?.sessionId, freshReview?.sessionId].join(":"),
  );


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

  function turnTarget(retry?: PendingChatTurn) {
    const review = reviewContext;
    const questionInView = questionInTakeView(activeQuestion, review, reviewedTakeIds);
    const documentTake = idealOfferTake(ordinaryMessages.find((row) => row.client_id === openedIdealReply), recordingTakes);
    const idealFocus: TakeReviewTarget | null = documentTake ? { take: documentTake, focus: { step: "ideal" } } : null;
    const target = askTarget ?? (questionInView ? null : reviewFocusRef.current ?? takeReview ?? idealFocus);
    return { ...typedQuestionTarget(activeProject, questionInView, target, retry), review, target };
  }

  function beginTypedTurn(
    answer: string, captured: ReturnType<typeof turnTarget>, spoken?: SpokenChatAnswer, hasAudio = false,
  ) {
    const { focus, question, take, review, target } = captured;
    const arc = activeProject.arcId;
    const scope = { arcId: arc, takeSessionId: take, questionClientId: question?.client_id ?? "", place: "speaking" };
    const focusMetadata = focus ? { review_focus: focus } : {};
    const placement = placementForTurn(review, target ?? null, question);
    resumeLiveFeedback(placement.live_take_feedback);
    const pendingIds = new Set(outbox.turns.map((t) => t.user.client_id));
    return outbox.begin(spoken ? answer : draft, {
      role: "user", kind: "text", body: answer, clientId: spoken?.turnId, metadata: {
        ...typedProjectTurnMetadata({ ...scope, role: "answer" }),
        ...placement,
        ...focusMetadata,
        ...(spoken ? { will_voice: true, duration_ms: spoken.durationMs, ...(hasAudio ? { voice_clip: true } : {}) } : {}),
      },
    }, question, {
      question: answer, history: projectConversationHistory(messages.filter((m) => !pendingIds.has(m.client_id)), arc),
      historySource: "screen", projectId: arc, sessionId: take, place: "speaking", persist: thread.signedIn,
      voiceReceipt: spoken?.receipt,
      presentationContext: {
        has_current_project: true, completed_takes: Math.max(activeProject.takeCount, activeProject.takes.length),
        has_pdf: activeProject.takes.some((t) => t.hasSlides),
        ...placement,
        ...focusMetadata,
      },
    });
  }

  async function deliverTypedTurn(turn: PendingChatTurn) {
    const scope = { arcId: activeProject.arcId, takeSessionId: turn.request.sessionId ?? undefined,
      questionClientId: turn.question?.client_id ?? "", place: "speaking" };
    try {
      const result = await outbox.deliver(turn, (response) => {
        const exchange = turn.user.metadata?.take_exchange;
        return { role: "bot", kind: "text", body: replyBody(response, thread.messages),
          metadata: { ...typedProjectTurnMetadata({ ...scope, role: "reply" }), ...response.row_metadata,
            ...(offersNextTake(response) ? { suggested_action: "record_again" } : {}),
            ...(exchange === undefined ? {} : { take_exchange: exchange }) } };
      });
      if (result && outbox.isCurrent()) await refreshAfterReply(result.reply);
    } catch {
      if (outbox.isPending(turn)) {
        if (!turn.user.metadata?.will_voice) setDraft((current) => current || turn.draft);
        setTypingQuestion(turn.question?.client_id ?? null);
      }
    }
  }

  async function answerText(retry?: PendingChatTurn, spoken?: SpokenChatAnswer, captured = turnTarget(retry)): Promise<boolean> {
    const answer = retry?.request.question ?? spoken?.text ?? draft.trim();
    if (!answer || sending || sendingRef.current || !outbox.ready) return false;
    const { focus, question, take } = captured;
    const existing = retry ?? (spoken ? undefined : outbox.turns.findLast((t) => samePending(t, answer, take, question, focus)));
    if (existing && outbox.isSending(existing)) return false;
    sendingRef.current = true;
    setSending(true);
    try {
      const hasAudio = spoken ? await keepChatReplyAudio(spoken, userId) : false;
      if (!outbox.isCurrent()) return false;
      if (!retry) {
        setDraft("");
        if (spoken) setPreparedVoice(null);
      } else if (!spoken) setDraft((current) => current === retry.draft ? "" : current);
      setTypingQuestion(null);
      pinBottom();
      await deliverTypedTurn(existing ?? beginTypedTurn(answer, captured, spoken, hasAudio));
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
    return true;
  }

  function refreshAfterReply(reply: LoungeMessage) {
    if (offersIdealText(reply)) {
      setAskTarget((current) => current === askTarget ? null : current);
      const take = idealOfferTake(reply, recordingTakes);
      if (take && (!isTakeExchangeMessage(reply) || !reviewedTakeIds.has(take.sessionId))) {
        leaveAfterSave(documentExit.current, () => setOpenedIdealReply(reply.client_id));
      }
    }
    return thread.reload();
  }

  function resumeLiveFeedback(live: boolean) {
    if (live && takeReview?.replay) setTakeReview({ ...takeReview, replay: false, live: true });
  }

  async function rememberLiveOpening(draft: LoungeMessageDraft) {
    if (!userId || (await outboxOwner())?.id !== userId || !outbox.isCurrent()) return;
    await thread.append(draft);
  }

  function finishReview() {
    const closed = takeReview?.take.sessionId;
    setTakeReview(null);
    setAskTarget(null);
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
    leavingReview(() => {
      setAskTarget(null);
      setTakeReview(target);
    });
  }

  function reviewLink(message: LoungeMessage) {
    const destination = message.role === "bot" ? message.metadata?.review_destination as Partial<ReviewFocus> | undefined : undefined;
    const offeredStep = REVIEW_STEPS.find(({ step }) => step === destination?.step);
    const coords = offeredStep ? destination : message.metadata?.review_focus as Partial<ReviewFocus> | null;
    if (!coords || !["feedback", "practise", "ideal"].includes(coords.step ?? "")) return null;
    const take = recordingTakes.find((part) => part.sessionId === message.metadata?.take_session_id);
    if (!take) return null;
    const label = typeof coords.slide_index === "number" ? ` · Slide ${coords.slide_index + 1}` : "";
    const title = offeredStep?.label ?? "Take " + take.takeIndex + label + " · Back to review";
    return <button type="button" className="block min-h-11 text-xs underline" onClick={() => openReview({
      take, focus: coords as ReviewFocus, openedFromAt: message.client_created_at,
    })}>{title}</button>;
  }

  function recordNext() {
    if (recordingActive) return;
    leavingReview(() => {
      keepNextTakeShare(null);
      clearPracticeResume(userId, activeProject.arcId);
      startRecording();
      onRecord(activeProject.arcId);
    });
  }

  function recordOffer(message: LoungeMessage) {
    return message.role === "bot" && offersNextTake(message.metadata)
      ? <RecordNextTakeLink offer={message.metadata} onRecord={recordNext} /> : null;
  }

  function replyActions(message: LoungeMessage, inReview = false) {
    if (message.role !== "bot") return null;
    const destination = inReview && message.metadata?.review_destination ? reviewLink(message) : null;
    const offer = recordOffer(message);
    return destination || offer ? <>{destination}{offer}</> : null;
  }


  function renderTake(take: TrainingTake) {
    const selected = takeReview?.take.sessionId === take.sessionId ? { ...takeReview, take } : null;
    const forTake = messages.filter((message) => message.metadata?.take_session_id === take.sessionId);
    const preview = takePreview(forTake);
    return <div key={take.sessionId} data-project-take={take.sessionId} className="flex flex-col gap-2">
      <div className={WILLAB_CONTENT_RAIL}>
        <div data-project-recording={take.sessionId}
          className={PROJECT_SPEAKER_BUBBLE + " ml-auto w-fit max-w-[86%] rounded-[18px] px-4 py-3"}>
          <p className="text-[15px] font-semibold">Your recording · Take {take.takeIndex}</p>
          <button type="button" onClick={() => setOpenedTranscript({ sessionId: take.sessionId, takeIndex: take.takeIndex })}
            className="mt-1 text-left text-[13px] underline underline-offset-2">
            Open raw transcript
          </button>
        </div>
      </div>
      {selected || readyForReview(take) ? <TakeConversation title={`Take ${take.takeIndex} · Feedback walk`}
        preview={preview} expanded={Boolean(selected)} showPreview={Boolean(selected?.replay)}
        onExpandedChange={(open) => {
          if (open) openReview({ take, replay: true, focus: { step: "feedback" } });
          else leavingReview(finishReview);
        }}>
        {selected ? <TakeReview key={take.sessionId} project={activeProject} target={selected}
        runs={runs[take.sessionId] ?? []} messages={forTake} recordingDock={recordingDock} exitRef={reviewExit} focusRef={reviewFocusRef}
        onAsk={(target) => { setAskTarget(target); composerRef.current?.focus({ preventScroll: true }); }}
        onClose={() => leavingReview(finishReview)} rememberOpening={rememberLiveOpening}
        onPracticeEnded={() => { refreshRuns(); void thread.reload(); }}
        savedWordings={linkedWording} onWordingSaved={() => { void thread.reload(); }}
        renderFooter={(message) => {
          const retry = failedTurns.get(message.client_id);
          return retry ? <div data-project-chat-error>
            <ChatTurnRetry disabled={sending || outbox.readingHistory} onRetry={() => void answerText(retry)} />
          </div> : replyActions(message, !selected.live && message.metadata?.live_take_feedback !== true);
        }} /> : null}
      </TakeConversation> : null}
    </div>;
  }

  function renderMessage(message: LoungeMessage, ideal?: TrainingTake) {
    const link = ideal ? null : reviewLink(message);
    return (
      message.role === "system" && message.metadata?.coach_wording_saved === true ? (
        linkedWording.has(String(message.metadata.wording_reply_id)) ? null :
          <CoachWordingCard key={message.client_id} message={message} project={activeProject.arcId} recordingDock={recordingDock} />
      ) : message.client_id === activeQuestion?.client_id ? (
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
          {hasTakeReplyContent(message) ? (
            <TakeConversationMessage message={message} project={activeProject.arcId} recordingDock={recordingDock} standalone
              wordingSaved={linkedWording.has(message.client_id)} onWordingSaved={() => { void thread.reload(); }}>
              {link}
            </TakeConversationMessage>
          ) : (
            <div
              data-project-message={message.client_id}
              className={`max-w-[86%] whitespace-pre-wrap rounded-[18px] px-4 py-2.5 text-[15px] leading-relaxed empty:hidden ${
                message.role === "user"
                  ? "ml-auto " + PROJECT_SPEAKER_BUBBLE
                  : "mr-auto bg-muted text-foreground"
              }`}
            >
              {message.metadata?.human_coach_author === "Artur" && <p className="mb-1 text-[13px] font-medium text-muted-foreground">Artur · Speaking coach</p>}
              {message.role === "bot" ? withoutCoachTranscriptFooter(message.body) : message.body}
              {link}
            </div>
          )}
          {replyActions(message)}
          {failedTurns.has(message.client_id) && (
            <div data-project-chat-error>
              <ChatTurnRetry disabled={sending || outbox.readingHistory} onRetry={() => void answerText(failedTurns.get(message.client_id))} />
            </div>
          )}
        </Fragment>
      )
    );
  }

  function renderOrdinaryMessage(message: LoungeMessage) {
    const take = idealOfferTake(message, recordingTakes);
    const close = () => leaveAfterSave(documentExit.current, () => setOpenedIdealReply(null));
    return <div key={message.client_id} className="flex min-w-0 flex-col gap-2 empty:hidden">
      <div className={WILLAB_CONTENT_RAIL + " flex min-w-0 flex-col gap-2 empty:hidden"}>
        {renderMessage(message, take)}
      </div>
      {take ? <TakeConversation title="Ideal text" expanded={openedIdealReply === message.client_id}
        onExpandedChange={(open) => open
          ? leaveAfterSave(documentExit.current, () => setOpenedIdealReply(message.client_id))
          : close()}>
        <InlineTakeIdealText project={activeProject} take={take} exitRef={documentExit} onClose={close} />
      </TakeConversation> : null}
    </div>;
  }

  function sendDraft(value: string) {
    return stagedVoice ? answerText(undefined, { ...stagedVoice.answer, text: value.trim() }, stagedVoice.target) : answerText();
  }

  function changeDraft(value: string) {
    setDraft(value);
    if (!value.trim()) setPreparedVoice(null);
  }

  function composerStatus() {
    return voice.error ? <p role="alert" className="px-2 pb-1 text-sm">
      {voice.error} {voice.retry ? <button type="button" onClick={() => void voice.retry?.()} className="underline">Try again</button> : null}
    </p> : undefined;
  }

  function processingStatus() {
    if (pendingRecording && !recordingTakes.some((take) =>
      take.uploadKey === pendingRecording.key || take.sessionId === pendingRecording.sessionId)) {
      return <PendingRecordingBubbles take={pendingRecording} onOpen={() => onOpenPendingRecording?.(pendingRecording)} />;
    }
    return <ProjectProcessingStatus active={recordingActive} failed={failed} marker={processingMarker}
      retrying={retrying} onRetry={() => void retryProcessing()} />;
  }

  return (
    <div data-project-chat className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
      <ProjectChatHeader project={activeProject} onBack={workspace ? undefined : back} />

      <div ref={scrollRef} data-project-scroll className="scrollbar-none flex-1 overflow-y-auto px-4 py-4">
        <div className="flex min-h-full w-full flex-col justify-end gap-2">
          {projectTimeline(recordingTakes, ordinaryMessages, messages).map((entry) =>
            entry.kind === "take" ? renderTake(entry.take) : renderOrdinaryMessage(entry.message)
          )}
          <div className={`${WILLAB_CONTENT_RAIL} flex min-w-0 flex-col gap-2 empty:hidden`}>
          <PendingProjectAnswer pending={pendingAnswer} visibleMessages={visibleMessages} />
          <ProjectChatTurnError pendingTap={pendingTap} />
          {processingStatus()}
          {sending || voice.sending ? <TypingDots label={voice.sending && !sending ? "Processing your recording" : "Will is replying"} /> : null}
          </div>
        </div>
      </div>

      <div ref={setRecordingDock} data-project-walk-capture className={WILLAB_CONTENT_RAIL + " peer empty:hidden"} />
      <div className="peer-[:not(:empty)]:hidden">
      <ChatComposer key={activeProject.arcId} className={WILLAB_CONTENT_RAIL}
        inputRef={composerRef}
        above={askTarget ? <ProjectReviewContext target={askTarget} onClear={() => setAskTarget(null)} /> : undefined}
        formAttrs={{ "data-project-question-composer": "" }} placeholder={activeQuestion ? TYPE_YOUR_ANSWER : "Message about this project"}
        inputLabel="Answer about this take" sendLabel="Send answer" value={draft}
        onValue={changeDraft} onSend={sendDraft}
        autoFocus={Boolean(stagedVoice) || typingAnswer || Boolean(askTarget) || pendingTyped?.phase === "send_failed"} busy={sending || voice.sending}
        files={slides.item ? [{ label: slides.item.label, open: slides.item.onOpen }] : undefined}
        mic={voice.mic}
        recording={voice.recording} status={composerStatus()} />
      </div>
      {slides.layer}
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
