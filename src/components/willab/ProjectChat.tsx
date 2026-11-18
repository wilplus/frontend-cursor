"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Send } from "lucide-react";
import { fetchTrainings, type TrainingArc } from "@/services/api/trainings";
import {
  newestStamp,
  stampLoungeMessage,
  type LoungeMessage,
} from "@/services/api/loungeMessages";
import { postChatQuery, type ChatQueryResponse } from "@/services/api/chatQuery";
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
import type { RecoverableAppend } from "./useLoungeThread";
import FeedbackWalkCard, { type FeedbackWalkChunk } from "./FeedbackWalkCard";
import IdealTextOverlay from "./IdealTextOverlay";
import TakeTranscriptSheet from "./TakeTranscriptSheet";
import TypingDots, { TypingGlyph } from "./TypingDots";
import WillQuestionBubble, { SOMETHING_ELSE, TYPE_YOUR_ANSWER } from "./WillQuestion";
import { LetterCircle } from "./chats/ChatList";
import { TopBar } from "./chats/TopBar";
import { useBackDismiss } from "./useBackDismiss";
import { useUserId } from "./useUserId";
import { refreshLiveIdealDoc } from "./ReportCard";
import {
  PRACTICE_CHUNK_SECONDS,
  readPracticeCheckpoint,
  writePracticeResume,
} from "@/lib/willab/practiceResume";
import { WILLAB_CONTENT_RAIL } from "@/lib/willab/layout";
import { usePinThreadBottom } from "./usePinThreadBottom";

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

type PendingTypedTurn = {
  question: LoungeMessage;
  user: LoungeMessage;
  outbox: RecoverableAppend;
  draft: string;
  phase: "sending" | "send_failed" | "store_failed";
};

type PendingTapTurn = {
  question: LoungeMessage;
  user: LoungeMessage;
  phase: "sending" | "send_failed";
};

