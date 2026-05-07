"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ChatBubble from "@/components/funnel/ChatBubble";
import VoiceRecordButton from "@/components/funnel/VoiceRecordButton";
import {
  fetchNextQuestion,
  uploadInterviewAnswer,
  GuestUploadFailure,
} from "@/lib/api/public-client";

/**
 * TypingIndicator — three bouncing dots, messenger-style. Sits inside the
 * bot bubble while we simulate the bot composing a reply. Animation delays
 * are inline so we don't pollute tailwind.config with one-off keyframes.
 */
function TypingIndicator() {
  return (
    <div
      className="flex items-center gap-1 px-1 py-1"
      role="status"
      aria-label="Bot is typing"
    >
      <span
        className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground"
        style={{ animationDelay: "0ms", animationDuration: "900ms" }}
      />
      <span
        className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground"
        style={{ animationDelay: "150ms", animationDuration: "900ms" }}
      />
      <span
        className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground"
        style={{ animationDelay: "300ms", animationDuration: "900ms" }}
      />
    </div>
  );
}

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
      "Stress and charisma are biologically identical. They are both high-energy states.",
  },
  {
    id: "ob-2",
    content:
      "Since charisma is inherently social, we aren't going to practice hand gestures or eye contact with an empty screen here. Instead, we are going to do something much more powerful.",
  },
  {
    id: "ob-3",
    content:
      "We are going to map your personal Charismatic Flow State. I will help you recognize this energy and learn how to trigger it on demand.\n\nHit record to answer my first question when you are ready.",
  },
];

/**
 * Per-message "typing" durations for the cold-start onboarding chain.
 * The bot shows the TypingIndicator for `[i]` ms, *then* renders message i.
 * Tuned so each message gets a slightly longer think-time than the last,
 * matching how a real person would compose progressively richer answers.
 */
const ONBOARDING_TYPING_MS = [1500, 2000, 2500] as const;

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
  // Cold start (no initialQuestion) → live-text the onboarding sequence:
  //   typing 1.5s → M1, typing 2s → M2, typing 2.5s → M3, then fetch Q1.
  // The TypingIndicator bubble is gated on `loadingQuestion`; the mic on
  // `currentQuestion` (only set after Q1 lands), so the user can't record
  // until the whole sequence has played out.
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

    // Cold start — typing → message chain, then fetch Q1.

    const fetchFirstQuestion = async () => {
      // loadingQuestion is already true (carried over from the M3 typing
      // window), so the typing indicator stays on through the network call.
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

    /**
     * Schedule a single onboarding step: hold the typing indicator for the
     * configured duration, then drop the indicator + append the message.
     * The next step (or the Q1 fetch) is queued from the timer callback so
     * the user always sees typing → message → typing → message rhythm.
     */
    const scheduleStep = (idx: number) => {
      const typingMs = ONBOARDING_TYPING_MS[idx];
      const timer = setTimeout(() => {
        if (cancelled) return;
        const msg = ONBOARDING_MESSAGES[idx];
        setMessages((prev) => [
          ...prev,
          { id: msg.id, type: "bot", content: msg.content },
        ]);

        if (idx < ONBOARDING_MESSAGES.length - 1) {
          // More messages — drop typing for one frame so the bubble has a
          // beat to land before the indicator returns. Keeping it always on
          // would visually merge the message and the next typing bubble.
          setLoadingQuestion(false);
          const gap = setTimeout(() => {
            if (cancelled) return;
            setLoadingQuestion(true);
            scheduleStep(idx + 1);
          }, 250);
          onboardingTimersRef.current.push(gap);
        } else {
          // Last onboarding message in. Keep typing on while we fetch Q1.
          void fetchFirstQuestion();
        }
      }, typingMs);
      onboardingTimersRef.current.push(timer);
    };

    // Kick off the chain — typing indicator on, no messages yet.
    setMessages([]);
    setLoadingQuestion(true);
    scheduleStep(0);

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

        // Attach Whisper transcript from this upload to the last previous turn
        // so the EBCP LLM can branch on the user's actual response (e.g. YES/NO to math)
        if (result.transcript && previousTurns.length > 0) {
          previousTurns[previousTurns.length - 1] = {
            ...previousTurns[previousTurns.length - 1],
            transcript: result.transcript,
          };
        }

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
                <TypingIndicator />
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
