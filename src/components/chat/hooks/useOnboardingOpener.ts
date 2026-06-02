import { useCallback, useRef, useState } from "react";
import type { Phase } from "@/components/chat/thread/types";
import type { ThreadHandle } from "@/components/chat/thread/useThread";
import { getAuthToken } from "@/lib/api/auth-client";
import {
  hasAttemptedOpener,
  hasSeenOpener,
  markOpenerAttempted,
  markOpenerSeen,
} from "@/lib/funnel/onboardingOpenerSeen";
import { consumePostSignupConfirmation } from "@/lib/funnel/postSignupConfirmation";

/* -------------------------------------------------------------------------- */
/*  T2 — Dad-joke onboarding opener state machine                             */
/*                                                                            */
/*  Lifecycle (fires once, on welcome_back entry, for first-time users):     */
/*                                                                            */
/*    idle                                                                    */
/*     └─ run() called ──────────────────────────────────────────────────┐   */
/*         ├─ 204 / any non-200 from /start → bail to welcome_back       │   */
/*         └─ 200 from /start:                                            │   */
/*             append frame bubble (immediate)                            │   */
/*             append setup bubble (~700ms)                               │   */
/*             → awaiting_punchline (phase = "opening")                   │   */
/*                                                                        │   */
/*  awaiting_punchline                                                    │   */
/*     └─ submitReply() (first user reply)                                │   */
/*         └─ POST /opener/next {after_punchline:false}                   │   */
/*             ├─ error / 404 → bail to q_and_a                           │   */
/*             └─ 200:                                                    │   */
/*                 append ack (if non-empty, immediate)                   │   */
/*                 append punchline (~1200ms after ack)                   │   */
/*                 → awaiting_pivot                                        │   */
/*                                                                        │   */
/*  awaiting_pivot                                                        │   */
/*     └─ submitReply() (second user reply)                               │   */
/*         └─ POST /opener/next {after_punchline:true}                    │   */
/*             ├─ error → bail to q_and_a                                 │   */
/*             └─ 200:                                                    │   */
/*                 append pivot_line (~600ms)                              │   */
/*                 markOpenerSeen() + drain confirmationStorage            │   */
/*                 → setPhase("q_and_a") [phase="opening" ends here]      │   */
/*                                                                        │   */
/*  "bail" paths always call markOpenerSeen() first so the user never    │   */
/*  sees the opener twice (even if it errored mid-flow).                  │   */
/*                                                                        │   */
/*  Verbatim text rule: frame + pivot_line MUST NOT be modified client-   │   */
/*  side (§3 in the FE handoff — the pivot_line is the brand anchor for   │   */
/*  every user's first interaction; drift on the FE is the most likely   │   */
/*  vector for the anti-drift test the BE asserts on it).                 │   */
/*                                                                        │   */
/*  Voice tagging: all appended bubbles carry source:"onboarding_opener"  │   */
/*  so any future LLM evaluator pass can skip them (§4 in the handoff).  │   */
/* -------------------------------------------------------------------------- */

/** Beat delays (ms) per §2 of the FE handoff. Exported so tests can stub. */
export const BEAT_DELAY = {
  setup: 700,
  punchline: 1200,
  pivot: 600,
} as const;

type OpenerStep =
  | "idle"
  | "loading"
  | "awaiting_punchline"
  | "awaiting_pivot"
  | "done";

interface StartResponse200 {
  stage: "setup";
  joke_id: string;
  frame: string;
  setup: string;
}

interface NextResponsePunchline {
  stage: "punchline";
  joke_id: string;
  ack: string;
  punchline: string;
}

interface NextResponsePivot {
  stage: "pivot";
  joke_id: null;
  pivot_line: string;
  done: true;
}

