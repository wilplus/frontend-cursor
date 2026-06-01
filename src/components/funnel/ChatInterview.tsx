"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Mic, Paperclip, Upload } from "lucide-react";
import ChatBubble from "@/components/funnel/ChatBubble";
import VoiceRecordButton from "@/components/funnel/VoiceRecordButton";
import { RatePills, YesNoPills, type YesNoValue } from "@/components/chat/slots";
import { BottomSlot } from "@/components/chat/BottomSlot";
import { Button } from "@/components/ui/button";
import {
  fetchNextQuestion,
  uploadInterviewAnswer,
  uploadUserFile,
  USER_UPLOAD_ACCEPT,
  USER_UPLOAD_MAX_BYTES,
  GuestUploadFailure,
} from "@/lib/api/public-client";
import { getSharingConsent, setSharingConsent } from "@/lib/api/client";
import { splitAiBubbleText } from "@/lib/chat/bubbleSplit";
import { logQuestionAttribution } from "@/lib/chat/questionAttribution";
import { cn } from "@/lib/utils";

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
  /**
   * Bot-bubble CTA payload — only set on the post-finalize signup
   * bubble that fires after the session-1 gate passes. The
   * server-driven copy (`next.signup_cta.copy`) renders as the
   * bubble body and a primary-style button below the text routes
   * the user to the signup flow. Hidden when the finalize response
   * had `signup_cta.show: false` (or didn't ship the field).
   */
  cta?: {
    copy: string;
    href: string;
    label: string;
  };
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
  /**
   * Aggregate recording-duration cap (seconds). Default 30s for the
   * cold-start onboarding flow. The roleplay phase that runs AFTER
   * the in-chat snippet review uses 120s to give the user enough
   * room to practise without resetting the loop. Frontend-only —
   * backend doesn't track aggregate duration independently (SSoT
   * §3), so this can vary per phase without coordination.
   */
  aggregateThresholdSeconds?: number;
  /**
   * Optional callback fired after every successful upload-answer with
   * the per-turn `metrics` blob backend returns. The cold-start
   * onboarding flow uses this to accumulate raw acoustic stats so it
   * can show an AcousticMetricsBubble the moment the recording cap
   * fires — instead of routing the user to a separate waiting page.
   * Other phases ignore this and the prop stays undefined.
   */
  onMetricsCapture?: (metrics: Record<string, unknown>) => void;
  /**
   * Extra bubbles to append to the chat thread AFTER ChatInterview's
   * own message list. Used by the parent to continuously extend the
   * thread post-threshold (typing bubble, acoustic metrics, auth-ask
   * copy) without unmounting ChatInterview — so the user sees one
   * continuous conversation rather than a phase change.
   *
   * Renders as React children inside the same scroll container, so
   * the existing auto-scroll-to-bottom keeps working.
   */
  trailingBubbles?: React.ReactNode;
  /**
   * When set, REPLACES the entire bottom interaction area (mic,
   * paperclip toggle, helper text, disclaimer). Drives the "Mode C
   * contextual button" rule from the single-surface spec — e.g. the
   * parent renders a [Sign Up] button here in the metrics_ask phase.
   * Null/undefined → render the normal mic + paperclip toolbar.
   */
  bottomOverride?: React.ReactNode;
}

