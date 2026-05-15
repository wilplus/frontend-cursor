"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import ChatBubble from "@/components/funnel/ChatBubble";
import VoiceRecordButton from "@/components/funnel/VoiceRecordButton";
import RatingComposer from "@/components/funnel/RatingComposer";
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
  /**
   * Whisper transcript of a user audio answer — attached when the
   * upload-answer response lands. buildPreviousTurns pairs this with
   * the immediately-preceding bot question so the LLM gets the full
   * Q→A chain in `previous_turns`, not just the questions. Required
   * for the backend's "Anti-Parrot" directive (build upon a specific
   * element from the user's most recent answer); without it the
   * model only sees its own questions and ends up repeating itself.
   */
  transcript?: string | null;
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
  /**
   * Snippet that seeded this chat via /chat?sourceSnippet=<id>. Drives
   * two distinct features on the first turn:
   *
   *   1. Upload-answer forwards it to the backend so the contextual
   *      outcome-eval branch can score the user's answer against the
   *      source snippet's coach insight and persist onto the snippet's
   *      `follow_up_outcome` JSONB column (the first piece of the
   *      coaching-effectiveness learning loop).
   *
   *   2. After turn 1's upload, ChatInterview splices a 1..10
   *      self-rating prompt between the upload and the LLM's Q2 —
   *      see the rating-phase block in `handleSend` + submitSelfRating.
   *
   * Null/undefined → cold-start guest funnel, neither feature fires
   * (there's no snippet to score or rate yet).
   */
  sourceSnippetId?: string | null;
  /**
   * Authorization Bearer token for the contextual-chat case. Forwarded
   * to the upload-answer endpoint so the backend can derive a verified
   * user_id to owner-scope the source-snippet lookup during outcome
   * eval. Omit for the guest funnel — guest uploads work without it.
   */
  authToken?: string | null;
}

const AGGREGATE_THRESHOLD_SECONDS = 30;

/**
 * Hard cap on contextual chats (warm start, triggered via a snippet
 * CTA). Without this cap, contextual chats often never reach the 30s
 * aggregate-duration threshold — typical contextual answers are 5-10s
 * each, so a 1-3 turn chat ends without finalize ever firing, which
 * means the session never appears in the admin panel and the admin
 * email never goes out. Capping at 3 turns guarantees finalize runs
 * for every contextual chat, regardless of how short the user is.
 *
 * Cold-start sessions are NOT affected — they're driven by the
 * duration threshold (which they always hit) and by definition have
 * no source snippet, so this cap is gated on `sourceSnippetId`.
 */
const CONTEXTUAL_CHAT_MAX_TURNS = 3;

