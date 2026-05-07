"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import ChatBubble from "@/components/funnel/ChatBubble";
import VoiceRecordButton from "@/components/funnel/VoiceRecordButton";
import {
  fetchNextQuestion,
  uploadInterviewAnswer,
  GuestUploadFailure,
} from "@/lib/api/public-client";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

interface ChatMessage {
  id: string;
  type: "bot" | "user";
  /** Bot question text. */
  content?: string;
  /** Object URL for user's recorded audio. */
  audioUrl?: string;
  /** Duration label, e.g. "0:08". */
  duration?: string;
  /** Which tone this turn was: charisma or stress. */
  tone?: "charisma" | "stress";
}

interface ChatInterviewProps {
  /**
   * Called when the aggregate recording time hits the threshold (30s).
   * Passes the guest_session_id so the parent can route to CuriosityGate.
   */
  onThresholdReached: (guestSessionId: string) => void;
  /**
   * Called on rate-limit (429) or funnel-disabled (503) so the parent can
   * show the appropriate error state.
   */
  onError?: (code: string, message: string, status: number) => void;
  /**
   * If provided, skip the initial fetchNextQuestion(1) call and use this
   * pre-fetched question instead. Used by the contextual retention-loop chat
   * where the first question comes from a different endpoint.
   */
  initialQuestion?: { text: string; tone: "charisma" | "stress" };
  /**
   * Custom farewell message. Defaults to the standard wrap-up text.
   */
  farewellMessage?: string;
}

const AGGREGATE_THRESHOLD_SECONDS = 30;

/**
 * Cold-start onboarding sequence — three bite-sized bot messages that frame
 * the science of charisma before the first real interview question. Only
 * appended when no `initialQuestion` is provided (warm-start retention-loop
 * chats skip this entirely, per spec).
 *
 * Markdown emphasis from the original copy was dropped because ChatBubble
 * renders content as plain text; preserving `**` would surface the literal
 * asterisks. The phrase "Charismatic Flow State" reads as a defined concept
 * on its own.
 */
const ONBOARDING_MESSAGES: ReadonlyArray<{ id: string; content: string }> = [
  {
    id: "ob-1",
    content:
      "Stress and charisma are biologically identical. They are both high-energy states. That increased heart rate isn't panic—it's your body pumping oxygen to your brain to prepare you for action. That's why trying to just 'calm down' before speaking rarely works.",
  },
  {
    id: "ob-2",
    content:
      "Since charisma is inherently social, we aren't going to practice hand gestures or eye contact with an empty screen here. Instead, we are going to do something much more powerful.",
  },
  {
    id: "ob-3",
    content:
      "We are going to map your personal Charismatic Flow State. I will help you recognize this energy and learn how to trigger it on demand, so you can summon it whenever you step onto a stage or into a high-stakes meeting. Ready to begin?",
  },
];

