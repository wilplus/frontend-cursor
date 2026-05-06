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

  // Fetch the first question on mount (or use pre-fetched initialQuestion)
  useEffect(() => {
    let cancelled = false;

    if (initialQuestion) {
      // Use the pre-fetched contextual question (retention-loop chat)
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

    const loadFirst = async () => {
      setLoadingQuestion(true);
      try {
        const q = await fetchNextQuestion(1);
        if (cancelled) return;
        setCurrentQuestion({ text: q.question, tone: q.tone });
        setMessages([
          {
            id: "q-1",
            type: "bot",
            content: q.question,
            tone: q.tone,
          },
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
    loadFirst();
    return () => {
      cancelled = true;
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

  /**
   * Called when the user taps Send. Uploads the chunk, then either
   * fetches the next question or triggers the threshold callback.
   */
  const handleSend = useCallback(
    async (blob: Blob, durationSeconds: number) => {
      if (thresholdReachedRef.current) return;
      setUploading(true);
      setErrorMessage(null);

      try {
        const result = await uploadInterviewAnswer(blob, {
          guestSessionId: guestSessionIdRef.current,
          turnNumber,
          questionTone: currentQuestion?.tone || "charisma",
          questionText: currentQuestion?.text || null,
          durationSeconds,
        });

        guestSessionIdRef.current = result.guest_session_id;
        const newTotal = result.total_session_duration_seconds;
        setTotalDuration(newTotal);

        // Check threshold — graceful exit with farewell message
        if (newTotal >= AGGREGATE_THRESHOLD_SECONDS) {
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

        // Fetch next question
        const nextTurn = turnNumber + 1;
        setTurnNumber(nextTurn);
        setLoadingQuestion(true);

        const q = await fetchNextQuestion(nextTurn);
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
    [turnNumber, currentQuestion, onThresholdReached, onError]
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
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col">
      {/* Progress bar (aggregate time) */}
      {totalDuration > 0 && (
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm px-1 py-2">
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

      {/* Chat thread */}
      <div className="flex flex-1 flex-col justify-end gap-3 py-6">
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

      {/* Bottom: record control */}
      <div className="flex flex-col items-center gap-3 pb-8">
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
            Tap the mic to answer. Just speak naturally.
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