function projectTurnKey(
  visibleMessages: readonly LoungeMessage[],
  pendingAnswer: PendingTypedTurn | PendingTapTurn | null,
  pendingTyped: PendingTypedTurn | null,
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

function ProjectChatTurnError({
  pendingTyped,
  pendingTap,
}: {
  pendingTyped: PendingTypedTurn | null;
  pendingTap: PendingTapTurn | null;
}) {
  const typedFailed = pendingTyped !== null && pendingTyped.phase !== "sending";
  const tapFailed = pendingTap?.phase === "send_failed";
  if (!typedFailed && !tapFailed) return null;
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
  pending: PendingTypedTurn | PendingTapTurn | null;
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

type StoredTypedTurn = {
  body: string;
  draft: string;
  user: RecoverableAppend;
  reply: RecoverableAppend;
};

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

export default function ProjectChat({
  project,
  analysisPending = false,
  recordingInProgress = false,
  onBack,
  onRecord,
  onRecordingSettled,
}: {
  project: TrainingArc;
  analysisPending?: boolean;
  /** Set when this chat returns from its own recorder. It bridges the short
   *  gap before the accepted Take has a session/processing marker. */
  recordingInProgress?: boolean;
  onBack: () => void;
  onRecord: (arcId: string) => void;
  onRecordingSettled?: () => void;
}) {
  useBackDismiss(onBack);
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
  const [openedTranscript, setOpenedTranscript] = useState<{
    sessionId: string;
    takeIndex: number;
  } | null>(null);
  const reviewSelection = projectReviewSelection(opened, openedPractice);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [typingQuestion, setTypingQuestion] = useState<string | null>(null);
  const [pendingTyped, setPendingTyped] = useState<PendingTypedTurn | null>(null);
  const [pendingTap, setPendingTap] = useState<PendingTapTurn | null>(null);
  const storedTypedRef = useRef<StoredTypedTurn | null>(null);
  const [slideCount, setSlideCount] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messages = useMemo(
    () => orderedProjectMessages(thread.messages, activeProject.arcId).filter(
      (message) => !isPersistedTerminalReplay(message, thread.messages),
    ),
    [thread.messages, activeProject.arcId],
  );
  const visibleMessages = messages.filter(
    (message) => message.kind !== "walk_step" && message.kind !== "ideal_text" && message.kind !== "recording_summary",
  );
  const question = openProjectQuestion(messages);
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

  async function answerText(): Promise<void> {
    const submittedDraft = draft;
    const answer = submittedDraft.trim();
    const take = questionMeta.take_session_id;
    const arc = questionMeta.arc_id;
    if (!answer || sending || !activeQuestion || typeof take !== "string" || typeof arc !== "string") return;

    const stored = storedTypedRef.current;
    if (pendingTyped?.phase === "store_failed" && stored?.body === answer) {
      setDraft("");
      setSending(true);
      setPendingTyped((pending) => pending ? { ...pending, phase: "sending" } : pending);
      const [userStored, replyStored] = await Promise.all([stored.user.retry(), stored.reply.retry()]);
      if (userStored && replyStored) {
        storedTypedRef.current = null;
        await thread.reload();
        setPendingTyped(null);
        setTypingQuestion(null);
      } else {
        setDraft(stored.draft);
        setPendingTyped((pending) => pending ? { ...pending, phase: "store_failed" } : pending);
      }
      setSending(false);
      return;
    }

    const failedSend = pendingTyped?.phase === "send_failed" && pendingTyped.user.body === answer
      ? pendingTyped
      : null;
    const turnQuestion = failedSend?.question ?? activeQuestion;
    const retryDraft = failedSend?.draft ?? submittedDraft;
    const metadata = typedProjectTurnMetadata({
      arcId: arc,
      takeSessionId: take,
      questionClientId: turnQuestion.client_id,
      role: "answer",
      place: "speaking",
    });
    const outbox = failedSend?.outbox ?? thread.appendRecoverable({
      role: "user",
      kind: "text",
      body: answer,
      metadata,
    });
    const optimistic = outbox.message;
    setDraft("");
    setTypingQuestion(null);
    setPendingTyped({
      question: turnQuestion,
      user: optimistic,
      outbox,
      draft: retryDraft,
      phase: "sending",
    });
    setSending(true);
    pinBottom();
    try {
      const [response, userStored] = await Promise.all([
        postChatQuery({
          question: answer,
          history: projectConversationHistory(
            messages.filter((message) => message.client_id !== optimistic.client_id),
            arc,
          ),
          historySource: "screen",
          sessionId: take,
          place: "speaking",
          persist: thread.signedIn,
          clientId: optimistic.client_id,
          clientCreatedAt: optimistic.client_created_at,
          presentationContext: {
            has_current_project: true,
            completed_takes: Math.max(activeProject.takeCount, activeProject.takes.length),
            has_pdf: activeProject.takes.some((projectTake) => projectTake.hasSlides),
          },
        }),
        failedSend ? outbox.retry() : outbox.stored,
      ]);
      if (thread.signedIn && response.persisted !== true) {
        // A 200 can still mean the backend did not durably own the turn. Keep
        // the exact optimistic row and draft; retry reuses its idempotency key.
        setDraft(retryDraft);
        setPendingTyped({
          question: turnQuestion,
          user: optimistic,
          outbox,
          draft: retryDraft,
          phase: "send_failed",
        });
        setTypingQuestion(turnQuestion.client_id);
        return;
      }
      const body = replyBody(response);
      if (!body) throw new Error("Typed chat returned no reply");
      if (isReplayedTerminalReply(body, thread.messages)) {
        throw new Error("Typed chat returned stale terminal copy");
      }

      const replyMetadata = {
        ...typedProjectTurnMetadata({
          arcId: arc,
          takeSessionId: take,
          questionClientId: turnQuestion.client_id,
          role: "reply",
          place: "speaking",
        }),
        ...(response.row_metadata ?? {}),
      };
      if (thread.signedIn) {
        // The backend has already persisted both rows under the optimistic
        // user's exact identity and may have released the held after-Take row.
        // Keep its reply visible locally while the authoritative thread lands.
        thread.appendLocalOnly({ role: "bot", kind: "text", body, metadata: replyMetadata });
        storedTypedRef.current = null;
        await thread.reload();
        setPendingTyped(null);
        return;
      }

      const reply = thread.appendRecoverable({
        role: "bot",
        kind: "text",
        body,
        metadata: replyMetadata,
      });
      storedTypedRef.current = { body: answer, draft: retryDraft, user: outbox, reply };
      const replyStored = await reply.stored;
      if (!userStored || !replyStored) {
        setDraft(retryDraft);
        setPendingTyped((pending) => pending ? { ...pending, phase: "store_failed" } : pending);
        return;
      }
      storedTypedRef.current = null;
      await thread.reload();
      setPendingTyped(null);
    } catch {
      storedTypedRef.current = null;
      setDraft(retryDraft);
      setPendingTyped({
        question: turnQuestion,
        user: optimistic,
        outbox,
        draft: retryDraft,
        phase: "send_failed",
      });
      setTypingQuestion(turnQuestion.client_id);
    } finally {
      setSending(false);
    }
  }

  async function submitTypedAnswer(): Promise<void> {
    await answerText();
  }

  const closeResult = () => {
    setOpened(null);
    setOpenedPractice(null);
    void thread.reload();
  };

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

  return (
    <div data-project-chat className="absolute inset-0 z-30 flex flex-col bg-background">
      <TopBar
        circle={<LetterCircle id={activeProject.arcId} name={activeProject.topic} size={36} />}
        title={activeProject.topic}
        subtitle="Project"
        onBack={onBack}
      />

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
          {hasPractice ? (
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
              <div
                key={message.client_id}
                data-project-message={message.client_id}
                className={`max-w-[86%] whitespace-pre-wrap rounded-[18px] px-4 py-2.5 text-[15px] leading-relaxed ${
                  message.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "mr-auto bg-muted text-foreground"
                }`}
              >
                {message.body}
              </div>
            )
          ))}
          <PendingProjectAnswer pending={pendingAnswer} visibleMessages={visibleMessages} />
          <ProjectChatTurnError pendingTyped={pendingTyped} pendingTap={pendingTap} />
          {recordingActive && !failed ? (
            <div className="mr-auto flex max-w-[88%] items-end gap-1.5">
              <div
                data-processing-bubble
                role="status"
                className="flex items-center gap-2.5 rounded-[16px] bg-muted px-3 py-2 text-left text-[15px] leading-[1.45] text-foreground"
              >
                <TypingGlyph />
                <span>Processing your recording</span>
              </div>
            </div>
          ) : null}
          {failed ? (
            <div
              data-processing-error
              role="alert"
              className="mr-auto flex max-w-[88%] flex-col gap-2 rounded-[16px] bg-destructive/10 px-3 py-2 text-[14px] leading-[1.45] text-destructive"
            >
              <span>We couldn&apos;t finish preparing your feedback.</span>
              <button
                type="button"
                disabled={retrying}
                onClick={() => void retryProcessing()}
                className="self-start underline underline-offset-2 disabled:opacity-60"
              >
                {retrying ? "Trying again…" : "Try processing again"}
              </button>
            </div>
          ) : null}
          {sending ? <TypingDots label="Will is replying" /> : null}
        </div>
      </div>

      {activeQuestion ? (
          <div className="shrink-0 bg-background px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-2">
            <form
              data-project-question-composer
              onSubmit={(event) => { event.preventDefault(); void submitTypedAnswer(); }}
              className={`${WILLAB_CONTENT_RAIL} relative flex items-end`}
            >
              <textarea
                autoFocus={typingAnswer || chips.length === 0 || pendingTyped?.phase === "store_failed"}
                rows={1}
                disabled={sending}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder={TYPE_YOUR_ANSWER}
                aria-label="Answer about this take"
                autoComplete="off"
                autoCorrect="on"
                autoCapitalize="sentences"
                spellCheck
                className={`scrollbar-none block max-h-40 min-h-[42px] w-full resize-none overflow-x-hidden rounded-3xl border border-border bg-background py-[10px] pl-3.5 text-[15px] leading-5 outline-none focus:border-primary ${draft.trim() ? "pr-11" : "pr-4"}`}
              />
              {draft.trim() ? (
                <button type="submit" disabled={sending} aria-label="Send answer" className="absolute bottom-[5px] right-[5px] flex h-8 w-8 items-center justify-center rounded-full text-foreground disabled:text-muted-foreground">
                  <Send className="h-5 w-5" aria-hidden />
                </button>
              ) : null}
            </form>
          </div>
      ) : (
        <div className="shrink-0 bg-background px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
          <button type="button" data-project-record onClick={() => {
            if (hasPractice) setOpened("decision");
            else {
              startRecording();
              onRecord(activeProject.arcId);
            }
          }} className={`${WILLAB_CONTENT_RAIL} flex h-[58px] items-center justify-center gap-3 rounded-full bg-foreground text-[16px] font-semibold text-background`}>
            <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-[#ff4d3d]" />
            {hasPractice ? "Continue recording" : "Start recording"}
          </button>
        </div>
      )}

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