/**
 * Cold-start onboarding is now AI-driven end-to-end. The previous
 * hardcoded ONBOARDING_MESSAGES (M1-M4) + scheduleStep / playColdStartStep
 * machinery was deleted in favour of fetching turn 1 from the backend
 * the same way every other turn is fetched. The backend now generates
 * the entire conversation including the calibration prompts; A/B
 * testing showed it produces a meaningfully better UX than the static
 * script.
 *
 * What this means for the rest of the file:
 *   - No FIRST_QUESTION_TONE constant — `tone` always comes from the
 *     backend's next-question response.
 *   - No ONBOARDING_TYPING_MS — the chunked bot-message renderer
 *     handles typing rhythm uniformly via CHUNK_TYPING_MS.
 *   - No coldStartStepRef — there are no "steps" the frontend owns.
 *   - The mount useEffect's cold-start branch just calls
 *     fetchNextQuestion(1, []) and pipes the result through the
 *     same renderChunkedBotMessage path warm-start uses.
 */

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
 * Two-pass:
 *   1. Split on the explicit `|||` delimiter (backend's authoritative
 *      chunk-control). If absent, treat the whole message as one chunk.
 *   2. For EACH resulting chunk, apply the trailing-question heuristic:
 *      if the chunk ends in a `?` AND there's a setup sentence before it,
 *      peel that final question off into its own bubble. So a single
 *      `|||`-chunk that itself has "scenario… now answer this?" shape
 *      still gets split — the user sees three bubbles for one logical
 *      "reaction + scenario + question" reply.
 *
 * Heuristic is intentionally conservative — only splits when:
 *    - the chunk's last non-whitespace char is `?`,
 *    - there's at least one .!? sentence-terminator before the final
 *      question (so we know there's real setup, not a bare question),
 *    - the setup half is ≥ 20 chars (skips "Hi. What now?" pathological splits).
 */
function splitChunks(text: string): string[] {
  // Pass 1: respect explicit `|||` delimiter; otherwise treat as one chunk.
  const baseChunks = text.includes(CHUNK_DELIMITER)
    ? text
        .split(CHUNK_DELIMITER)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    : (() => {
        const t = text.trim();
        return t.length > 0 ? [t] : [];
      })();

  // Pass 2: trailing-question heuristic on each chunk.
  const result: string[] = [];
  for (const chunk of baseChunks) {
    const match = chunk.match(/^([\s\S]+[.!?])\s+([^.!?]*\?\s*)$/);
    if (match) {
      const setup = match[1].trim();
      const question = match[2].trim();
      if (setup.length >= 20 && question.length > 0) {
        result.push(setup, question);
        continue;
      }
    }
    result.push(chunk);
  }
  return result;
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
  sourceSnippetId = null,
  authToken = null,
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

  // Rating phase — sits between turn 1's upload and Q2 fetch when a
  // backend's upload-answer response sets requires_self_score=true.
  // See submitSelfRating + handleSend.
  //   none       — not asked (default), or rating already collected
  //   asking     — bot has prompted; <RatingComposer> 1-10 buttons
  //                replace the mic until the user taps one
  //   submitting — POST in flight (incl. 425 retries)
  //   done       — rating saved (or soft-failed) — continue to Q2
  const [ratingPhase, setRatingPhase] = useState<
    "none" | "asking" | "submitting" | "done"
  >("none");
  const [ratingError, setRatingError] = useState<string | null>(null);
  /** True while the backend has returned 425 ATTEMPT_NOT_READY at
   *  least once and we're sitting in the +2s/+5s retry ladder.
   *  Drives a subtle "evaluating…" hint on the composer so the user
   *  knows we heard them but the system is catching up. */
  const [ratingEvaluating, setRatingEvaluating] = useState(false);
  /** Whisper transcript from turn 1 — stashed during the rating phase
   *  so we can attach it to previousTurns when we eventually fetch Q2. */
  const ratingDeferredTranscriptRef = useRef<string | null>(null);

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

  // Mount: fetch turn 1 from backend either way. Warm start
  // (initialQuestion provided) skips the network and renders the
  // pre-fetched contextual question; cold start (no initialQuestion)
  // calls fetchNextQuestion(1, []) and pipes the response through the
  // same chunked renderer. There is no longer a hardcoded
  // ONBOARDING_MESSAGES path — backend owns turn 1 generation.
  useEffect(() => {
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

    // Cold start — fetch turn 1 from backend. Same surface as every
    // subsequent turn: backend dictates question text + tone, frontend
    // just renders.
    setMessages([]);
    setLoadingQuestion(true);
    void (async () => {
      try {
        const q = await fetchNextQuestion(1, []);
        if (unmountedRef.current) return;
        renderChunkedBotMessage(q.question, "q-1", q.tone, (joined) => {
          setCurrentQuestion({ text: joined, tone: q.tone });
        });
      } catch (err) {
        if (unmountedRef.current) return;
        if (err instanceof GuestUploadFailure) {
          if (err.status === 429 || err.code === "RATE_LIMITED") {
            onError?.("RATE_LIMITED", err.message, 429);
            return;
          }
          if (err.status === 503 || err.code === "GUEST_FUNNEL_DISABLED") {
            onError?.("GUEST_FUNNEL_DISABLED", err.message, 503);
            return;
          }
        }
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "Couldn't load the first question."
        );
        setLoadingQuestion(false);
      }
    })();

    return () => {
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
      // Use a timestamp-suffixed id so multiple recordings on the same
      // turn (e.g. the rating phase, where the user may re-record after
      // RATING_UNPARSEABLE) don't collide with each other or with the
      // primary turn answer above them in the thread.
      const msgId = `u-${turnNumber}-${Date.now()}`;
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
      // Pair each canonical bot question with the transcript of the
      // user's NEXT answer. The transcript may be missing for the
      // most-recent turn — callers (proceedToNextQuestion) override
      // it with the just-uploaded transcript since setMessages is
      // async and the new transcript isn't in `messages` yet at the
      // moment buildPreviousTurns runs.
      let pendingQuestion: string | null = null;
      for (const msg of messages) {
        if (msg.id === "farewell") continue;
        if (msg.isChunkContinuation) continue;

        if (msg.type === "bot") {
          // Two bot messages in a row (e.g. an onboarding chain that
          // wasn't broken up by a user answer): flush the previous
          // question with no transcript so the LLM sees what's been
          // asked, then take the new one as pending.
          if (pendingQuestion != null) {
            turns.push({ question: pendingQuestion });
          }
          pendingQuestion = msg.fullText ?? msg.content ?? null;
          continue;
        }

        if (msg.type === "user" && pendingQuestion != null) {
          const t = msg.transcript?.trim();
          turns.push({
            question: pendingQuestion,
            transcript: t ? t : undefined,
          });
          pendingQuestion = null;
        }
      }
      // Trailing bot question with no user answer yet (e.g. the
      // current turn is still being recorded). Include it so the LLM
      // knows what it just asked.
      if (pendingQuestion != null) {
        turns.push({ question: pendingQuestion });
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
   * Fetch the LLM's next question and stagger-render it through the
   * chunked bot-message pipeline. Extracted from handleSend so the
   * contextual rating phase can call it AFTER the user submits their
   * 1..10 self-rating (instead of immediately on upload success).
   *
   * `lastAnswerTranscript` is the Whisper transcript of the user's
   * MOST-RECENT answer — attached to the last entry of previousTurns
   * so the EBCP LLM can branch on the actual response.
   */
  const proceedToNextQuestion = useCallback(
    async (lastAnswerTranscript: string | null) => {
      if (thresholdReachedRef.current) return;
      setLoadingQuestion(true);
      const nextTurn = turnNumber + 1;
      setTurnNumber(nextTurn);

      const previousTurns = buildPreviousTurns();
      if (lastAnswerTranscript && previousTurns.length > 0) {
        previousTurns[previousTurns.length - 1] = {
          ...previousTurns[previousTurns.length - 1],
          transcript: lastAnswerTranscript,
        };
      }

      try {
        const q = await fetchNextQuestion(nextTurn, previousTurns);
        renderChunkedBotMessage(
          q.question,
          `q-${nextTurn}`,
          q.tone,
          (joined) => {
            setCurrentQuestion({ text: joined, tone: q.tone });
          }
        );
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : "Couldn't load the next question."
        );
        setLoadingQuestion(false);
      }
    },
    [turnNumber, buildPreviousTurns, renderChunkedBotMessage]
  );

  /**
   * Submit the user's 1..10 self-rating ("vibe check") for the
   * snippet that booted this contextual chat. Input is the Whisper
   * transcript of the user's voice-recorded rating (e.g. "8", "I'd
   * say eight", "around a 7"). Always sent as `rating_text` per
   * spec — the backend is the canonical parser.
   *
   * No bubble append here — voice mode renders the user's audio
   * bubble via handleRecorded the moment the mic stops, before this
   * function runs. We just round-trip the API and either continue
   * to Q2 or re-prompt for another recording.
   *
   * Handles two distinct error classes:
   *
   *   • 425 ATTEMPT_NOT_READY — eval daemon hasn't written the
   *     attempt row yet. Retry at +2s, then +5s, then soft-fail.
   *     Subtle "evaluating…" hint shows while in the ladder so the
   *     user doesn't think the request died.
   *
   *   • 400 RATING_UNPARSEABLE — backend's regex couldn't pull a
   *     1..10 from the transcript. Keep the audio bubble in place
   *     (the user DID speak) and re-arm the mic with inline copy.
   *
   * Any other failure soft-fails: append a brief "Got it — let's
   * keep going" bubble and proceed to Q2. Rating is a nice-to-have,
   * not a hard gate on the chat.
   */
  const submitSelfRating = useCallback(
    async (input: string) => {
      if (!sourceSnippetId) return;
      const trimmed = input.trim();
      if (!trimmed) {
        setRatingError("I couldn't hear that. Try again?");
        setRatingPhase("asking");
        return;
      }

      setRatingPhase("submitting");
      setRatingError(null);
      setRatingEvaluating(false);

      const body = { snippet_id: sourceSnippetId, rating_text: trimmed };

      // Retry ladder for 425 (ATTEMPT_NOT_READY): immediate, +2s, +5s.
      // Any other error short-circuits — they're not transient.
      const delays = [0, 2000, 5000];
      let lastCode: string | null = null;
      let lastError: string | null = null;

      for (let i = 0; i < delays.length; i++) {
        if (i > 0) {
          // Second+ pass: we know the backend said 425 last time, so
          // surface the evaluating hint while we wait out this delay.
          setRatingEvaluating(true);
          await new Promise((r) => setTimeout(r, delays[i]));
          if (unmountedRef.current) return;
        }

        let res: Response;
        try {
          res = await fetch("/api/user/coaching/self-rating", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
        } catch (err) {
          console.warn("self-rating fetch threw:", err);
          break;
        }

        if (res.status === 425) {
          lastCode = "ATTEMPT_NOT_READY";
          continue;
        }

        const data = (await res.json().catch(() => ({}))) as {
          code?: string;
          error?: string;
        };

        if (res.ok) {
          setRatingEvaluating(false);
          setMessages((prev) => [
            ...prev,
            {
              id: "rating-ack",
              type: "bot",
              content: "Got it — thanks 🙏",
            },
          ]);
          setRatingPhase("done");
          await new Promise((r) => setTimeout(r, 500));
          if (unmountedRef.current) return;
          await proceedToNextQuestion(
            ratingDeferredTranscriptRef.current ?? null
          );
          return;
        }

        if (data.code === "RATING_UNPARSEABLE") {
          // Whisper transcribed something but no 1..10 was in it.
          // Keep the audio bubble (the user DID speak) and re-arm the
          // mic with inline copy so they can try a clearer take.
          setRatingEvaluating(false);
          setRatingError(
            "I didn't catch a number — try again with just 1–10."
          );
          setRatingPhase("asking");
          return;
        }

        lastCode = data.code ?? `HTTP_${res.status}`;
        lastError = data.error ?? `Request failed (${res.status}).`;
        break;
      }

      // All retries exhausted or non-retryable error — soft-fail and
      // move on. Don't block the chat over a rating bookkeeping miss.
      console.warn("Self-rating failed:", lastCode, lastError);
      setRatingEvaluating(false);
      setMessages((prev) => [
        ...prev,
        {
          id: "rating-soft-fail",
          type: "bot",
          content: "Got it — let's keep going.",
        },
      ]);
      setRatingPhase("done");
      await new Promise((r) => setTimeout(r, 400));
      if (unmountedRef.current) return;
      await proceedToNextQuestion(
        ratingDeferredTranscriptRef.current ?? null
      );
    },
    [sourceSnippetId, proceedToNextQuestion]
  );

  // (handleRatingSend deleted — voice-only rating intake removed.
  //  Rating phase now uses <RatingComposer> 1-10 button row that
  //  feeds digit strings straight into submitSelfRating without
  //  Whisper. Voice extraction was too brittle for plain digits;
  //  the manual tap is faster AND more reliable.)

  /**
   * End-of-session helper — single source of truth for the goodbye
   * sequence. Called from THREE triggers:
   *
   *   1. Cold-start aggregate duration threshold hit (30s of audio).
   *   2. Contextual-chat turn cap hit (3 turns) — fixes the bug
   *      where short contextual chats never finalized because they
   *      never reached the duration threshold.
   *   3. User clicks the "Finish & see results" button (contextual
   *      chats only, see <button> below the chat thread).
   *
   * Does the same four things in all three cases, so the admin panel
   * + email pipeline fires identically regardless of how the chat
   * ended:
   *   - Sets thresholdReachedRef so further uploads are blocked.
   *   - Pushes the farewell bot bubble.
   *   - Fires POST /api/session/finalize fire-and-forget (per SSoT
   *     §3, frontend is the source of truth for "session ended").
   *     `reason` lets backend telemetry differentiate the trigger.
   *   - Schedules onThresholdReached(sid) after a 3s read-the-goodbye
   *     pause; the parent then transitions to /results/[sessionId].
   */
  const endSession = useCallback(
    (
      sid: string,
      totalDurationSeconds: number,
      reason: "threshold" | "max_turns" | "user_done"
    ) => {
      if (thresholdReachedRef.current) return;
      thresholdReachedRef.current = true;
      setCurrentQuestion(null);
      setLoadingQuestion(false);
      setUploading(false);

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

      void fetch("/api/session/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guest_session_id: sid,
          total_duration_seconds: totalDurationSeconds,
          reason,
        }),
      }).catch((err) => {
        // Non-fatal — the user still gets to /results, backend can
        // reconcile from the existing turn rows if the call dropped.
        console.warn(
          `/api/session/finalize ${reason} call failed:`,
          err
        );
      });

      farewellTimerRef.current = setTimeout(() => {
        onThresholdReached(sid);
      }, 3000);
    },
    [farewellMessage, onThresholdReached]
  );

  /**
   * User-initiated session end — fired by the "Finish & see results"
   * button at the bottom of the chat thread. Only available in
   * contextual chats (sourceSnippetId is set) AND only after at
   * least one upload has captured a session_id; otherwise we'd be
   * finalizing nothing.
   */
  const handleFinishContextual = useCallback(() => {
    const sid = guestSessionIdRef.current;
    if (!sid) return;
    if (uploading) return;
    endSession(sid, totalDuration, "user_done");
  }, [endSession, totalDuration, uploading]);

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
          // Contextual-chat only — these are ignored on guest funnel
          // uploads. The backend uses them to score this turn's answer
          // against the source snippet's admin coach insight and
          // persist a follow_up_outcome (coaching-effectiveness loop).
          sourceSnippetId: turnNumber === 1 ? sourceSnippetId : null,
          authToken,
        });

        guestSessionIdRef.current = result.guest_session_id;
        // Use whichever total is higher: backend or client accumulation
        const backendTotal = result.total_session_duration_seconds;
        const effectiveTotal = Math.max(backendTotal, clientDurationRef.current);
        setTotalDuration(effectiveTotal);

        // Persist Whisper's transcript onto the most-recent user
        // message so buildPreviousTurns on the NEXT call sees the
        // full Q→A chain (not just the current turn's). The
        // immediately-following proceedToNextQuestion call still
        // also passes `result.transcript` explicitly to handle the
        // setState-is-async timing race within this same tick.
        if (result.transcript) {
          const finalTranscript = result.transcript;
          setMessages((prev) => {
            for (let i = prev.length - 1; i >= 0; i--) {
              if (prev[i].type === "user" && prev[i].transcript == null) {
                const next = [...prev];
                next[i] = { ...next[i], transcript: finalTranscript };
                return next;
              }
            }
            return prev;
          });
        }

        // Check end-of-session triggers. Two conditions fire here:
        //   1. Cold-start aggregate duration threshold (30s) — applies
        //      to every chat, but contextual chats rarely hit it
        //      because their answers are short.
        //   2. Contextual-chat turn cap (3 turns) — applies only when
        //      sourceSnippetId is set, guarantees finalize runs even
        //      when the user only does 1-2 short answers. This is the
        //      fix for "contextual sessions don't appear in admin"
        //      reported when the duration threshold was the only path
        //      to finalize.
        const reachedDurationThreshold =
          effectiveTotal >= AGGREGATE_THRESHOLD_SECONDS;
        const reachedContextualTurnCap =
          !!sourceSnippetId && turnNumber >= CONTEXTUAL_CHAT_MAX_TURNS;

        if (reachedDurationThreshold || reachedContextualTurnCap) {
          endSession(
            result.guest_session_id,
            effectiveTotal,
            reachedDurationThreshold ? "threshold" : "max_turns"
          );
          return;
        }

        // (Math-probe reaction + cold-start advance branches deleted —
        // no more hardcoded onboarding turns. Backend owns the entire
        // conversation including any "soft empathy on a no" beat the
        // model wants to deliver, since the math question is no longer
        // a fixed turn the frontend can pre-emptively branch on.)

        // Contextual chat self-rating splice — gated on the backend's
        // requires_self_score flag. Backend decides when to ask
        // (Phase 19 frequency rules: max once per snippet, or only at
        // session-end, or wherever the product says). Frontend
        // silently skips when the flag is undefined or false.
        // Still requires sourceSnippetId — submitSelfRating posts
        // the rating against a snippet_id, so cold-start sessions
        // (no source snippet) can't be rated.
        if (
          sourceSnippetId &&
          result.requires_self_score === true &&
          ratingPhase === "none" &&
          !thresholdReachedRef.current
        ) {
          // Hide the typing indicator — there's no LLM reply landing,
          // the bot just asks ONE static question for the rating.
          setLoadingQuestion(false);
          ratingDeferredTranscriptRef.current = result.transcript ?? null;
          setMessages((prev) => [
            ...prev,
            {
              id: "rating-prompt",
              type: "bot",
              content: "On a scale of 1 to 10, how did that feel to you?",
            },
          ]);
          setRatingPhase("asking");
          return;
        }

        await proceedToNextQuestion(result.transcript ?? null);
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
    [
      turnNumber,
      currentQuestion,
      onError,
      buildPreviousTurns,
      sourceSnippetId,
      authToken,
      proceedToNextQuestion,
      ratingPhase,
      endSession,
    ]
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
          attached to the mic instead of floating beneath it.
          During the rating phase the mic is REPLACED by the
          <RatingComposer> 1-10 button row — voice extraction
          was too brittle for plain digits ("8" failed where
          "8/10" worked), so the manual tap is now the primary
          input. */}
      <div className="flex shrink-0 flex-col items-center gap-1 pb-4">
        {ratingPhase === "asking" || ratingPhase === "submitting" ? (
          <RatingComposer
            onSubmit={(input) => void submitSelfRating(input)}
            submitting={ratingPhase === "submitting"}
            evaluating={ratingEvaluating}
            error={ratingError}
          />
        ) : (
          !loadingQuestion &&
          currentQuestion &&
          !thresholdReachedRef.current && (
            <VoiceRecordButton
              onSend={handleSend}
              onRecorded={handleRecorded}
              disabled={uploading}
            />
          )
        )}

        {/* Helper text for first turn */}
        {turnNumber === 1 && messages.length <= 1 && !uploading && (
          <p className="text-center text-xs text-muted-foreground">
            Tap the mic to answer.
          </p>
        )}

        {/* "Finish & see results" — contextual chats only.
            Renders once at least one upload has captured a session_id
            so the user can wrap up after a single short answer instead
            of being forced to keep talking until the duration threshold
            (which short contextual chats almost never reach). Hidden
            during upload, the rating phase, and after threshold so it
            never competes with the active flow. */}
        {sourceSnippetId &&
          guestSessionIdRef.current &&
          !thresholdReachedRef.current &&
          !uploading &&
          !loadingQuestion &&
          ratingPhase === "none" && (
            <button
              type="button"
              onClick={handleFinishContextual}
              className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
            >
              Finish &amp; see results
            </button>
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
