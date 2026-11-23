"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Send } from "lucide-react";
import { fetchTrainings, type TrainingArc } from "@/services/api/trainings";
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
  PRACTICE_CHUNK_SECONDS,
  readPracticeCheckpoint,
  writePracticeResume,
} from "@/lib/willab/practiceResume";
import { WILLAB_CONTENT_RAIL } from "@/lib/willab/layout";
import { usePinThreadBottom } from "./usePinThreadBottom";
import TakeReview, { type ReviewFocus, type TakeReviewTarget } from "./TakeReview";
import TakeReviewMessage from "./TakeReviewMessage";
import { readReviewRuns, type ReviewRuns } from "@/services/api/takeReview";

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
      ? [latest.sessionId, latest.takeIndex, latest.feedbackAvailable]
      : null,
    chunks: project.practiceChunks,
  });
}

function useProjectRecordingLifecycle({
  project,
  userId,
  thread,
  recordingInProgress,
  onRecordingSettled,
}: {
  project: TrainingArc;
  userId: string | null;
  thread: ReturnType<typeof useLoungeThreadCtx>;
  recordingInProgress: boolean;
  onRecordingSettled?: () => void;
}) {
  const [liveProject, setLiveProject] = useState(project);
  const [recordingActive, setRecordingActive] = useState(recordingInProgress);
  const [processingMarker, setProcessingMarker] = useState<ProcessingTake | null>(null);
  const [retrying, setRetrying] = useState(false);
  const threadRef = useRef(thread);
  const candidateSessionRef = useRef<string | null>(null);
  threadRef.current = thread;
  const activeProject = liveProject.arcId === project.arcId ? liveProject : project;

  useEffect(() => {
    setLiveProject(project);
    setRecordingActive(recordingInProgress);
  }, [project, recordingInProgress]);

  useEffect(() => {
    const sync = () => {
      const marker = readProcessingTake(userId);
      if (marker?.arcId === activeProject.arcId) {
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
      if (
        latest &&
        latest.sessionId === candidateSessionRef.current &&
        latest.feedbackAvailable
      ) {
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
  }, [activeProject, onRecordingSettled, recordingActive]);

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
      const now = Date.now();
      const next = {
        ...marker,
        status: "processing" as const,
        phase: "analysis" as const,
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
    failed,
    processingMarker,
    recordingActive,
    retrying,
    retryProcessing,
    startRecording: () => {
      candidateSessionRef.current = null;
      setRecordingActive(true);
    },
  };
}

function ProjectChatComposer({ draft, sending, typingAnswer, chipCount, failed, onDraft, onSend }: {
  draft: string; sending: boolean; typingAnswer: boolean; chipCount: number; failed: boolean;
  onDraft: (value: string) => void; onSend: () => void;
}) {
  return (
    <div className="shrink-0 bg-background px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-2">
      <form data-project-question-composer onSubmit={(event) => { event.preventDefault(); onSend(); }}
        className={`${WILLAB_CONTENT_RAIL} relative flex items-end`}>
        <textarea
          autoFocus={typingAnswer || chipCount === 0 || failed}
          rows={1} disabled={sending} value={draft} onChange={(event) => onDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder={TYPE_YOUR_ANSWER} aria-label="Answer about this take"
          autoComplete="off" autoCorrect="on" autoCapitalize="sentences" spellCheck
          className={`scrollbar-none block max-h-40 min-h-[42px] w-full resize-none overflow-x-hidden rounded-3xl border border-border bg-background py-[10px] pl-3.5 text-[15px] leading-5 outline-none focus:border-primary ${draft.trim() ? "pr-11" : "pr-4"}`}
        />
        {draft.trim() ? (
          <button type="submit" disabled={sending} aria-label="Send answer" className="absolute bottom-[5px] right-[5px] flex h-8 w-8 items-center justify-center rounded-full text-foreground disabled:text-muted-foreground">
            <Send className="h-5 w-5" aria-hidden />
          </button>
        ) : null}
      </form>
    </div>
  );
}

function useProjectPracticeHistory(project: TrainingArc, messages: readonly LoungeMessage[]) {
  const [runs, setRuns] = useState<ReviewRuns>({});
  const [refresh, setRefresh] = useState(0);
  const enabled = project.practiceCoverage !== undefined;
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

function projectBar(question: boolean, anchored: boolean, compose: boolean) {
  const composer = question || anchored || compose;
  return { composer, toggle: !question && !anchored, record: !composer };
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

function ProjectChatHeader({ project, coach, toggle, composing, onToggle, onBack }: {
  project: TrainingArc; coach: boolean; toggle: boolean; composing: boolean;
  onToggle: () => void; onBack: () => void;
}) {
  return <TopBar circle={<LetterCircle id={project.arcId} name={project.topic} size={36} />}
    title={coach ? "Speaking coach" : project.topic} subtitle={coach ? project.topic : "Project"}
    right={toggle ? <button type="button" className="min-h-11 px-2 text-sm text-muted-foreground" onClick={onToggle}>
      {composing ? "Record" : "Ask coach"}
    </button> : null} onBack={onBack} />;
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
  coachContext = false,
  initialReview = null,
  onBack,
  onRecord,
  onRecordingSettled,
}: {
  project: TrainingArc;
  analysisPending?: boolean;
  /** Set when this chat returns from its own recorder. It bridges the short
   *  gap before the accepted Take has a session/processing marker. */
  recordingInProgress?: boolean;
  coachContext?: boolean;
  initialReview?: TakeReviewTarget | null;
  onBack: () => void;
  onRecord: (arcId: string) => void;
  onRecordingSettled?: () => void;
}) {
  useBackDismiss(onBack);
  const coach = usePublishedCoach();
  const userId = useUserId();
  const thread = useLoungeThreadCtx();
  const {
    activeProject,
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
    onRecordingSettled,
  });
  const [opened, setOpened] = useState<Opened>(null);
  const [openedPractice, setOpenedPractice] = useState<FeedbackWalkChunk | null>(null);
  const [takeReview, setTakeReview] = useState<TakeReviewTarget | null>(initialReview);
  const [askTarget, setAskTarget] = useState<TakeReviewTarget | null>(null);
  const [compose, setCompose] = useState(coachContext);
  const { enabled: takeReviewEnabled, runs, refreshRuns } = useProjectPracticeHistory(activeProject, thread.messages);
  const [openedTranscript, setOpenedTranscript] = useState<{
    sessionId: string;
    takeIndex: number;
  } | null>(null);
  const reviewSelection = projectReviewSelection(opened, openedPractice);
  const [draft, setDraft] = useState("");
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
    (message) => message.kind !== "walk_step" && message.kind !== "ideal_text" && message.kind !== "recording_summary",
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
  const bar = projectBar(Boolean(activeQuestion), Boolean(askTarget), compose);
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
    setTakeReview(null);
    refreshRuns();
    void thread.reload();
  }

  function reviewLink(message: LoungeMessage) {
    const coords = message.metadata?.review_focus as Partial<ReviewFocus> | null;
    if (!coords || !["feedback", "practise", "ideal"].includes(coords.step ?? "")) return null;
    const take = recordingTakes.find((part) => part.sessionId === message.metadata?.take_session_id);
    if (!take) return null;
    const label = typeof coords.slide_index === "number" ? ` · Slide ${coords.slide_index + 1}` : "";
    return <button type="button" className="block min-h-8 text-xs underline" onClick={() => setTakeReview({
      take, focus: coords as ReviewFocus,
    })}>Take {take.takeIndex}{label} · Back to review</button>;
  }

  function startPractice(scope: "fragment" | "whole"): void {
    const latest = openedPractice ?? practiceChunks.at(-1) ?? null;
    const startSlide = scope === "whole" ? 1 : latest?.startSlide ?? 1;
    const endSlide = scope === "whole"
      ? slideCount ?? undefined
      : latest?.endSlide ?? slideCount ?? undefined;
    writePracticeResume(userId, activeProject.arcId, {
      durationSeconds: PRACTICE_CHUNK_SECONDS,
      slideIndex: Math.max(0, startSlide - 1),
      scope,
      startSlide,
      ...(endSlide === undefined ? {} : { endSlide }),
    });
    setOpened(null);
    startRecording();
    onRecord(activeProject.arcId);
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
    <div data-project-chat className="absolute inset-0 z-30 flex flex-col bg-background">
      <div className="contents" aria-hidden={Boolean(takeReview)}
        ref={(element) => { if (element) element.inert = Boolean(takeReview); }}>
      <ProjectChatHeader project={activeProject} coach={coachContext} toggle={bar.toggle}
        composing={compose} onToggle={() => setCompose((mode) => !mode)} onBack={onBack} />

      <div ref={scrollRef} data-project-scroll className="scrollbar-none flex-1 overflow-y-auto px-4 py-4">
        <div className={`${WILLAB_CONTENT_RAIL} flex min-h-full flex-col justify-end gap-2`}>
          {recordingTakes.map((take) => (
            <div
              key={`recording:${take.sessionId}`}
              data-project-recording={take.sessionId}
              className="ml-auto max-w-[86%] rounded-[18px] bg-primary px-4 py-3 text-primary-foreground"
            >
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
          ))}
          {takeReviewEnabled ? (
            <TakeReviewMessage project={activeProject} runs={runs} onOpen={setTakeReview} />
          ) : hasPractice ? (
            <div data-project-results className="mb-2 w-full max-w-[480px] self-start">
              <FeedbackWalkCard
                progress={activeProject.practiceProgress}
                chunks={practiceChunks}
                onFeedback={(chunk) => {
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
                className={`max-w-[86%] whitespace-pre-wrap rounded-[18px] px-4 py-2.5 text-[15px] leading-relaxed ${
                  message.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "mr-auto bg-muted text-foreground"
                }`}
              >
                {message.body}
                {reviewLink(message)}
              </div>
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

      {bar.composer ? (
        <>
          {askTarget ? <ProjectReviewContext topic={activeProject.topic} target={askTarget}
            onReturn={() => setTakeReview(askTarget)} onClear={() => setAskTarget(null)} /> : null}
          <ProjectChatComposer draft={draft} sending={sending} typingAnswer={typingAnswer || askTarget !== null}
            chipCount={chips.length} failed={pendingTyped?.phase === "send_failed"}
            onDraft={setDraft} onSend={() => void answerText()} />
        </>
      ) : null}
      {bar.record ? (
        <div className="shrink-0 bg-background px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
          <button type="button" data-project-record onClick={() => recordNext()}
            className={`${WILLAB_CONTENT_RAIL} flex h-[58px] items-center justify-center gap-3 rounded-full bg-foreground text-[16px] font-semibold text-background`}>
            <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-[#ff4d3d]" />
            {recordLabel(coach, Boolean(hasPractice))}
          </button>
        </div>
      ) : null}
      </div>

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
          practiceDecision={hasPractice ? {
            deliveryLabel:
              openedPractice?.deliveryLabel ??
              practiceChunks.at(-1)?.deliveryLabel ??
              undefined,
            onFragment: () => startPractice("fragment"),
            onWholePresentation: () => startPractice("whole"),
          } : undefined}
        />
      ) : null}
      {takeReview ? (
        <TakeReview key={takeReview.take.sessionId + ":" + takeReview.focus.step}
          project={activeProject} target={takeReview} runCount={runs[takeReview.take.sessionId]?.length ?? 0}
          onAsk={(target) => { setAskTarget(target); finishReview(); }}
          onClose={() => { setAskTarget(null); finishReview(); }}
          onPracticeEnded={() => { refreshRuns(); void thread.reload(); }}
          onNextTake={() => {
            const chunk = practiceChunks.find((entry) => entry.latestSessionId === takeReview.take.sessionId);
            finishReview();
            recordNext(chunk);
          }} />
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
