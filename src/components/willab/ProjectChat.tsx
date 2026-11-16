"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Send } from "lucide-react";
import type { TrainingArc } from "@/services/api/trainings";
import { postWillQuestion } from "@/services/api/willQuestion";
import { fetchArcSetup } from "@/services/api/arcSetup";
import { messagesForProject, openProjectQuestion } from "@/lib/willab/projectChat";
import { useLoungeThreadCtx } from "./LoungeThreadContext";
import FeedbackWalkCard from "./FeedbackWalkCard";
import IdealTextOverlay from "./IdealTextOverlay";
import TypingDots from "./TypingDots";
import { useBackDismiss } from "./useBackDismiss";
import { usePublishedCoach } from "@/lib/willab/chatBuilder/usePublishedCoach";
import { recordLabel } from "@/lib/willab/chatBuilder/screenCopy";
import { useUserId } from "./useUserId";
import {
  PRACTICE_CHUNK_SECONDS,
  readPracticeCheckpoint,
  writePracticeResume,
} from "@/lib/willab/practiceResume";

type Opened = "walk" | "ideal" | "decision" | null;

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
  const coach = usePublishedCoach();
  const userId = useUserId();
  const thread = useLoungeThreadCtx();
  const [opened, setOpened] = useState<Opened>(null);
  const [openedTake, setOpenedTake] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [slideCount, setSlideCount] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messages = useMemo(
    () => messagesForProject(thread.messages, project.arcId),
    [thread.messages, project.arcId],
  );
  const question = openProjectQuestion(messages);
  const questionMeta = question?.metadata ?? {};
  const chips = Array.isArray(questionMeta.chips)
    ? questionMeta.chips.filter((chip): chip is string => typeof chip === "string" && chip.length > 0)
    : [];
  const latestTake = [...project.takes].sort((a, b) => a.takeIndex - b.takeIndex).at(-1) ?? null;
  const hasPractice = project.takeCount > 0 || latestTake !== null;
  const checkpoint = readPracticeCheckpoint(userId, project.arcId);
  const finalFragment =
    slideCount !== null && checkpoint >= slideCount - 1;
  const practiceChunks = project.practiceChunks.length > 0
    ? project.practiceChunks
    : hasPractice
      ? [{
          startSlide: 1,
          endSlide: Math.max(1, checkpoint + 1),
          attempts: Math.max(1, project.takeCount),
          deliveryLabel: "Not yet there" as const,
          latestSessionId: latestTake?.sessionId ?? `${project.arcId}:latest`,
        }]
      : [];
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

  async function answerText(): Promise<void> {
    const answer = draft.trim();
    const take = questionMeta.take_session_id;
    if (!answer || sending || typeof take !== "string") return;
    setDraft("");
    setSending(true);
    try {
      if (await postWillQuestion(project.arcId, take, answer)) {
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
      <div className="box-content flex h-[60px] shrink-0 items-center gap-2 border-b border-border px-2 pt-[env(safe-area-inset-top)]">
        <button type="button" onClick={onBack} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-full">
          <ChevronLeft className="h-6 w-6" aria-hidden />
        </button>
        <span className="min-w-0">
          <b className="block truncate text-[16px] leading-tight">{project.topic}</b>
          <span className="text-[12.5px] text-muted-foreground">Project</span>
        </span>
      </div>

      <div ref={scrollRef} className="scrollbar-none flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-end gap-2">
          {messages
            .filter((message) => message.kind !== "walk_step" && message.kind !== "ideal_text" && message.kind !== "recording_summary")
            .map((message) => (
              <div
                key={message.client_id}
                className={`max-w-[86%] whitespace-pre-wrap rounded-[18px] px-4 py-2.5 text-[15px] leading-relaxed ${
                  message.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "mr-auto bg-muted text-foreground"
                }`}
              >
                {message.body}
              </div>
            ))}
          {sending ? <TypingDots label="Will is replying" /> : null}

          {hasPractice ? (
            <div data-project-results className="mt-3 w-full max-w-[384px] self-start">
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
        </div>
      </div>

      <div className="shrink-0 border-t border-border bg-background px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
        {question ? (
          <div data-project-question className="mx-auto flex w-full max-w-2xl flex-col gap-2">
            {chips.length ? (
              <div className="flex flex-wrap justify-end gap-2">
                {chips.map((chip) => (
                  <button key={chip} type="button" disabled={sending} onClick={() => void answerChip(chip)} className="rounded-full border border-primary px-4 py-2 text-[14px] text-primary disabled:opacity-50">
                    {chip}
                  </button>
                ))}
              </div>
            ) : null}
            <form onSubmit={(event) => { event.preventDefault(); void answerText(); }} className="flex items-center gap-2">
              <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Type your answer" aria-label="Answer about this take" className="h-11 min-w-0 flex-1 rounded-full border border-border px-4 text-[15px] outline-none focus:border-primary" />
              <button type="submit" disabled={!draft.trim() || sending} aria-label="Send answer" className="flex h-10 w-10 items-center justify-center rounded-full text-foreground disabled:text-muted-foreground">
                <Send className="h-5 w-5" aria-hidden />
              </button>
            </form>
          </div>
        ) : (
          <button type="button" data-project-record onClick={() => {
            if (hasPractice) setOpened("decision");
            else onRecord();
          }} className="mx-auto flex h-[58px] w-full max-w-2xl items-center justify-center gap-3 rounded-full bg-foreground text-[16px] font-semibold text-background">
            <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-[#ff4d3d]" />
            {recordLabel(coach, Boolean(hasPractice))}
          </button>
        )}
      </div>

      {opened ? (
        <IdealTextOverlay
          arcId={project.arcId}
          coachTake={opened === "walk" ? openedTake : null}
          analysisPending={analysisPending}
          initialMode={opened === "walk" ? "review" : undefined}
          onClose={closeResult}
          onReadAloud={onRecord}
          practiceDecision={opened === "decision" ? {
            deliveryLabel: latestPractice?.deliveryLabel,
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

// Founder-Approved: project conversation, two durable results, contextual questions and one recording CTA, 2026-11-15.
