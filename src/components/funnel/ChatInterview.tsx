"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
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
  /**
   * For multi-chunk bot messages (delimited by `|||` from the LLM):
   * — set on the FIRST chunk only — holds the full pre-split text so
   * buildPreviousTurns can reconstruct the LLM's original message as a
   * single "question" when computing context for the next call.
   */
  fullText?: string;
  /**
   * True on chunks 1..N (continuations). Skipped in buildPreviousTurns
   * so the LLM doesn't see N entries for one logical message.
   */
  isChunkContinuation?: boolean;
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
  /**
   * True when the recorder is in the cold-start guest funnel (no Supabase
   * session yet). Surfaces the GDPR micro-disclaimer below the mic for
   * the very first recording — required because we capture audio before
   * the user has formally signed up. Logged-in users hide it.
   */
  isGuest?: boolean;
}

const AGGREGATE_THRESHOLD_SECONDS = 30;

/**
 * Cold-start onboarding sequence — four bite-sized bot bubbles. The first
 * three frame the science of charisma; the fourth IS the first interview
 * question (the EBCP frustration / math probe). The frontend hardcodes
 * Q1 here instead of asking the backend so the conversational rhythm
 * stays consistent — backend takes over from Q2 onwards using the
 * conversation history sent on the first upload.
 *
 * Only appended when no `initialQuestion` is provided (warm-start
 * retention-loop chats skip this entirely).
 *
 * `**...**` runs in `content` are rendered as <strong> by ChatBubble —
 * keep markup minimal (single phrase per bubble at most).
 */
const ONBOARDING_MESSAGES: ReadonlyArray<{ id: string; content: string }> = [
  {
    id: "ob-1",
    content:
      "Your stress and your charisma are made of the same stuff. We're here to show you the switch.",
  },
  {
    id: "ob-2",
    content:
      "Charisma is social and you can't drill it. So we'll do something different!",
  },
  {
    id: "ob-3",
    content: "We will map your personal **Charismatic Flow State**.",
  },
  {
    id: "ob-4",
    content:
      "Pardon me for this little awkward question but do you generally like math?",
  },
];

/** Tone tagged on the user's first answer + sent as questionTone on the
 *  upload. The math probe is a stress-response prime per EBCP. */
const FIRST_QUESTION_TONE: "charisma" | "stress" = "stress";

/**
 * Per-message "typing" durations for the cold-start onboarding chain.
 * The bot shows the TypingIndicator for `[i]` ms, *then* renders message i.
 * Tuned so each message gets a slightly longer think-time than the last,
 * matching how a real person would compose progressively richer answers.
 * Last entry is the math-probe question — a touch longer to feel like
 * the bot is "deciding" how to phrase it.
 */
const ONBOARDING_TYPING_MS = [1500, 1800, 2000, 2500] as const;

/** Delimiter the LLM uses to split a single response into multiple bubbles. */
const CHUNK_DELIMITER = "|||";
/** Typing indicator duration between chunks of a single LLM response. */
const CHUNK_TYPING_MS = 1700;
/** Brief beat between a chunk landing and the next typing indicator
 *  appearing — without this they visually merge. */
const CHUNK_BEAT_MS = 250;

/**
 * Split an LLM message into chunks the UI should render as separate bubbles.
 *
 * 1. Explicit `|||` delimiter takes precedence — backend can chunk however
 *    it wants and we'll respect that exactly.
 * 2. Heuristic fallback when the LLM didn't chunk: if the message ends in
 *    a question AND there's a setup sentence before it, peel that final
 *    question off into its own bubble so long "scenario… now answer this?"
 *    replies feel like a real two-message exchange instead of a wall.
 *
 * The heuristic is intentionally conservative — it only splits when:
 *    - the message contains a `?` AND it's the FINAL non-whitespace char,
 *    - there's at least one sentence-terminator (.!?) before the final
 *      question (so we know there's real setup, not just a bare question),
 *    - the setup half is at least 20 chars long (avoids "Hi. What now?" splits).
 *
 * Anything outside that pattern returns as a single chunk.
 */
