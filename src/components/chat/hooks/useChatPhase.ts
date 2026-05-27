/**
 * `useChatPhase` — the /chat surface's top-level state machine,
 * auth bootstrap, and realtime subscription wiring.
 *
 * Owns:
 *   - `phase` — `loading | error | welcome_back | q_and_a | reviewing
 *     | onboarding | compiling | metrics_ask | roleplaying`
 *   - `errorMsg` — copy shown when phase=error
 *   - `activeSessionId` — `?session=<id>` mirror (settable for the
 *     anonymous-onboarding → compiling handoff which captures the id
 *     out of the chat-complete callback)
 *   - `userId` — logged-in user id, hydrated once via the browser
 *     Supabase client. Used as the row-change filter for the
 *     `v2_sessions` realtime subscription.
 *   - `refetchToken` — bumped to force the status-probe + reviewing-
 *     snippets effects to re-run. Fires from `usePublishLiveSubscription`
 *     on Realtime events AND from its 20s polling fallback. Both
 *     signals collapse onto the same code path so the realtime fast
 *     path doesn't create a parallel render branch (matrix C2).
 *   - `welcomeFlagRef` — synchronous-on-first-render localStorage
 *     consume of the post-onboarding welcome flag. MUST stay in the
 *     `if (ref.current === null)` pattern (NOT a useEffect) so the
 *     session route guard can react synchronously without a redirect-
 *     bounce on the first render.
 *   - `guard` — `useSessionRouteGuard` output. Disabled on deep-links
 *     (`?session=<id>`) and on the welcome-back hop.
 *
 * Effects owned:
 *   - Supabase `getUser()` bootstrap for `userId`
 *   - `usePublishLiveSubscription(userId, triggerRefetch)` wire
 *   - Initial phase routing (welcome flag → sessionId → onboarding)
 *   - Welcome-back → q_and_a flip (~400ms breath + bubble push)
 *
 * Exposes setters for `phase`, `activeSessionId`, `errorMsg` because
 * downstream concerns (the labeling chain, the QA composer, the
 * onboarding/metrics glue that stays in the parent) need to drive
 * the state machine — e.g. `handleChatComplete` flips to `compiling`
 * after the anonymous funnel finishes; the reviewing-fetch hook
 * flips q_and_a → reviewing on status=completed.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { ThreadHandle } from "@/components/chat/thread/useThread";
import type { Phase } from "@/components/chat/thread/types";
import { usePublishLiveSubscription } from "@/hooks/usePublishLiveSubscription";
import { createClient as createSupabaseBrowser } from "@/lib/supabase/client";
import { consumePostOnboardingWelcome } from "@/lib/funnel/postOnboardingWelcome";
import { useSessionRouteGuard } from "@/lib/session/useSessionRouteGuard";
import { botBubblesFromText } from "@/lib/chat/botBubbles";

/** Greeting copy shown to a returning user whose session is still
 *  processing — keeps them in the active Q&A surface instead of a
 *  static waiting page. Per the "pending users in active chat" spec. */
const PENDING_GREETING =
  "Your charisma snippets haven't arrived yet, but we can talk! " +
  "Do you have any questions or would you like to know more about " +
  "the voice analysis?";

export interface UseChatPhaseParams {
  /** `?session=<id>` from the URL. Present after finalize redirects
   *  and admin email deep-links; null on the cold-start home /chat. */
  sessionId: string | null;
  appendBubble: ThreadHandle["appendBubble"];
  clearBubbles: ThreadHandle["clearBubbles"];
}

export interface UseChatPhaseReturn {
  phase: Phase;
  setPhase: (p: Phase) => void;
  errorMsg: string | null;
  setErrorMsg: (m: string | null) => void;
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;
  userId: string | null;
  refetchToken: number;
  /** Bump `refetchToken` to force status-probe + reviewing-fetch
   *  effects to re-run immediately. */
  triggerRefetch: () => void;
  guard: ReturnType<typeof useSessionRouteGuard>;
}