const DEFAULT_AGGREGATE_THRESHOLD_SECONDS = 30;

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
  const stage2: string[] = [];
  for (const chunk of baseChunks) {
    const match = chunk.match(/^([\s\S]+[.!?])\s+([^.!?]*\?\s*)$/);
    if (match) {
      const setup = match[1].trim();
      const question = match[2].trim();
      if (setup.length >= 20 && question.length > 0) {
        stage2.push(setup, question);
        continue;
      }
    }
    stage2.push(chunk);
  }

  // Pass 3: enforce the 75-char AI bubble cap. Each chunk from Pass 2
  // gets fanned out into one or more sub-chunks at sentence/word
  // boundaries via splitAiBubbleText. Single chunks already under the
  // cap return as-is, so this is a no-op for short questions.
  const result: string[] = [];
  for (const chunk of stage2) {
    result.push(...splitAiBubbleText(chunk));
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
  aggregateThresholdSeconds = DEFAULT_AGGREGATE_THRESHOLD_SECONDS,
  onMetricsCapture,
  trailingBubbles,
  bottomOverride,
}: ChatInterviewProps) {
  // Local alias makes the rest of the file diff-friendly with the
  // pre-parameterised version that used the bare constant.
  const AGGREGATE_THRESHOLD_SECONDS = aggregateThresholdSeconds;
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
  /**
   * Whisper-detected language for the user's most recent answer.
   * Surfaced as a pill near the progress bar so the user can confirm
   * the system heard them in the right language — the "AI replies in
   * English when I spoke Polish" complaint is impossible to debug if
   * the user can't see what language was detected. Backend ships this
   * on upload-answer; null/undefined hides the pill entirely.
   */
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);

  /**
   * Input mode toggle. "mic" renders the live VoiceRecordButton (the
   * default); "upload" swaps it out for a file picker / dropzone that
   * accepts pre-recorded audio + video. Users switch via the small
   * paperclip toggle below the input area. Per-mount state — the
   * toggle resets to "mic" on every chat phase change so the user
   * always lands on the primary input first.
   */
  const [inputMode, setInputMode] = useState<"mic" | "upload">("mic");
  /** True while a user-uploaded file is being POSTed. Drives the
   *  "Uploading {filename}…" bubble + disables the dropzone. */
  const [fileUploading, setFileUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Rating phase — sits between turn 1's upload and Q2 fetch when a
  // backend's upload-answer response sets requires_self_score=true.
  // See submitSelfRating + handleSend.
  //   none       — not asked (default), or rating already collected
  //   asking     — bot has prompted; <RatePills> 1–10 slot replaces
  //                the mic until the user taps one
  //   submitting — POST in flight (incl. 425 retries)
  //   done       — rating saved (or soft-failed) — continue to Q2
  const [ratingPhase, setRatingPhase] = useState<
    "none" | "asking" | "submitting" | "done"
  >("none");
  const [ratingError, setRatingError] = useState<string | null>(null);
  /** True while the backend has returned 425 ATTEMPT_NOT_READY at
   *  least once and we're sitting in the +2s/+5s retry ladder.
   *  Drives a subtle "evaluating…" hint below the slot so the user
   *  knows we heard them but the system is catching up. */
  const [ratingEvaluating, setRatingEvaluating] = useState(false);
  /** Which pill (1..10) the user just tapped — null until they pick.
   *  Drives the RatePills visual lock so the chosen pill stays filled
   *  + spins while submitSelfRating's POST is in flight; cleared on
   *  RATING_UNPARSEABLE so the user can re-pick. */
  const [lastRating, setLastRating] = useState<number | null>(null);
  /** Whisper transcript from turn 1 — stashed during the rating phase
   *  so we can attach it to previousTurns when we eventually fetch Q2. */
  const ratingDeferredTranscriptRef = useRef<string | null>(null);

  // Sharing-consent phase — one-time global question spliced AFTER the
  // user's first rating (or first rating soft-fail), BEFORE Q2. Fires
  // exactly once per user lifetime: gated on hasAnsweredSharingConsent,
  // which the backend flips true when we PUT the answer. Subsequent
  // chats skip the splice and continue straight from rating to Q2.
  //   none       — already answered (or fetch hasn't returned yet —
  //                we default to suppressing)
  //   asking     — two bot bubbles posted, Yes/No action buttons live
  //   submitting — PUT in flight (UI is optimistic; chat is moving on)
  //   done       — consent saved (or soft-failed) — back to normal flow
  const [consentPhase, setConsentPhase] = useState<
    "none" | "asking" | "submitting" | "done"
  >("none");
  /**
   * Default true so the prompt stays suppressed until the GET resolves.
   * Missing one session is less bad than showing a prompt the user has
   * already answered. Flips to false only on an explicit
   * has_answered: false from the backend.
   */
  const [hasAnsweredSharingConsent, setHasAnsweredSharingConsent] =
    useState<boolean>(true);
  /** Which Yes/No pill the user just tapped on the consent prompt —
   *  null until they pick. Drives the YesNoPills visual lock so the
   *  chosen pill stays filled + spins while the PUT is in flight. */
  const [consentLastPick, setConsentLastPick] = useState<YesNoValue | null>(
    null
  );

  const guestSessionIdRef = useRef<string | null>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const thresholdReachedRef = useRef(false);

  /**
   * Live session-1 satisfaction state — fed off every upload-answer
   * response (`completion_state` field, BE commits 3968868 + 082ea33).
   * Drives the per-criterion progress display under the mic. Null
   * until the first upload lands OR when the backend doesn't surface
   * the field (older deploys); in either case FE renders nothing
   * extra and falls back to the legacy duration threshold for the
   * completion trigger.
   */
  const [completionState, setCompletionState] = useState<{
    ready: boolean;
    criteria: {
      has_charisma: boolean;
      has_stress: boolean;
      duration_ok: boolean;
    };
    current: {
      charisma_count: number;
      stress_count: number;
      total_duration_ms: number;
    };
  } | null>(null);
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

  // Sharing consent: fetch the user's current state on mount so we know
  // whether to splice the one-time prompt after their first rating. Soft
  // failure (404 = backend hasn't shipped the endpoint yet, network
  // blip, etc.) keeps the default hasAnsweredSharingConsent = true and
  // the prompt stays suppressed. The contextual chat is the only place
  // the rating (and therefore the consent splice) can fire, so we skip
  // the fetch entirely for guest funnels and cold-start chats.
  useEffect(() => {
    if (!sourceSnippetId) return;
    let cancelled = false;
    getSharingConsent()
      .then((res) => {
        if (cancelled) return;
        if (res && res.has_answered === false) {
          setHasAnsweredSharingConsent(false);
        }
      })
      .catch(() => {
        // Backend may not have shipped the endpoint — keep default true.
      });
    return () => {
      cancelled = true;
    };
  }, [sourceSnippetId]);

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
        // FE-07 — log every admin-influenced turn (source ===
        // "directives_queue" | "admin_override") to the dev console
        // so production session diagnostics can grep which questions
        // came from admin steering. No user-visible effect.
        if (q.source) {
          logQuestionAttribution(
            { source: q.source, directive: q.directive },
            q.turn_number ?? 1
          );
        }
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
        const q = await fetchNextQuestion(
          nextTurn,
          previousTurns,
          guestSessionIdRef.current
        );
        if (q.source) {
          // FE-07 attribution log — see the cold-start branch above.
          // Same shape; ignoring the directive object on admin_override
          // (BE doesn't ship one for that source) is harmless because
          // logQuestionAttribution tolerates an undefined directive.
          logQuestionAttribution(
            { source: q.source, directive: q.directive },
            q.turn_number ?? nextTurn
          );
        }
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
   * Continuation point after the rating phase ends — both the success
   * and soft-fail paths funnel through here so the one-time sharing
   * consent prompt gets a single, consistent splice point. If consent
   * hasn't been answered yet, drop two bot bubbles + leave consentPhase
   * = "asking" (the Yes/No buttons take it from here and call
   * proceedToNextQuestion themselves). Otherwise advance to Q2 like
   * before.
   */
  const continueAfterRating = useCallback(async () => {
    if (unmountedRef.current) return;
    if (!hasAnsweredSharingConsent) {
      setMessages((prev) => [
        ...prev,
        {
          id: "consent-prompt-1",
          type: "bot",
          content:
            "Do you agree to share your charisma snippets globally and with your company for peer review? This helps everyone learn together.",
        },
      ]);
      // Brief beat so the second bubble feels conversational instead
      // of a wall of text dropping all at once.
      await new Promise((r) => setTimeout(r, 700));
      if (unmountedRef.current) return;
      setMessages((prev) => [
        ...prev,
        {
          id: "consent-prompt-2",
          type: "bot",
          content:
            "If you ever change your mind about a specific recording, just tell me 'don't share this one' and I'll keep it private!",
        },
      ]);
      setConsentPhase("asking");
      return;
    }
    await proceedToNextQuestion(ratingDeferredTranscriptRef.current ?? null);
  }, [hasAnsweredSharingConsent, proceedToNextQuestion]);

  /**
   * Yes/No tap on the one-time consent prompt. Echoes the user's
   * choice as a user bubble, optimistically flips the local flag so
   * future chats skip the splice, and fires the PUT in the background.
   * Soft-fails on PUT failure — the user has already committed in the
   * UI; making them re-answer on a network blip is worse than missing
   * one persistence write.
   */
  const handleConsentAnswer = useCallback(
    async (optIn: boolean) => {
      if (consentPhase !== "asking") return;
      setConsentPhase("submitting");
      setHasAnsweredSharingConsent(true);
      setMessages((prev) => [
        ...prev,
        {
          id: `consent-answer-${Date.now()}`,
          type: "user",
          content: optIn
            ? "Yes, share my snippets"
            : "No, keep them private",
        },
      ]);

      try {
        await setSharingConsent(optIn);
      } catch (err) {
        // Soft-fail — log and move on. The user has already committed
        // in the UI; re-prompting on a network blip is worse than
        // missing one persistence write.
        console.warn("consent.set_failed surface=fe", err);
      }

      if (unmountedRef.current) return;
      setMessages((prev) => [
        ...prev,
        {
          id: "consent-ack",
          type: "bot",
          content: optIn
            ? "Thanks — your snippets will help everyone learn together."
            : "Got it, your snippets stay private.",
        },
      ]);
      setConsentPhase("done");
      await new Promise((r) => setTimeout(r, 500));
      if (unmountedRef.current) return;
      await proceedToNextQuestion(
        ratingDeferredTranscriptRef.current ?? null
      );
    },
    [consentPhase, proceedToNextQuestion]
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
          console.warn("funnel.self_rating_fetch_threw surface=fe", err);
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
          await continueAfterRating();
          return;
        }

        if (data.code === "RATING_UNPARSEABLE") {
          // Backend's parser couldn't pull a 1..10 from the value.
          // Re-arm the pills with inline copy so the user can re-pick.
          setRatingEvaluating(false);
          setLastRating(null);
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
      console.warn(
        `funnel.self_rating_failed surface=fe code=${lastCode ?? "unknown"}`,
        lastError
      );
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
      await continueAfterRating();
    },
    [sourceSnippetId, continueAfterRating]
  );

  // (handleRatingSend deleted — voice-only rating intake removed.
  //  Rating phase now uses the <RatePills> 1–10 slot that feeds
  //  digit strings straight into submitSelfRating without Whisper.
  //  Voice extraction was too brittle for plain digits; the manual
  //  tap is faster AND more reliable.)

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

      // Split the farewell into ≤75-char bubbles per the snappy-chat
      // rule. Today's farewell strings already fit, but parametrised
      // callers (sourceSnippet roleplay) might pass a longer string.
      const farewellChunks = splitAiBubbleText(
        farewellMessage ||
          "For today we have got it, thanks! Now we will analyse it! 🚀"
      );
      setMessages((prev) => [
        ...prev,
        ...farewellChunks.map((content, i) => ({
          id: i === 0 ? "farewell" : `farewell-${i}`,
          type: "bot" as const,
          content,
        })),
      ]);

      // Finalize is fire-and-forget for routing purposes (the parent
      // navigates after the goodbye timer regardless), but we DO
      // consume the response when it lands: BE returns
      // `next.signup_cta: { show, copy }` on the gate-pass path
      // (task 6 BE commit 082ea33) and we render a CTA bubble in the
      // thread when it shows. 422 SESSION_INCOMPLETE is logged and
      // ignored — the FE gate already prevented finalize from firing
      // early in steady state; the 422 branch only matters for stale
      // clients and we don't want to break the goodbye-then-route
      // flow when it does fire.
      void (async () => {
        let res: Response;
        try {
          res = await fetch("/api/session/finalize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              guest_session_id: sid,
              total_duration_seconds: totalDurationSeconds,
              reason,
            }),
          });
        } catch (err) {
          console.warn(
            `funnel.session_finalize_failed surface=fe reason=${reason}`,
            err
          );
          return;
        }

        if (res.status === 422) {
          // Stale-client path. Defensive only — FE shouldn't reach
          // finalize without the gate satisfied.
          console.warn(
            `funnel.session_finalize_too_early surface=fe reason=${reason}`
          );
          return;
        }
        if (!res.ok) {
          console.warn(
            `funnel.session_finalize_non_ok status=${res.status} reason=${reason}`
          );
          return;
        }

        const data = (await res.json().catch(() => null)) as {
          next?: {
            signup_cta?: {
              show?: boolean;
              copy?: string;
              href?: string;
              label?: string;
            };
          };
        } | null;
        const cta = data?.next?.signup_cta;
        if (!cta || cta.show !== true || !cta.copy?.trim()) return;
        if (unmountedRef.current) return;

        setMessages((prev) => [
          ...prev,
          {
            id: "signup-cta",
            type: "bot",
            cta: {
              copy: cta.copy!.trim(),
              // BE-provided defaults; FE falls back to a sensible
              // signup route + label when not supplied so the bubble
              // is always actionable.
              href: cta.href?.trim() || "/login?mode=signup",
              label: cta.label?.trim() || "Create your account",
            },
          },
        ]);
      })();

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
   * File upload handler — fires when the user picks an audio/video
   * file from disk while in "upload" input mode. Pushes a transient
   * "Uploading {filename}…" bot bubble into the chat thread, POSTs
   * the file to /api/v2/user/uploads, then replaces the bubble with
   * either a success or error confirmation. The file is linked to
   * the current session_id (when available) so the admin Files tab
   * can group uploads by session.
   *
   * Requires an auth token — guest funnel uploads are unsupported
   * for files (we don't have a corresponding claim flow yet). If
   * authToken is absent, the picker is disabled in the JSX above.
   */
  const handleFileUpload = useCallback(
    async (file: File | null | undefined) => {
      if (!file) return;
      if (fileUploading) return;
      if (!authToken) {
        setErrorMessage(
          "Sign in to upload files — pre-recorded uploads need an account."
        );
        return;
      }

      // Bubble id for the transient progress message — we'll replace
      // this same row from "Uploading…" to the final status so the
      // thread doesn't accumulate dead bubbles. Final status may
      // expand to multiple bubbles if it exceeds the 75-char AI cap
      // (long filenames trigger this), so the replacement logic does
      // an in-place 1-to-N swap by original bubble id.
      const bubbleId = `upload-${Date.now()}`;
      setFileUploading(true);
      setErrorMessage(null);
      setMessages((prev) => [
        ...prev,
        {
          id: bubbleId,
          type: "bot",
          content: splitAiBubbleText(`Uploading ${file.name}…`)[0] ?? "",
          // Stash the full text so the status replacement can match
          // and rebuild — see replaceUploadBubble below.
        },
      ]);

      const replaceUploadBubble = (finalText: string) => {
        const finalChunks = splitAiBubbleText(finalText);
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.id === bubbleId);
          if (idx < 0) return prev;
          const replacement = finalChunks.map((content, i) => ({
            id: i === 0 ? bubbleId : `${bubbleId}-${i}`,
            type: "bot" as const,
            content,
          }));
          return [
            ...prev.slice(0, idx),
            ...replacement,
            ...prev.slice(idx + 1),
          ];
        });
      };

      try {
        const result = await uploadUserFile(file, {
          sessionId: guestSessionIdRef.current,
          authToken,
        });
        replaceUploadBubble(
          `File “${result.filename}” uploaded — your coach will review it.`
        );
      } catch (err) {
        const message =
          err instanceof GuestUploadFailure
            ? err.code === "FILE_TOO_LARGE"
              ? `“${file.name}” is over the ${Math.round(
                  USER_UPLOAD_MAX_BYTES / 1024 / 1024
                )} MB limit.`
              : err.message
            : err instanceof Error
            ? err.message
            : "Couldn't upload the file.";
        replaceUploadBubble(`Couldn't upload “${file.name}” — ${message}`);
      } finally {
        setFileUploading(false);
        // Reset the input so the same file can be re-selected after
        // an error (browsers suppress change events for repeat picks).
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [authToken, fileUploading]
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

        // Surface the Whisper-detected language so the pill near the
        // progress bar can render it. Only updates when backend ships
        // a non-empty value — leaving stale state intact if a turn
        // returns nothing (better than flickering "—" between turns).
        if (
          typeof result.detected_language === "string" &&
          result.detected_language.trim().length > 0
        ) {
          setDetectedLanguage(result.detected_language.trim());
        }

        // Capture the live session-1 satisfaction state so the
        // progress display under the mic re-renders with the latest
        // counts. Absent on older BE deploys — null state hides
        // the progress widget entirely (FE falls back to the legacy
        // duration threshold below).
        if (result.completion_state) {
          setCompletionState(result.completion_state);
        }

        // Hand raw per-turn metrics off to the parent for the cold-
        // start onboarding flow's AcousticMetricsBubble. Parent
        // accumulates across turns; we don't keep them locally.
        if (
          onMetricsCapture &&
          result.metrics &&
          typeof result.metrics === "object"
        ) {
          onMetricsCapture(result.metrics);
        }

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

        // Check end-of-session triggers. Three conditions fire here:
        //   1. Session-1 satisfaction gate (BE-driven, cold-start
        //      only) — replaces the 30s duration constant per task 6.
        //      Backend's `session_1_complete` flips true when ≥1
        //      charisma + ≥1 stress + ≥60s. Falls back to the legacy
        //      duration check when the field is absent (older deploys
        //      OR contextual chats, which don't surface the gate).
        //   2. Cold-start aggregate duration threshold (30s) —
        //      legacy fallback. Stays as the SAFETY net when the
        //      backend gate isn't available; in steady state the
        //      session_1_complete signal fires first because it
        //      reaches a non-zero threshold via ≥60s + intent
        //      diversity, BUT the duration check is still the floor
        //      for non-session-1 surfaces (contextual chat answers
        //      sometimes burn 30s+).
        //   3. Contextual-chat turn cap (3 turns) — applies only when
        //      sourceSnippetId is set, guarantees finalize runs even
        //      when the user only does 1-2 short answers. This is the
        //      fix for "contextual sessions don't appear in admin"
        //      reported when the duration threshold was the only path
        //      to finalize.
        const reachedSession1Gate =
          !sourceSnippetId && result.session_1_complete === true;
        const reachedDurationThreshold =
          effectiveTotal >= AGGREGATE_THRESHOLD_SECONDS;
        const reachedContextualTurnCap =
          !!sourceSnippetId && turnNumber >= CONTEXTUAL_CHAT_MAX_TURNS;

        if (
          reachedSession1Gate ||
          reachedDurationThreshold ||
          reachedContextualTurnCap
        ) {
          endSession(
            result.guest_session_id,
            effectiveTotal,
            reachedSession1Gate || reachedDurationThreshold
              ? "threshold"
              : "max_turns"
          );
          return;
        }

        // (Math-probe reaction + cold-start advance branches deleted —
        // no more hardcoded onboarding turns. Backend owns the entire
        // conversation including any "soft empathy on a no" beat the
        // model wants to deliver, since the math question is no longer
        // a fixed turn the frontend can pre-emptively branch on.)

        // NLP opt-out confirmation — when the backend's intent
        // detector flagged the user's answer as "don't share this one"
        // (or a paraphrase), surface a brief ack bubble inline and
        // keep the linear flow going. Backend has already locked the
        // snippet server-side; the frontend doesn't need to mutate
        // any other state here. Skips during finalize (the goodbye
        // bubble is more important than this confirmation).
        if (result.snippet_opted_out && !thresholdReachedRef.current) {
          setLoadingQuestion(false);
          setMessages((prev) => [
            ...prev,
            {
              id: `opt-out-${Date.now()}`,
              type: "bot",
              content: "Done, I've locked that snippet. It won't be shared.",
            },
          ]);
          // Brief beat so the ack lands distinctly, then the typing
          // indicator returns for whatever the LLM has to say next.
          await new Promise((r) => setTimeout(r, 600));
          if (thresholdReachedRef.current) return;
          setLoadingQuestion(true);
        }

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
      onMetricsCapture,
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
          {/* Session-1 satisfaction progress — three criteria the
              backend's gate evaluates (≥1 charisma + ≥1 stress + ≥60s
              audio). Only visible on the cold-start path (no
              sourceSnippetId) and once the first upload has populated
              completionState. Each chip dims when unsatisfied; a
              check appears once the criterion flips green. */}
          {!sourceSnippetId && completionState && (
            <div
              className="mt-1.5 flex flex-wrap items-center justify-center gap-1.5 text-[10px]"
              role="status"
              aria-live="polite"
            >
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 tabular-nums",
                  completionState.criteria.has_charisma
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-border bg-muted text-muted-foreground"
                )}
              >
                {completionState.criteria.has_charisma && (
                  <span aria-hidden>✓</span>
                )}
                {completionState.current.charisma_count} charisma
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 tabular-nums",
                  completionState.criteria.has_stress
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-border bg-muted text-muted-foreground"
                )}
              >
                {completionState.criteria.has_stress && (
                  <span aria-hidden>✓</span>
                )}
                {completionState.current.stress_count} stress
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 tabular-nums",
                  completionState.criteria.duration_ok
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-border bg-muted text-muted-foreground"
                )}
              >
                {completionState.criteria.duration_ok && (
                  <span aria-hidden>✓</span>
                )}
                {Math.round(
                  completionState.current.total_duration_ms / 1000
                )}
                s / 60s
              </span>
            </div>
          )}
          {/* Language transparency pill — surfaces what Whisper
              detected so the user can spot a mismatch (e.g. spoke
              Polish, AI replied in English). Hidden until the first
              upload reports a language; backend hasn't shipped the
              field everywhere yet, and an absent value is better
              than a confusing "Unknown" label. */}
          {detectedLanguage && (
            <p
              className="mt-1.5 text-center text-[10px] text-muted-foreground"
              aria-live="polite"
            >
              Language detected:{" "}
              <span className="font-semibold text-foreground">
                {formatDetectedLanguage(detectedLanguage)}
              </span>
            </p>
          )}
        </div>
      )}

      {/* Chat thread — internal scroll only; messages anchor to the bottom */}
      <div className="flex flex-1 flex-col justify-end gap-3 overflow-y-auto py-6">
        {messages.map((msg) => {
          // Post-finalize signup CTA bubble — bot-styled bubble that
          // carries the server's copy + a primary-style link button.
          // Rendered as a distinct branch so it doesn't have to ride
          // through ChatBubble's text-only contract.
          if (msg.cta) {
            return (
              <div
                key={msg.id}
                className="flex justify-start animate-fade-in-up"
              >
                <div className="flex max-w-[85%] items-start gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
                    <span className="text-xs font-bold text-primary-foreground">
                      W
                    </span>
                  </div>
                  <div className="rounded-2xl rounded-tl-sm border border-border bg-chat-bot px-4 py-3 shadow-sm">
                    <p className="mb-3 text-sm leading-relaxed text-foreground">
                      {msg.cta.copy}
                    </p>
                    <Link
                      href={msg.cta.href}
                      className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    >
                      {msg.cta.label}
                    </Link>
                  </div>
                </div>
              </div>
            );
          }
          return (
            <ChatBubble
              key={msg.id}
              type={msg.type}
              content={msg.content}
              audioUrl={msg.audioUrl}
              duration={msg.duration}
            />
          );
        })}

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

        {/* Parent-injected trailing bubbles. Used post-threshold to
            extend the same thread with the typing-while-compiling
            bubble, the AcousticMetricsBubble, and the auth-ask text
            — keeps the conversation continuous instead of remounting
            into a separate phase screen. */}
        {trailingBubbles}

        <div ref={threadEndRef} />
      </div>

      {/* Bottom toolbar — single-slot per the unified-toolbar rule.
          Order of precedence:
            1. `bottomOverride` — parent-driven contextual button
               (e.g. [Sign Up]). When set, NOTHING else renders here.
            2. Sharing-consent Yes/No buttons — one-time, post-rating.
               Tap-to-pick, not voice (binary choice, no transcript).
            3. RatePills slot — when ratingPhase is asking or
               submitting (single canonical 1–10 surface).
            4. Default: mic OR file dropzone + paperclip toggle,
               gated on currentQuestion + not loading + not past
               threshold. The "Tap the mic to answer" helper was
               removed to keep the slot pure; only the GDPR
               disclaimer remains (anonymous guests, turn 1 only). */}
      <BottomSlot widthClass="max-w-md">
        <div className="flex flex-col items-center gap-1">
        {bottomOverride ? (
          bottomOverride
        ) : consentPhase === "asking" || consentPhase === "submitting" ? (
          <div className="w-full max-w-md">
            <YesNoPills
              onPick={(v) => {
                setConsentLastPick(v);
                void handleConsentAnswer(v === "yes");
              }}
              selected={consentLastPick}
              submitting={consentPhase === "submitting"}
              yesLabel="Yes, share my snippets"
              noLabel="No, keep them private"
            />
          </div>
        ) : ratingPhase === "asking" || ratingPhase === "submitting" ? (
          <div className="flex w-full max-w-md flex-col items-stretch gap-2">
            <RatePills
              onPick={(value) => {
                setLastRating(value);
                void submitSelfRating(String(value));
              }}
              selected={lastRating}
              submitting={ratingPhase === "submitting"}
            />
            {ratingEvaluating && !ratingError && (
              <p className="text-center text-[11px] text-muted-foreground">
                evaluating…
              </p>
            )}
            {ratingError && (
              <p
                className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-center text-xs text-destructive"
                role="alert"
              >
                {ratingError}
              </p>
            )}
          </div>
        ) : (
          !loadingQuestion &&
          currentQuestion &&
          !thresholdReachedRef.current && (
            <>
              {inputMode === "mic" ? (
                <VoiceRecordButton
                  onSend={handleSend}
                  onRecorded={handleRecorded}
                  disabled={uploading || fileUploading}
                />
              ) : (
                <FileUploadDropzone
                  inputRef={fileInputRef}
                  busy={fileUploading}
                  disabled={!authToken}
                  onFile={(f) => void handleFileUpload(f)}
                />
              )}

              {/* Mic / Upload mode toggle — small, secondary, sits
                  directly below the primary input control. Auth gate:
                  uploads require a bearer token, so the toggle is
                  disabled for the guest funnel until they sign up. */}
              <button
                type="button"
                onClick={() =>
                  setInputMode((m) => (m === "mic" ? "upload" : "mic"))
                }
                disabled={uploading || fileUploading || !authToken}
                title={
                  authToken
                    ? inputMode === "mic"
                      ? "Upload a pre-recorded file instead"
                      : "Use the live microphone instead"
                    : "Sign in to upload pre-recorded files"
                }
                className="mt-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                {inputMode === "mic" ? (
                  <>
                    <Paperclip className="h-3 w-3" aria-hidden /> Upload a
                    file instead
                  </>
                ) : (
                  <>
                    <Mic className="h-3 w-3" aria-hidden /> Use the
                    microphone instead
                  </>
                )}
              </button>
            </>
          )
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
      </BottomSlot>
    </div>
  );
}