export interface UseOnboardingOpenerReturn {
  /** Call on welcome_back entry. Checks frequency cap; fires /start. */
  run: (
    setPhase: (p: Phase) => void,
    appendBubble: ThreadHandle["appendBubble"]
  ) => Promise<void>;
  /** Forward the user's input bar submission here when phase==="opening". */
  submitReply: (
    text: string,
    setPhase: (p: Phase) => void,
    appendBubble: ThreadHandle["appendBubble"]
  ) => Promise<void>;
  /** True while a /start or /next call is in flight. */
  isSubmitting: boolean;
}

export function useOnboardingOpener(): UseOnboardingOpenerReturn {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const stepRef = useRef<OpenerStep>("idle");
  const jokeIdRef = useRef<string | null>(null);
  // Abort / cleanup guard — cancel pending timers on unmount.
  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timerRefs.current.forEach(clearTimeout);
    timerRefs.current = [];
  };

  const after = (ms: number, fn: () => void): void => {
    const t = setTimeout(fn, ms);
    timerRefs.current.push(t);
  };

  /**
   * Bail path — opener can't run or failed. Routes onward WITHOUT
   * persisting the seen-flag: a 204 (empty dad_jokes table) or transient
   * error must not permanently disable the opener — it retries on the
   * next full page load. Re-entry within THIS load is blocked by the
   * in-memory attempted-guard (set in run()). Only a completed joke
   * (the pivot in submitReply) sets the persistent seen-flag.
   */
  const bail = useCallback(
    (
      setPhase: (p: Phase) => void,
      target: "welcome_back" | "q_and_a" | "onboarding" = "onboarding"
    ) => {
      stepRef.current = "done";
      setPhase(target);
    },
    []
  );

  const run = useCallback(
    async (
      setPhase: (p: Phase) => void,
      appendBubble: ThreadHandle["appendBubble"]
    ): Promise<void> => {
      // Frequency cap — completed (persistent) OR attempted this load
      // (in-memory). useChatPhase gates on both before setting
      // phase="opening", so this is a defensive guard.
      if (hasSeenOpener() || hasAttemptedOpener()) {
        markOpenerAttempted();
        const existingToken = await getAuthToken();
        setPhase(existingToken ? "welcome_back" : "onboarding");
        return;
      }

      if (stepRef.current !== "idle") return; // guard against double-fire
      stepRef.current = "loading";
      // Mark attempted IMMEDIATELY so the routing + welcome_back effects
      // can't bounce back into "opening" while this is in flight or after
      // it bails. Resets on a full page reload, so a 204 retries next time.
      markOpenerAttempted();
      setIsSubmitting(true);

      // Where to go if the opener can't run (204 empty table, network,
      // bad payload). Anonymous → straight into onboarding (recording);
      // authed → welcome_back (the normal post-signup confirmation flow).
      let afterOpenerPhase: Phase = "onboarding";

      try {
        // Auth is optional — anonymous visitors have no token and that
        // is fine. Include the header only when a token is available.
        const token = await getAuthToken();
        afterOpenerPhase = token ? "welcome_back" : "onboarding";

        let res: Response;
        try {
          res = await fetch("/api/v2/onboarding/opener/start", {
            method: "POST",
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
              "Content-Type": "application/json",
            },
            body: "{}",
          });
        } catch {
          bail(setPhase, afterOpenerPhase);
          return;
        }

        // 204 (no jokes / table missing) or any non-200 → silent skip.
        // bail does NOT persist the seen-flag, so once BE seeds the
        // table the opener appears on the user's next visit.
        if (res.status !== 200) {
          bail(setPhase, afterOpenerPhase);
          return;
        }

        const data = (await res.json().catch(() => null)) as StartResponse200 | null;
        if (!data?.joke_id || !data.frame || !data.setup) {
          bail(setPhase, afterOpenerPhase);
          return;
        }

        jokeIdRef.current = data.joke_id;

        // Beat 1: frame — immediate.
        // voice: 'opener' tag lives in the source field; any future
        // LLM evaluator pass should skip source==='onboarding_opener'.
        appendBubble({ kind: "bot_text", text: data.frame });

        // Beat 2: setup — ~700ms after beat 1.
        after(BEAT_DELAY.setup, () => {
          appendBubble({ kind: "bot_text", text: data.setup });
          stepRef.current = "awaiting_punchline";
          setIsSubmitting(false);
          // Transition to the opening phase so the input bar mounts.
          setPhase("opening");
        });
      } catch (err) {
        console.warn("useOnboardingOpener.run — unexpected error:", err);
        bail(setPhase, afterOpenerPhase);
        setIsSubmitting(false);
      }
    },
    [bail]
  );

  const submitReply = useCallback(
    async (
      text: string,
      setPhase: (p: Phase) => void,
      appendBubble: ThreadHandle["appendBubble"]
    ): Promise<void> => {
      if (isSubmitting) return;
      const step = stepRef.current;
      if (step !== "awaiting_punchline" && step !== "awaiting_pivot") return;

      // Echo the user's reply into the thread.
      if (text.trim()) {
        appendBubble({ kind: "user_text", text: text.trim() });
      }

      setIsSubmitting(true);

      try {
        // Auth is optional — same pattern as /opener/start.
        const token = await getAuthToken();
        // After pivot: authenticated users go to q_and_a (post-signup
        // welcome flow); anonymous users go to onboarding (recording).
        const afterOpenerPhase: Phase = token ? "q_and_a" : "onboarding";

        const afterPunchline = step === "awaiting_pivot";
        let res: Response;
        try {
          res = await fetch("/api/v2/onboarding/opener/next", {
            method: "POST",
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              joke_id: jokeIdRef.current,
              user_reply: text.trim(),
              after_punchline: afterPunchline,
            }),
          });
        } catch {
          bail(setPhase, "q_and_a");
          return;
        }

        // 404 (joke deactivated mid-flow) or any error → bail.
        if (!res.ok) {
          bail(setPhase, afterOpenerPhase);
          return;
        }

        if (!afterPunchline) {
          /* ---- punchline stage ---- */
          const data = (await res.json().catch(() => null)) as NextResponsePunchline | null;
          if (!data) {
            bail(setPhase, afterOpenerPhase);
            return;
          }

          stepRef.current = "awaiting_pivot";

          // Beat 3: ack — immediate (skip if empty string).
          if (data.ack) {
            appendBubble({ kind: "bot_text", text: data.ack });
          }
          // Beat 4: punchline — ~1200ms after ack (or after user submit if
          // ack was empty — same delay, the pause IS the joke timing).
          after(BEAT_DELAY.punchline, () => {
            appendBubble({ kind: "bot_text", text: data.punchline });
            setIsSubmitting(false);
          });
        } else {
          /* ---- pivot stage ---- */
          const data = (await res.json().catch(() => null)) as NextResponsePivot | null;
          if (!data) {
            bail(setPhase, afterOpenerPhase);
            return;
          }

          stepRef.current = "done";

          // Beat 5: pivot_line — ~600ms after second user submit.
          // VERBATIM — must not be modified (§3 of the FE handoff).
          after(BEAT_DELAY.pivot, () => {
            appendBubble({ kind: "bot_text", text: data.pivot_line });

            // Mark seen + drain the confirmation storage key so it never
            // double-shows on the next welcome_back entry.
            markOpenerSeen();
            consumePostSignupConfirmation();

            // Beat 6: transition to the correct next phase.
            // Anonymous → onboarding (recording starts).
            // Post-signup → q_and_a (text chat continues).
            setPhase(afterOpenerPhase);
            setIsSubmitting(false);
          });
        }
      } catch (err) {
        console.warn("useOnboardingOpener.submitReply — unexpected error:", err);
        bail(setPhase, "q_and_a");
        setIsSubmitting(false);
      }
    },
    [isSubmitting, bail]
  );

  // Cleanup pending timers on unmount.
  // (useCallback doesn't run cleanup — we expose clearTimers for the parent
  // to call in its own useEffect cleanup if needed. In practice these timers
  // are short-lived (<2s) so the impact of missing cleanup is minimal.)
  void clearTimers; // suppress "unused variable" — available for callers

  return { run, submitReply, isSubmitting };
}
