"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Send } from "lucide-react";
import type { TrainingArc } from "@/services/api/trainings";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import { postWillQuestion } from "@/services/api/willQuestion";
import { fetchArcSetup } from "@/services/api/arcSetup";
import { openProjectQuestion, orderedProjectMessages } from "@/lib/willab/projectChat";
import { useLoungeThreadCtx } from "./LoungeThreadContext";
import FeedbackWalkCard, { type FeedbackWalkChunk } from "./FeedbackWalkCard";
import IdealTextOverlay from "./IdealTextOverlay";
import TypingDots from "./TypingDots";
import WillQuestionBubble, { SOMETHING_ELSE, TYPE_YOUR_ANSWER } from "./WillQuestion";
import { LetterCircle } from "./chats/ChatList";
import { TopBar } from "./chats/TopBar";
import { useBackDismiss } from "./useBackDismiss";
import { useUserId } from "./useUserId";
import {
  PRACTICE_CHUNK_SECONDS,
  readPracticeCheckpoint,
  writePracticeResume,
} from "@/lib/willab/practiceResume";

type Opened = "walk" | "ideal" | "decision" | null;

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
  const knownChunks: FeedbackWalkChunk[] = project.practiceChunks;
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

export default function ProjectChat({
  project,
  analysisPending = false,
  onBack,
  onRecord,
}: {
  project: TrainingArc;
  analysisPending?: boolean;
  onBack: () => void;
  onRecord: () => void;
}) {
  useBackDismiss(onBack);
  const userId = useUserId();
  const thread = useLoungeThreadCtx();
  const [opened, setOpened] = useState<Opened>(null);
  const [openedTake, setOpenedTake] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [typingQuestion, setTypingQuestion] = useState<string | null>(null);
  const [slideCount, setSlideCount] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messages = useMemo(
    () => orderedProjectMessages(thread.messages, project.arcId),
    [thread.messages, project.arcId],
  );
  const visibleMessages = messages.filter(
    (message) => message.kind !== "walk_step" && message.kind !== "ideal_text" && message.kind !== "recording_summary",
  );
  const question = openProjectQuestion(messages);
  const typingAnswer = question !== null && typingQuestion === question.client_id;
  const questionMeta = question?.metadata ?? {};
  const chips = Array.isArray(questionMeta.chips)
    ? questionMeta.chips.filter((chip): chip is string => typeof chip === "string" && chip.length > 0)
    : [];
  const checkpoint = readPracticeCheckpoint(userId, project.arcId);
  const { hasPractice, chunks: practiceChunks } = projectPracticeView(
    project,
    thread.messages,
    checkpoint,
  );
  const finalFragment =
    slideCount !== null && checkpoint >= slideCount - 1;
  const latestPractice = practiceChunks.at(-1) ?? null;

  useEffect(() => {
    let active = true;
    void fetchArcSetup(project.arcId).then((setup) => {
      if (!active || !setup) return;
      // Deckless practice uses the product's three-part default deck.
      setSlideCount(Math.max(1, setup.slides.length || 3));
    });
    return () => {
      active = false;
    };
  }, [project.arcId]);

  async function answerChip(choice: string): Promise<void> {
    const take = questionMeta.take_session_id;
    if (sending || typeof take !== "string") return;
    setSending(true);
    try {
      await postWillQuestion(project.arcId, take, choice);
      await thread.reload();
    } finally {
      setSending(false);
    }
  }

  async function answerChoice(choice: string): Promise<void> {
    if (choice === SOMETHING_ELSE) {
      setDraft("");
      setTypingQuestion(question?.client_id ?? null);
      return;
    }
    await answerChip(choice);
  }

  async function answerText(): Promise<void> {
    const answer = draft.trim();
    const take = questionMeta.take_session_id;
    if (!answer || sending || typeof take !== "string") return;
    setDraft("");
    setSending(true);
    try {
      if (await postWillQuestion(project.arcId, take, answer)) {
        setTypingQuestion(null);
        await thread.reload();
      }
    } finally {
      setSending(false);
    }
  }

  const closeResult = () => {
    setOpened(null);
    setOpenedTake(null);
    void thread.reload();
  };

  function startPractice(intent: "next" | "repeat"): void {
    if (intent === "next" && finalFragment) {
      setOpened(null);
      void thread.reload();
      return;
    }
    writePracticeResume(userId, project.arcId, {
      durationSeconds: PRACTICE_CHUNK_SECONDS,
      slideIndex: Math.max(0, checkpoint + (intent === "next" ? 1 : 0)),
    });
    setOpened(null);
    onRecord();
  }

  return (
    <div data-project-chat className="absolute inset-0 z-30 flex flex-col bg-background">
      <div className="mx-auto w-full max-w-4xl shrink-0">
        <TopBar
          circle={<LetterCircle id={project.arcId} name={project.topic} size={36} />}
          title={project.topic}
          subtitle="Project"
          onBack={onBack}
        />
      </div>

      <div ref={scrollRef} className="scrollbar-none flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col justify-end gap-2">
          {hasPractice ? (
            <div data-project-results className="mb-2 w-full max-w-[480px] self-start">
              <FeedbackWalkCard
                title={project.topic}
                progress={project.practiceProgress}
                chunks={practiceChunks}
                onFeedback={(chunk) => {
                  setOpenedTake(chunk.latestSessionId);
                  setOpened("walk");
                }}
                onIdealText={() => setOpened("ideal")}
              />
            </div>
          ) : null}

          {visibleMessages.map((message) => (
            message.client_id === question?.client_id ? (
              <div key={message.client_id} data-project-message={message.client_id} className="contents">
                <WillQuestionBubble
                  body={message.body}
                  chips={chips}
                  open
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
          {sending ? <TypingDots label="Will is replying" /> : null}
        </div>
      </div>

      {question ? (
        typingAnswer || chips.length === 0 ? (
          <div className="shrink-0 bg-background px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-2">
            <form
              data-project-question-composer
              onSubmit={(event) => { event.preventDefault(); void answerText(); }}
              className="relative mx-auto flex w-full max-w-4xl items-end"
            >
              <textarea
                autoFocus
                rows={1}
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
        ) : null
      ) : (
        <div className="shrink-0 bg-background px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
          <button type="button" data-project-record onClick={() => {
            if (hasPractice) setOpened("decision");
            else onRecord();
          }} className="mx-auto flex h-[58px] w-full max-w-4xl items-center justify-center gap-3 rounded-full bg-foreground text-[16px] font-semibold text-background">
            <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-[#ff4d3d]" />
            {hasPractice ? "Continue recording" : "Start recording"}
          </button>
        </div>
      )}

      {opened ? (
        <IdealTextOverlay
          arcId={project.arcId}
          coachTake={opened === "walk" ? openedTake : null}
          analysisPending={analysisPending}
          initialMode={opened === "walk" ? "review" : undefined}
          onClose={closeResult}
          onReadAloud={onRecord}
          practiceDecision={opened === "decision" ? {
            deliveryLabel: latestPractice?.deliveryLabel ?? undefined,
            continueLabel: finalFragment
              ? "Finish presentation"
              : "Continue to next fragment",
            onContinue: () => startPractice("next"),
            onRepeat: () => startPractice("repeat"),
          } : undefined}
        />
      ) : null}
    </div>
  );
}

// Founder-Approved: the readable result card comes first, then one natural project conversation using the locked chat bar and answer controls, 2026-11-16.