/**
 * FileUploadDropzone — stylised file picker that replaces the
 * VoiceRecordButton when inputMode === "upload". Click-to-open via a
 * hidden <input type="file"> ref, plus a dashed-border surface that
 * also accepts drag-and-drop. Disabled state is used for the guest
 * funnel (no auth token → uploads can't be persisted).
 */
function FileUploadDropzone({
  inputRef,
  busy,
  disabled,
  onFile,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  busy: boolean;
  disabled: boolean;
  onFile: (file: File | null) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <div className="w-full max-w-md">
      <input
        ref={inputRef}
        type="file"
        accept={USER_UPLOAD_ACCEPT}
        disabled={busy || disabled}
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          if (f) onFile(f);
        }}
        className="sr-only"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          if (busy || disabled) return;
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          if (busy || disabled) return;
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0] ?? null;
          if (f) onFile(f);
        }}
        disabled={busy || disabled}
        className={`flex w-full items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed px-5 py-6 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
          dragOver
            ? "border-primary bg-primary/10 text-primary"
            : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-primary/5"
        }`}
        aria-label="Upload an audio or video file"
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Uploading…
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" aria-hidden />
            Tap to choose, or drop a file here
          </>
        )}
      </button>
      <p className="mt-1.5 text-center text-[10px] leading-tight text-muted-foreground">
        Audio (.mp3, .wav, .m4a) or video (.mp4, .mov) up to{" "}
        {Math.round(USER_UPLOAD_MAX_BYTES / 1024 / 1024)} MB.
      </p>
    </div>
  );
}

/**
 * Humanise Whisper's detected_language value for the UI pill.
 * Accepts either ISO 639-1 codes ("pl", "en") or English names
 * ("Polish", "english") and normalises to Title-Case English.
 * Unknown codes pass through with first-letter capitalisation so the
 * pill never disappears even when backend ships an unmapped value.
 */
function formatDetectedLanguage(raw: string): string {
  const code = raw.trim().toLowerCase();
  if (code.length === 0) return raw;
  const MAP: Record<string, string> = {
    pl: "Polish",
    en: "English",
    es: "Spanish",
    fr: "French",
    de: "German",
    it: "Italian",
    pt: "Portuguese",
    nl: "Dutch",
    ru: "Russian",
    uk: "Ukrainian",
    cs: "Czech",
    sk: "Slovak",
    sv: "Swedish",
    da: "Danish",
    no: "Norwegian",
    fi: "Finnish",
    tr: "Turkish",
    ja: "Japanese",
    ko: "Korean",
    zh: "Chinese",
    ar: "Arabic",
    hi: "Hindi",
  };
  if (MAP[code]) return MAP[code];
  // Fall back: capitalize words for human display.
  return raw
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