function splitChunks(text: string): string[] {
  if (text.includes(CHUNK_DELIMITER)) {
    return text
      .split(CHUNK_DELIMITER)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  const trimmed = text.trim();
  if (!trimmed) return [];

  // Greedy match: group 1 = setup ending in .!? ; group 2 = trailing
  // question (must contain `?` and end the string, no internal .!?).
  const match = trimmed.match(/^([\s\S]+[.!?])\s+([^.!?]*\?\s*)$/);
  if (match) {
    const setup = match[1].trim();
    const question = match[2].trim();
    if (setup.length >= 20 && question.length > 0) {
      return [setup, question];
    }
  }

  return [trimmed];
}

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
  isGuest = false,
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
  /** Onboarding + chunked-bot-message timers. Cleared on unmount and
   *  before each new chunked rendering so stale chunks from a previous
   *  turn never bleed into the next one. */
  const onboardingTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  /** Set true on unmount so async chunk callbacks can short-circuit
   *  cleanly without trying to update state on a torn-down component. */
  const unmountedRef = useRef(false);

  // Clean up the farewell timeout + flag unmount for chunk callbacks
  useEffect(() => {
    return () => {
      unmountedRef.current = true;
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
      // Warm start: pre-fetched contextual question from the retention-loop.
      // Routed through the chunked renderer so any `|||` from the LLM is
      // staggered the same way as runtime questions.
      renderChunkedBotMessage(
        initialQuestion.text,
        "q-1",
        initialQuestion.tone,
        (joined) => {
          setCurrentQuestion({ text: joined, tone: initialQuestion.tone });
        }
      );
      return;
    }

    // Cold start — typing → message chain through M1..M4, then promote
    // M4 to "the current question" so the mic appears. Backend Q1 is
    // intentionally NOT fetched: M4 is the EBCP frustration probe and
    // serves as turn 1's question. The backend takes over on turn 2
    // (handleSend → fetchNextQuestion(2, previousTurns)) using the math
    // answer's transcript to branch.

    /**
     * Schedule a single onboarding step: hold the typing indicator for the
     * configured duration, then drop the indicator + append the message.
     * The next step is queued from the timer callback so the user always
     * sees typing → message → typing → message rhythm. After the LAST
     * message we promote it to the current question and re-enable the mic.
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
          // Last onboarding bubble = Q1 (the math probe). Drop typing,
          // set currentQuestion so the mic appears in the same frame.
          setLoadingQuestion(false);
          setCurrentQuestion({
            text: msg.content,
            tone: FIRST_QUESTION_TONE,
          });
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
   *
   * Multi-chunk LLM messages collapse back to a single entry: the first
   * chunk carries `fullText` (the un-split original) and continuations
   * are flagged so they're skipped. Onboarding bubbles + farewell are
   * filtered out — the LLM doesn't need them as "previous questions".
   */
  const buildPreviousTurns = useCallback(
    (): { question: string; transcript?: string }[] => {
      const turns: { question: string; transcript?: string }[] = [];
      for (const msg of messages) {
        if (msg.type !== "bot") continue;
        if (msg.id === "farewell") continue;
        if (msg.isChunkContinuation) continue;
        const text = msg.fullText ?? msg.content;
        if (text) turns.push({ question: text });
      }
      return turns;
    },
    [messages]
  );

  /**
   * Render a bot message that may contain `|||` delimiters as a sequence
   * of separate bubbles, with a TypingIndicator between each. Hides the
   * mic for the duration (sets currentQuestion to null) and re-enables
   * it via `onFinalChunkLanded` once the last chunk lands.
   *
   * Single-chunk messages (no delimiters) still go through this helper —
   * the first chunk lands immediately and onFinalChunkLanded fires
   * synchronously, so behaviour is identical to a plain append.
   */
  const renderChunkedBotMessage = useCallback(
    (
      fullText: string,
      baseId: string,
      tone: "charisma" | "stress" | undefined,
      onFinalChunkLanded: (joinedText: string) => void
    ) => {
      if (unmountedRef.current) return;
      const chunks = splitChunks(fullText);
      // Wipe pending chunks from any previous turn before we schedule new
      // ones — prevents a stale chunk from a slow LLM reply landing inside
      // the next turn's thread.
      onboardingTimersRef.current.forEach(clearTimeout);
      onboardingTimersRef.current = [];

      if (chunks.length === 0) {
        // Defensive — empty / whitespace-only response
        setLoadingQuestion(false);
        onFinalChunkLanded("");
        return;
      }

      const joined = chunks.join(" ");

      // Mic is gated on `currentQuestion`. Null it during chunked rendering
      // so the user can't record while we're still revealing chunks.
      setCurrentQuestion(null);

      // First chunk lands immediately (typing was already on during the
      // network call that produced this message).
      setLoadingQuestion(false);
      setMessages((prev) => [
        ...prev,
        {
          id: `${baseId}-0`,
          type: "bot",
          content: chunks[0],
          tone,
          fullText: chunks.length > 1 ? joined : undefined,
        },
      ]);

      if (chunks.length === 1) {
        onFinalChunkLanded(joined);
        return;
      }

      const showChunk = (idx: number) => {
        if (unmountedRef.current) return;
        const beat = setTimeout(() => {
          if (unmountedRef.current) return;
          setLoadingQuestion(true);
          const reveal = setTimeout(() => {
            if (unmountedRef.current) return;
            setLoadingQuestion(false);
            setMessages((prev) => [
              ...prev,
              {
                id: `${baseId}-${idx}`,
                type: "bot",
                content: chunks[idx],
                tone,
                isChunkContinuation: true,
              },
            ]);
            if (idx < chunks.length - 1) {
              showChunk(idx + 1);
            } else {
              onFinalChunkLanded(joined);
            }
          }, CHUNK_TYPING_MS);
          onboardingTimersRef.current.push(reveal);
        }, CHUNK_BEAT_MS);
        onboardingTimersRef.current.push(beat);
      };

      showChunk(1);
    },
    []
  );

  /**
   * Auto-submit. Fires the moment the user stops recording — uploads the
   * chunk in the background while the UI already shows the "thinking" dots
   * to mask network latency. The user audio bubble is rendered separately
   * by handleRecorded (also fired from VoiceRecordButton's onstop).
   */
  const handleSend = useCallback(
    async (blob: Blob, durationSeconds: number) => {
      if (thresholdReachedRef.current) return;
      setUploading(true);
      setErrorMessage(null);
      // Show the typing indicator IMMEDIATELY so the user sees the bot
      // "composing" while the audio is still uploading. The mic button
      // is gated on !loadingQuestion, so it disappears in the same frame.
      setLoadingQuestion(true);

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
          // Stop the typing illusion — no more questions are coming.
          setLoadingQuestion(false);

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

        // Fetch next question — pass conversation history so LLM doesn't repeat.
        // loadingQuestion is already true (set at the top of handleSend), so
        // the typing dots have been visible since the user clicked Stop.
        const nextTurn = turnNumber + 1;
        setTurnNumber(nextTurn);

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
        // Chunked renderer handles `|||` splitting + staggered delivery and
        // sets currentQuestion via the callback once the FINAL chunk lands,
        // so the mic stays gated through the whole reveal.
        renderChunkedBotMessage(
          q.question,
          `q-${nextTurn}`,
          q.tone,
          (joined) => {
            setCurrentQuestion({ text: joined, tone: q.tone });
          }
        );
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

  // (handleRedo removed — Redo flow is gone. Stop = auto-submit, no preview.)

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

      {/* Bottom: record control — pinned, never compressed.
          Tight gap-1 so the helper text + GDPR disclaimer feel
          attached to the mic instead of floating beneath it. */}
      <div className="flex shrink-0 flex-col items-center gap-1 pb-4">
        {!loadingQuestion && currentQuestion && !thresholdReachedRef.current && (
          <VoiceRecordButton
            onSend={handleSend}
            onRecorded={handleRecorded}
            disabled={uploading}
          />
        )}

        {/* Helper text for first turn */}
        {turnNumber === 1 && messages.length <= 1 && !uploading && (
          <p className="text-center text-xs text-muted-foreground">
            Tap the mic to answer.
          </p>
        )}

        {/* GDPR micro-disclaimer — guests only, first turn only.
            Vanishes the moment the user records (turnNumber flips to 2). */}
        {isGuest &&
          turnNumber === 1 &&
          currentQuestion &&
          !loadingQuestion &&
          !uploading &&
          !thresholdReachedRef.current && (
            <p className="text-center text-[10px] leading-tight text-muted-foreground">
              By recording, you agree to our{" "}
              <Link
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Privacy Policy
              </Link>
              .
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
