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
 * Cold-start onboarding sequence — IMMUTABLE per
 * docs/ARCHITECTURE_SINGLE_SOURCE_OF_TRUTH.md §1. Frontend owns
 * Turns 1-4 entirely; do NOT change these strings without
 * coordinating an architecture update. Backend's _EBCP_FALLBACKS
 * table is being deleted as part of the same alignment.
 *
 *   M1 = framing only (auto-advances; no user recording)
 *   M2 = Turn 1 question (user records)
 *   M3 = Turn 2 question (user records)
 *   M4 = Turn 3 question (user records — math probe, EBCP stress prime)
 *   Backend takes over after M4's answer.
 *
 * Only appended when no `initialQuestion` is provided (warm-start
 * retention-loop chats skip this entirely).
 */
const ONBOARDING_MESSAGES: ReadonlyArray<{ id: string; content: string }> = [
  {
    id: "ob-1",
    content:
      "Quick baseline first. I'm going to ask you some off-the-wall questions. Just go with it — there's a method.",
  },
  {
    id: "ob-2",
    content:
      "All right. I want you to imagine you have a younger sibling who's struggling with a math problem. They're stuck, they're frustrated. What do you say to them?",
  },
  {
    id: "ob-3",
    content:
      "Got it. One more. Picture this: you're in a meeting and someone presents an idea you strongly disagree with. Do you speak up immediately, or wait and think it through?",
  },
  {
    id: "ob-4",
    content:
      "Last weird one, I promise. Do you generally like math? Quick yes or no — trust me, this matters.",
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
  // sourceSnippetId is present. See submitSelfRating + handleSend.
  //   none       — not a contextual chat or rating already collected
  //   asking     — bot has prompted; mic stays visible, onSend is
  //                handleRatingSend (Whisper → submitSelfRating)
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
  /**
   * Cold-start step pointer.
   *   null = warm start (contextual chat) — no onboarding chain runs.
   *   0    = M1 (framing) just landed; about to auto-advance to M2.
   *   1    = M2 question is currently being recorded.
   *   2    = M3 question is currently being recorded.
   *   3    = M4 question (math probe) is currently being recorded.
   *
   * After M4's answer, the backend takes over at "Turn 5" per
   * docs/ARCHITECTURE_SINGLE_SOURCE_OF_TRUTH.md §1. handleSend
   * branches on this ref to decide whether to advance to the next
   * onboarding M or hand off to fetchNextQuestion.
   */
  const coldStartStepRef = useRef<number | null>(null);

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

  /**
   * Land one onboarding message and decide what happens next.
   *
   *   M1 (idx 0): framing — auto-advances to M2 after a 250ms beat
   *               with no recording prompt in between.
   *   M2/M3/M4 (idx 1/2/3): each becomes the active question — mic
   *               appears, user records, handleSend's cold-start
   *               branch fires playColdStartStep(idx + 1) after the
   *               upload (or hands off to backend after M4).
   *
   * Defined as a regular function (not useCallback) so its self-
   * recursive call resolves to the same first-render binding the
   * mount useEffect captured. The body only touches stable refs +
   * setState dispatchers — no closure-captured state — so the
   * "first render" capture isn't a staleness risk.
   */
  const playColdStartStep = (idx: number) => {
    if (idx >= ONBOARDING_MESSAGES.length) return;
    setLoadingQuestion(true);
    const typingMs = ONBOARDING_TYPING_MS[idx];
    const timer = setTimeout(() => {
      if (unmountedRef.current) return;
      const msg = ONBOARDING_MESSAGES[idx];
      setMessages((prev) => [
        ...prev,
        { id: msg.id, type: "bot", content: msg.content },
      ]);
      setLoadingQuestion(false);
      coldStartStepRef.current = idx;

      if (idx === 0) {
        // M1 framing — auto-advance to M2 after a beat. No mic in
        // between; the message has no question, so prompting a
        // recording would just confuse the user.
        const gap = setTimeout(() => {
          if (unmountedRef.current) return;
          playColdStartStep(1);
        }, 250);
        onboardingTimersRef.current.push(gap);
      } else {
        // M2/M3/M4 — promote to the active question so the mic
        // appears. handleSend's cold-start branch will trigger the
        // next playColdStartStep after this turn's upload.
        setCurrentQuestion({
          text: msg.content,
          tone: FIRST_QUESTION_TONE,
        });
      }
    }, typingMs);
    onboardingTimersRef.current.push(timer);
  };

  // Mount: warm start (initialQuestion provided) → load Q1 immediately.
  // Cold start (no initialQuestion) → run the M1..M4 onboarding chain,
  // each of M2/M3/M4 being a separate recording turn per
  // docs/ARCHITECTURE_SINGLE_SOURCE_OF_TRUTH.md §1.
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

    // Cold start — kick off M1.
    setMessages([]);
    playColdStartStep(0);

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

  /**
   * Voice-only rating intake. Fires from the mic during the rating
   * phase (instead of handleSend, which would treat the recording as
   * a chat turn). Uploads the audio through the existing public
   * upload-answer pipeline to get Whisper's transcript, then forwards
   * that transcript to submitSelfRating which calls the backend.
   *
   * KNOWN GOTCHA: this upload reuses the interview-upload-answer
   * endpoint with turn_number = 0 as a sentinel so the backend can
   * choose to skip its normal turn-row persistence for rating audio.
   * If/when the backend ships a dedicated /v2/user/coaching/self-rating
   * variant that accepts multipart audio + does Whisper internally,
   * collapse this onto that endpoint and the sentinel becomes dead.
   */
  const handleRatingSend = useCallback(
    async (blob: Blob, durationSeconds: number) => {
      if (!sourceSnippetId) return;
      if (thresholdReachedRef.current) return;

      setUploading(true);
      setRatingError(null);
      // Accumulate client-side duration so the progress bar reflects
      // the rating recording too — it's still part of the session.
      clientDurationRef.current += durationSeconds;

      try {
        const result = await uploadInterviewAnswer(blob, {
          guestSessionId: guestSessionIdRef.current,
          // Sentinel — see comment above. NOT a real turn number.
          turnNumber: 0,
          questionTone: currentQuestion?.tone ?? "charisma",
          questionText: "On a scale of 1 to 10, how did that feel to you?",
          durationSeconds,
          sourceSnippetId: null,
          authToken,
        });

        const transcript = result.transcript?.trim() ?? "";
        await submitSelfRating(transcript);
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
        }
        console.warn("Rating upload failed:", err);
        setRatingError("Couldn't upload your rating. Try again.");
        setRatingPhase("asking");
      } finally {
        setUploading(false);
      }
    },
    [
      sourceSnippetId,
      currentQuestion,
      authToken,
      submitSelfRating,
      onError,
    ]
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

          // Notify backend the session is done. Per
          // docs/ARCHITECTURE_SINGLE_SOURCE_OF_TRUTH.md §3, frontend
          // is the source of truth for "session ended" — backend
          // doesn't track aggregate duration independently. Fire the
          // finalize POST in the background so the goodbye animation
          // doesn't wait on the network. Any failure is non-fatal:
          // the user still routes to /results 3s later via
          // onThresholdReached, and the backend can reconcile state
          // from the existing turn rows if the finalize call dropped.
          const sid = result.guest_session_id;
          void fetch("/api/session/finalize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              guest_session_id: sid,
              total_duration_seconds: effectiveTotal,
              reason: "threshold",
            }),
          }).catch((err) => {
            // Non-fatal — the user still gets to /results, backend
            // can reconcile from the turn rows.
            console.warn("/api/session/finalize threshold call failed:", err);
          });

          // Give the user ~3 seconds to read the goodbye, then transition
          farewellTimerRef.current = setTimeout(() => {
            onThresholdReached(sid);
          }, 3000);
          return;
        }

        // EBCP frustration-probe reaction — when the user just answered
        // the hardcoded math question (M4 — coldStartStepRef.current
        // === 3), peek at the Whisper transcript and drop in an
        // empathetic acknowledgement before the LLM's first dynamic
        // question lands. Keeps the chat feeling responsive even if the
        // LLM doesn't naturally branch on the math answer.
        // Positive answers fall through silently — the LLM's prompt
        // carries the reaction itself in that path.
        if (coldStartStepRef.current === 3 && result.transcript) {
          const negative =
            /\b(no|don'?t|hate|dislike|sucks|not really|not a fan|terrible|awful|bad at)\b/i.test(
              result.transcript
            );
          if (negative) {
            setLoadingQuestion(false);
            setMessages((prev) => [
              ...prev,
              {
                id: "ob-4-reaction",
                type: "bot",
                content: "Oh ok, then we'll make it quick!",
              },
            ]);
            // Brief beat so the reaction lands distinctly, then the typing
            // indicator returns for the LLM's first dynamic question.
            await new Promise((r) => setTimeout(r, 600));
            if (thresholdReachedRef.current) return;
            setLoadingQuestion(true);
          }
        }

        // Cold-start onboarding chain advance. While we're still in
        // M2 or M3 (steps 1 or 2), the next message is hardcoded
        // frontend copy — not a backend round-trip. Bump turnNumber
        // for the next upload's turn_number, render the next M, and
        // bail out before proceedToNextQuestion would fire.
        if (
          coldStartStepRef.current !== null &&
          coldStartStepRef.current >= 1 &&
          coldStartStepRef.current < 3
        ) {
          setCurrentQuestion(null);
          setTurnNumber((n) => n + 1);
          playColdStartStep(coldStartStepRef.current + 1);
          return;
        }

        // Contextual chat self-rating splice — applies ONLY to the
        // first user answer of a snippet-driven chat. We stash the
        // transcript on a ref and pause the linear flow here; the mic
        // (rerouted to handleRatingSend while ratingPhase === "asking")
        // owns resumption via submitSelfRating, which calls
        // proceedToNextQuestion once the rating round-trip lands.
        if (
          sourceSnippetId &&
          turnNumber === 1 &&
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
          attached to the mic instead of floating beneath it.
          During the rating phase the same mic stays visible — only
          the onSend handler swaps so the rating audio is uploaded
          via handleRatingSend (Whisper transcript → self-rating)
          instead of being treated as a regular chat turn. */}
      <div className="flex shrink-0 flex-col items-center gap-1 pb-4">
        {!loadingQuestion &&
          currentQuestion &&
          !thresholdReachedRef.current && (
            <VoiceRecordButton
              onSend={
                ratingPhase === "asking" || ratingPhase === "submitting"
                  ? handleRatingSend
                  : handleSend
              }
              onRecorded={handleRecorded}
              disabled={uploading || ratingPhase === "submitting"}
            />
          )}

        {/* Rating-phase inline error (RATING_UNPARSEABLE / upload
            failure). Sits between the mic and the helper copy so the
            user sees the prompt to retry without losing their place. */}
        {ratingError && (
          <p
            className="w-full max-w-sm rounded-md border border-red-200 bg-red-50 px-3 py-2 text-center text-xs text-red-800"
            role="alert"
          >
            {ratingError}
          </p>
        )}

        {/* Subtle "evaluating…" hint during the 425 retry ladder. */}
        {ratingEvaluating && (
          <p className="text-center text-xs text-muted-foreground">
            Evaluating your answer…
          </p>
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