/** Delay (ms) between consecutive onboarding bubbles. */
const ONBOARDING_STEP_MS = 1500;
/** Extra breathing room after the last onboarding bubble before Q1 lands. */
const ONBOARDING_TO_QUESTION_DELAY_MS = 800;

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function ChatInterview({
  onThresholdReached,
  onError,
  initialQuestion,
  farewellMessage,
}: ChatInterviewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<{
    text: string;
    tone: "charisma" | "stress";
  } | null>(null);
  const [turnNumber, setTurnNumber] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [totalDuration, setTotalDuration] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const guestSessionIdRef = useRef<string | null>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const thresholdReachedRef = useRef(false);
  const farewellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onboardingTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Clean up the farewell timeout if the component unmounts early
  useEffect(() => {
    return () => {
      if (farewellTimerRef.current) clearTimeout(farewellTimerRef.current);
    };
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loadingQuestion]);

  // Mount: warm start (initialQuestion provided) → load Q1 immediately.
  // Cold start (no initialQuestion) → run the 3-message onboarding sequence,
  // then fetch Q1. The mic button is gated on `currentQuestion` being set, so
  // it stays disabled throughout onboarding and lights up the moment Q1 lands.
  useEffect(() => {
    let cancelled = false;

    if (initialQuestion) {
      // Warm start: pre-fetched contextual question from the retention-loop
      setCurrentQuestion({ text: initialQuestion.text, tone: initialQuestion.tone });
      setMessages([
        {
          id: "q-1",
          type: "bot",
          content: initialQuestion.text,
          tone: initialQuestion.tone,
        },
      ]);
      return;
    }

    // Cold start — onboarding bubbles + first real question
    const fetchFirstQuestion = async () => {
      setLoadingQuestion(true);
      try {
        const q = await fetchNextQuestion(1);
        if (cancelled) return;
        setCurrentQuestion({ text: q.question, tone: q.tone });
        setMessages((prev) => [
          ...prev,
          { id: "q-1", type: "bot", content: q.question, tone: q.tone },
        ]);
      } catch (err) {
        if (!cancelled) {
          setErrorMessage(
            err instanceof Error ? err.message : "Failed to start interview"
          );
        }
      } finally {
        if (!cancelled) setLoadingQuestion(false);
      }
    };

    // M1 lands immediately on mount.
    setMessages([
      { id: ONBOARDING_MESSAGES[0].id, type: "bot", content: ONBOARDING_MESSAGES[0].content },
    ]);

    // M2 + M3 stagger in via setTimeout so the user reads them as a rhythm,
    // not a wall. Each timer is tracked so unmount can cancel cleanly.
    ONBOARDING_MESSAGES.slice(1).forEach((msg, idx) => {
      const timer = setTimeout(
        () => {
          if (cancelled) return;
          setMessages((prev) => [
            ...prev,
            { id: msg.id, type: "bot", content: msg.content },
          ]);
        },
        (idx + 1) * ONBOARDING_STEP_MS
      );
      onboardingTimersRef.current.push(timer);
    });

    // After the last onboarding bubble + a short breath, fetch Q1.
    const firstQuestionTimer = setTimeout(
      () => {
        if (cancelled) return;
        void fetchFirstQuestion();
      },
      (ONBOARDING_MESSAGES.length - 1) * ONBOARDING_STEP_MS +
        ONBOARDING_TO_QUESTION_DELAY_MS
    );
    onboardingTimersRef.current.push(firstQuestionTimer);

    return () => {
      cancelled = true;
      onboardingTimersRef.current.forEach(clearTimeout);
      onboardingTimersRef.current = [];
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Called when VoiceRecordButton fires onRecorded (preview ready).
   * We add the user's audio bubble to the thread immediately.
   */
  const handleRecorded = useCallback(
    (audioUrl: string, durationSeconds: number) => {
      const msgId = `u-${turnNumber}`;
      setMessages((prev) => [
        ...prev,
        {
          id: msgId,
          type: "user",
          audioUrl,
          duration: formatDuration(durationSeconds),
          tone: currentQuestion?.tone,
        },
      ]);
    },
    [turnNumber, currentQuestion]
  );

  // Client-side duration accumulator (fallback when backend total is unreliable)
  const clientDurationRef = useRef(0);

  /**
   * Build the conversation history from the messages array so the LLM
   * knows which questions it already asked and doesn't repeat them.
   */
  const buildPreviousTurns = useCallback(
    (): { question: string; transcript?: string }[] => {
      const turns: { question: string; transcript?: string }[] = [];
      for (const msg of messages) {
        if (msg.type === "bot" && msg.content && msg.id !== "farewell") {
          turns.push({ question: msg.content });
        }
        // We don't have transcripts on the client side, but the question
        // history alone is enough for the LLM to avoid repetition.
      }
      return turns;
    },
    [messages]
  );

  /**
   * Called when the user taps Send. Uploads the chunk, then either
   * fetches the next question or triggers the threshold callback.
   */
  const handleSend = useCallback(
    async (blob: Blob, durationSeconds: number) => {
      if (thresholdReachedRef.current) return;
      setUploading(true);
      setErrorMessage(null);

      // Accumulate client-side duration as a safety net
      clientDurationRef.current += durationSeconds;

      try {
        const result = await uploadInterviewAnswer(blob, {
          guestSessionId: guestSessionIdRef.current,
          turnNumber,
          questionTone: currentQuestion?.tone || "charisma",
          questionText: currentQuestion?.text || null,
          durationSeconds,
        });

        guestSessionIdRef.current = result.guest_session_id;
        // Use whichever total is higher: backend or client accumulation
        const backendTotal = result.total_session_duration_seconds;
        const effectiveTotal = Math.max(backendTotal, clientDurationRef.current);
        setTotalDuration(effectiveTotal);

        // Check threshold — graceful exit with farewell message
        if (effectiveTotal >= AGGREGATE_THRESHOLD_SECONDS) {
          thresholdReachedRef.current = true;
          setCurrentQuestion(null);

          // Push the farewell bot bubble into the chat thread
          setMessages((prev) => [
            ...prev,
            {
              id: "farewell",
              type: "bot",
              content:
                farewellMessage ||
                "For today we have got it, thanks! Now we will analyse it! 🚀",
            },
          ]);

          // Give the user ~3 seconds to read the goodbye, then transition
          const sid = result.guest_session_id;
          farewellTimerRef.current = setTimeout(() => {
            onThresholdReached(sid);
          }, 3000);
          return;
        }

        // Fetch next question — pass conversation history so LLM doesn't repeat
        const nextTurn = turnNumber + 1;
        setTurnNumber(nextTurn);
        setLoadingQuestion(true);

        const previousTurns = buildPreviousTurns();
        const q = await fetchNextQuestion(nextTurn, previousTurns);
        setCurrentQuestion({ text: q.question, tone: q.tone });
        setMessages((prev) => [
          ...prev,
          {
            id: `q-${nextTurn}`,
            type: "bot",
            content: q.question,
            tone: q.tone,
          },
        ]);
      } catch (err) {
        if (err instanceof GuestUploadFailure) {
          if (err.status === 429 || err.code === "RATE_LIMITED") {
            onError?.("RATE_LIMITED", err.message, 429);
            return;
          }
          if (err.status === 503 || err.code === "GUEST_FUNNEL_DISABLED") {
            onError?.("GUEST_FUNNEL_DISABLED", err.message, 503);
            return;
          }
          setErrorMessage(err.message);
        } else {
          setErrorMessage(
            err instanceof Error ? err.message : "Something went wrong."
          );
        }
      } finally {
        setUploading(false);
        setLoadingQuestion(false);
      }
    },
    [turnNumber, currentQuestion, onThresholdReached, onError, buildPreviousTurns, farewellMessage]
  );

  const handleRedo = useCallback(() => {
    // Remove the last user message (the one being redone)
    setMessages((prev) => {
      const lastUserIdx = prev.findLastIndex((m) => m.type === "user");
      if (lastUserIdx === -1) return prev;
      return prev.slice(0, lastUserIdx);
    });
  }, []);

  return (
    // Fills the parent's allotted height; the thread is the only element
    // that can scroll, so the mic + progress bar stay anchored.
    <div className="flex h-full flex-1 flex-col overflow-hidden">
      {/* Progress bar (aggregate time) — pinned above the thread */}
      {totalDuration > 0 && (
        <div className="shrink-0 bg-background/80 backdrop-blur-sm px-1 py-2">
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{
                  width: `${Math.min(
                    100,
                    (totalDuration / AGGREGATE_THRESHOLD_SECONDS) * 100
                  )}%`,
                }}
              />
            </div>
            <span className="text-[11px] tabular-nums text-muted-foreground whitespace-nowrap">
              {Math.round(totalDuration)}s / {AGGREGATE_THRESHOLD_SECONDS}s
            </span>
          </div>
        </div>
      )}

      {/* Chat thread — internal scroll only; messages anchor to the bottom */}
      <div className="flex flex-1 flex-col justify-end gap-3 overflow-y-auto py-6">
        {messages.map((msg) => (
          <ChatBubble
            key={msg.id}
            type={msg.type}
            content={msg.content}
            audioUrl={msg.audioUrl}
            duration={msg.duration}
          />
        ))}

        {/* Typing indicator while loading next question */}
        {loadingQuestion && (
          <div className="flex justify-start animate-fade-in-up">
            <div className="flex max-w-[85%] items-start gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
                <span className="text-xs font-bold text-primary-foreground">
                  W
                </span>
              </div>
              <div className="rounded-2xl rounded-tl-sm border border-border bg-chat-bot px-4 py-3 shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          </div>
        )}

        <div ref={threadEndRef} />
      </div>

      {/* Bottom: record control — pinned, never compressed */}
      <div className="flex shrink-0 flex-col items-center gap-3 pb-8">
        {!loadingQuestion && currentQuestion && !thresholdReachedRef.current && (
          <VoiceRecordButton
            onSend={handleSend}
            onRecorded={handleRecorded}
            onRedo={handleRedo}
            uploading={uploading}
          />
        )}

        {/* Helper text for first turn */}
        {turnNumber === 1 && messages.length <= 1 && !uploading && (
          <p className="text-center text-xs text-muted-foreground">
            Tap the mic to answer.
          </p>
        )}

        {errorMessage && (
          <p className="w-full max-w-sm rounded-md border border-red-200 bg-red-50 p-3 text-center text-sm text-red-800">
            {errorMessage}
          </p>
        )}
      </div>
    </div>
  );
}