export function useChatPhase({
  sessionId,
  appendBubble,
  clearBubbles,
}: UseChatPhaseParams): UseChatPhaseReturn {
  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(
    sessionId
  );
  /**
   * Logged-in user id, hydrated once on mount via the browser
   * Supabase client. Used as the row-change filter for the
   * `v2_sessions` realtime subscription — anonymous users have no
   * row to watch, so `userId === null` is the no-op signal for
   * `usePublishLiveSubscription`. We don't subscribe to
   * onAuthStateChange because /chat is a full reload after OAuth,
   * not a same-tab sign-in.
   */
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    try {
      const supabase = createSupabaseBrowser();
      supabase.auth
        .getUser()
        .then(({ data }) => {
          if (!cancelled) setUserId(data.user?.id ?? null);
        })
        .catch(() => {
          if (!cancelled) setUserId(null);
        });
    } catch {
      // Missing Supabase env (e.g. local dev without .env.local).
      // The realtime hook gracefully no-ops on null userId.
    }
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Refetch coordinator. Bumping `refetchToken` forces both the
   * status-probe effect AND the reviewing-snippets effect to re-run
   * immediately (they list it in their deps array). Used by:
   *   - `usePublishLiveSubscription` on a Realtime publish event
   *   - the same hook's 20s polling fallback
   * Both signals collapse onto the same code path so the realtime
   * fast path doesn't create a parallel render branch (matrix C2).
   */
  const [refetchToken, setRefetchToken] = useState(0);
  const triggerRefetch = useCallback(() => {
    setRefetchToken((t) => t + 1);
  }, []);
  usePublishLiveSubscription(userId, triggerRefetch);

  // Loop guard runs ONLY for the param-less /chat. With `?session=` in
  // the URL we're deliberately deep-linked; the guard would yank us
  // away. And on the welcome-back hop we also disable the guard via
  // the localStorage flag (handled below) so the post-signup user
  // doesn't get bounced to /chat?session=<id>.
  const welcomeFlagRef = useRef<boolean | null>(null);
  if (welcomeFlagRef.current === null) {
    // Run once on first render so the guard can react synchronously.
    welcomeFlagRef.current = consumePostOnboardingWelcome();
  }
  const guard = useSessionRouteGuard({
    enabled: !sessionId && !welcomeFlagRef.current,
  });

  /* ---------------------------------------------------------------------- */
  /*  Initial phase routing                                                 */
  /* ---------------------------------------------------------------------- */
  useEffect(() => {
    if (guard.checking || guard.redirecting) return;

    // Welcome flag wins: user just signed up after onboarding.
    if (welcomeFlagRef.current) {
      setPhase("welcome_back");
      return;
    }

    if (sessionId) {
      // Returning user with an in-flight session. Per the "pending
      // users in active chat" spec, we DON'T show a static waiting
      // screen — drop them straight into Q&A with a pending-snippets
      // greeting. The polling effect below promotes them to the
      // review surface the moment the admin publishes. If the session
      // is already completed when we land here, the initial status
      // probe inside the polling effect flips us to "reviewing"
      // before the greeting ever paints. Greeting is run through the
      // 75-char bubble splitter so a long string fans out into
      // multiple snappy bubbles.
      clearBubbles();
      for (const b of botBubblesFromText(PENDING_GREETING)) appendBubble(b);
      setPhase("q_and_a");
      return;
    }

    // No session, no welcome flag → record a fresh cold-start.
    setPhase("onboarding");
  }, [sessionId, guard.checking, guard.redirecting, appendBubble, clearBubbles]);

  /* ---------------------------------------------------------------------- */
  /*  Welcome-back → push two bubbles → flip to Q&A                        */
  /* ---------------------------------------------------------------------- */
  useEffect(() => {
    if (phase !== "welcome_back") return;
    // Both welcome strings go through the 75-char splitter for
    // consistency — "Thanks, check…" fits in one bubble, the longer
    // "Do you have any questions…" question splits into two snappy
    // beats.
    clearBubbles();
    for (const b of botBubblesFromText(
      "Thanks, check your email in a few hours."
    )) {
      appendBubble(b);
    }
    for (const b of botBubblesFromText(
      "Do you have any questions or would you like to know more about the voice analysis?"
    )) {
      appendBubble(b);
    }
    // Tiny breath so the user reads "Thanks…" before the input row
    // mounts; otherwise it feels abrupt.
    const t = setTimeout(() => setPhase("q_and_a"), 400);
    return () => clearTimeout(t);
  }, [phase, appendBubble, clearBubbles]);

  return {
    phase,
    setPhase,
    errorMsg,
    setErrorMsg,
    activeSessionId,
    setActiveSessionId,
    userId,
    refetchToken,
    triggerRefetch,
    guard,
  };
}
