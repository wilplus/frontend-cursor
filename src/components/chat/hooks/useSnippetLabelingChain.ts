/**
 * `useSnippetLabelingChain` — owns the multi-step closer-out
 * chain that fires when the user picks Yes/No on a snippet:
 *
 *   1. POST /v2/user/snippets/<id>/label   `{label: boolean}`
 *   2. REPLACE action_pending with "Yes" / "No" user-text echo
 *   3. APPEND a typing bubble
 *   4. POST /v2/chat/snippet-followup     `{snippet_id, user_label}`
 *   5a. 200 + followup_text → REPLACE typing with bubble-split text
 *   5b. 5xx / empty → REPLACE typing with static FOLLOWUP_FALLBACK
 *   6+. continueAfterFollowup runs in both branches:
 *       - 500ms beat → "Thanks for that feedback!" bubble
 *       - POST /api/v2/coaching/intro-bubble → intro_text bubble
 *       - mark snippet closed-out (persist)
 *       - setRecordingReadyForSnippetId(id) — panel swaps to big mic
 *
 * Idempotency (spec C5): the closed-out check happens in the
 * reviewing-fetch hook — if the snippet was already in the set
 * when the page mounted, no action_pending bubble ever appeared,
 * so the chain is never reached. The closed-out Set is hydrated
 * from localStorage when `userId` lands and persisted via
 * `markClosedOut` after the intro bubble.
 *
 * Error handling per spec C4:
 *   - Label POST fail → rollback submitting; user can re-click.
 *   - Followup POST fail → label saved; soft FOLLOWUP_FALLBACK;
 *     closer still fires (continueAfterFollowup always runs after
 *     the followup bubble is rendered, regardless of branch).
 *
 * Cross-hook wiring: this hook depends on setters from three
 * other hooks (`setQaSubmitting` from `useQAComposer`,
 * `setRecordingReadyForSnippetId` + `setAwaitingAdminReview` from
 * `useRecordingHandoff`). React's setter stability makes this
 * free at runtime. The parent threads them through.
 *
 * Returns:
 *   - `handleSnippetLabel` — wired to the LabelButtonsSlot.
 *   - `closedOutSnippetIdsRef` — read by `useReviewingFetch` to
 *     skip snippets whose chain already ran.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import type { ThreadHandle } from "@/components/chat/thread/useThread";
import { botBubblesFromText } from "@/lib/chat/botBubbles";
import { computeLabelBool } from "@/lib/chat/snippetLabel";
import {
  loadClosedOutSnippets,
  markClosedOut,
} from "@/lib/chat/closedOutSnippets";

/**
 * EF-4 fallback shown in place of `followup_text` when
 * `/v2/chat/snippet-followup` returns 5xx or empty. The closer
 * chain (continueAfterFollowup) still runs after this — the user
 * sees the soft fallback line, then thanks + intro + recording-
 * ready, never gets stuck on a per-snippet network error.
 */
const FOLLOWUP_FALLBACK = "Noted — let's keep going.";

/**
 * Closer-out copy fired by `continueAfterFollowup` once the
 * follow-up bubble has landed. Hard-coded FE string per spec C2 —
 * no BE call.
 */
const CLOSER_THANKS = "Thanks for that feedback!";

/**
 * Static fallback rendered when `/api/v2/coaching/intro-bubble`
 * returns non-200. The backend itself keeps a static fallback per
 * its contract, so a non-200 means a real outage — give the user
 * a clean one-liner and still close out into recording_ready.
 */
const INTRO_BUBBLE_FALLBACK =
  "Let's record a fresh take. Tap the mic below when you're ready.";

/** Visual breathing room between the followup bubble and the
 *  closer "Thanks for that feedback!". Short enough that the
 *  sequence still feels brisk; long enough to read as a beat. */
const CLOSER_BEAT_MS = 500;

export interface UseSnippetLabelingChainParams {
  userId: string | null;
  /** Parent-owned shared ref: written by `revealNextSnippet` in
   *  `useReviewingFetch`, read+deleted by `handleSnippetLabel`. */
  actionBubbleInfoRef: MutableRefObject<
    Map<string, { bubbleId: string; snippetType: "charisma" | "stress" }>
  >;
  appendBubble: ThreadHandle["appendBubble"];
  updateBubble: ThreadHandle["updateBubble"];
  replaceBubble: ThreadHandle["replaceBubble"];
  /** From `useQAComposer` — locked across the closer chain so the
   *  user can't type/submit while the multi-bubble sequence is in
   *  flight (matrix LI-4a/LI-4b). */
  setQaSubmitting: (v: boolean) => void;
  /** From `useRecordingHandoff` — flipped to the labeled snippet's
   *  id once the closer chain ends, mounting the big-mic panel. */
  setRecordingReadyForSnippetId: (id: string | null) => void;
  /** From `useRecordingHandoff` — defensively cleared before the
   *  panel swap in case the user re-entered after a successful
   *  upload AND a new snippet got labeled in the same session. */
  setAwaitingAdminReview: (v: boolean) => void;
}

export interface UseSnippetLabelingChainReturn {
  handleSnippetLabel: (snippetId: string, answer: "yes" | "no") => Promise<void>;
  /** Read by `useReviewingFetch` to skip closed-out snippets on
   *  re-fetch. Owned here because the labeling chain is the
   *  writer; the reviewing fetch is read-only. */
  closedOutSnippetIdsRef: MutableRefObject<Set<string>>;
}

export function useSnippetLabelingChain({
  userId,
  actionBubbleInfoRef,
  appendBubble,
  updateBubble,
  replaceBubble,
  setQaSubmitting,
  setRecordingReadyForSnippetId,
  setAwaitingAdminReview,
}: UseSnippetLabelingChainParams): UseSnippetLabelingChainReturn {
  /**
   * Snippet-label closer-out tracking (spec C5). Each snippet whose
   * full chain — Y/N → label → followup → thanks → intro — has
   * fired ends up in this Set, persisted per-user via localStorage.
   * Re-mounting the page (client nav back from /dashboard, hard
   * reload) re-hydrates this and skips snippet-queue entries that
   * already closed out, so the auto-bubbles don't replay.
   */
  const [closedOutSnippetIds, setClosedOutSnippetIds] = useState<Set<string>>(
    () => new Set()
  );
  // Ref mirror so async closures inside `handleSnippetLabel` /
  // reviewing fetch read the latest set without re-creating
  // callbacks every time the state changes.
  const closedOutSnippetIdsRef = useRef<Set<string>>(closedOutSnippetIds);
  useEffect(() => {
    closedOutSnippetIdsRef.current = closedOutSnippetIds;
  }, [closedOutSnippetIds]);

  // Hydrate the closed-out Set from localStorage when userId lands.
  // Per-user key so two accounts on one browser don't bleed each
  // other's lists. No-op when anonymous.
  useEffect(() => {
    if (!userId) return;
    setClosedOutSnippetIds(loadClosedOutSnippets(userId));
  }, [userId]);

  /**
   * Steps 7-10 of the snippet-label chain — auto-fires AFTER the
   * follow-up bubble lands, regardless of whether the BE returned
   * real `followup_text` (5a) or we rendered the EF-4 static
   * FOLLOWUP_FALLBACK (5b). Sequence:
   *
   *   500ms beat → "Thanks for that feedback!" bubble
   *              → POST /api/v2/coaching/intro-bubble
   *              → intro_text bubble (or static FE fallback)
   *              → mark snippet closed-out (persist)
   *              → setRecordingReadyForSnippetId(id) — panel swaps to big mic
   *
   * Idempotency (C5): the closed-out check happens in the reviewing-
   * fetch effect, not here — if the snippet was already in the set
   * when the page mounted, no action_pending bubble ever appeared,
   * so this function is never reached.
   */
  const continueAfterFollowup = useCallback(
    async (snippetId: string) => {
      // Closer beat — give the followup bubble visual breathing room.
      await new Promise((resolve) => setTimeout(resolve, CLOSER_BEAT_MS));

      for (const b of botBubblesFromText(CLOSER_THANKS)) appendBubble(b);

      // BE call for the personalized intro line. Per spec C3, the
      // BE itself keeps a static fallback so a 200 is the normal
      // case even on its internal LLM failure; a non-200 from this
      // route is a real outage and the FE has its own one-liner.
      let introText = INTRO_BUBBLE_FALLBACK;
      try {
        const res = await fetch("/api/v2/coaching/intro-bubble", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ snippet_id: snippetId }),
        });
        if (res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            intro_text?: string;
          };
          if (typeof data.intro_text === "string" && data.intro_text.trim()) {
            introText = data.intro_text.trim();
          }
        }
      } catch (err) {
        console.warn("chat.intro_bubble_post_failed surface=fe", err);
      }
      for (const b of botBubblesFromText(introText)) appendBubble(b);

      // Persist closed-out before flipping recording-ready so a
      // mid-render re-mount (which can happen on React StrictMode
      // double-effect in dev) doesn't replay the chain. The
      // snippet id rides through the toolbar via
      // `recordingReadyForSnippetId` so the multipart upload
      // attaches to the right context.
      setClosedOutSnippetIds((prev) =>
        markClosedOut(userId, prev, snippetId)
      );
      setRecordingReadyForSnippetId(snippetId);
      // Defensive: a fresh closer chain should not start in the
      // post-upload idle state. Reset awaitingAdminReview in case
      // the user re-entered the chat after a successful upload AND
      // a new snippet got labeled in the same session.
      setAwaitingAdminReview(false);
    },
    [
      appendBubble,
      userId,
      setRecordingReadyForSnippetId,
      setAwaitingAdminReview,
    ]
  );

  /* ---------------------------------------------------------------------- */
  /*  Snippet-label resolution (Yes/No flow + closer-out chain)             */
  /*                                                                          */
  /*  Per the BE contract:                                                  */
  /*    1. POST /api/v2/user/snippets/<id>/label   `{ label: boolean }`    */
  /*    2. REPLACE action_pending with "Yes" / "No" user-text echo         */
  /*    3. APPEND a typing bubble                                          */
  /*    4. POST /api/v2/chat/snippet-followup     `{snippet_id, user_label}`*/
  /*    5a. 200 + followup_text → REPLACE typing with bubble-split text   */
  /*    5b. 5xx / empty → REPLACE typing with static FOLLOWUP_FALLBACK    */
  /*    6+. continueAfterFollowup runs in both branches — thanks bubble,   */
  /*        intro-bubble POST, recording_ready transition. The closer     */
  /*        chain is the ONLY post-follow-up exit; the user does not      */
  /*        reply to the followup in this surface.                         */
  /*                                                                          */
  /*  Error handling per spec C4:                                           */
  /*    - Label POST fail → rollback submitting; user can re-click.        */
  /*    - Followup POST fail → label saved; soft FOLLOWUP_FALLBACK;       */
  /*      closer still fires (continueAfterFollowup always runs after the */
  /*      followup bubble is rendered, regardless of branch).             */
  /* ---------------------------------------------------------------------- */
  const handleSnippetLabel = useCallback(
    async (snippetId: string, answer: "yes" | "no") => {
      const info = actionBubbleInfoRef.current.get(snippetId);
      if (!info) return;
      const { bubbleId, snippetType } = info;

      // Canonical bool — see `computeLabelBool` for the truth table.
      const labelBool = computeLabelBool(snippetType, answer);
      // User-text echo is just their literal Yes/No — keeps the
      // thread readable without leaking the charisma/stress framing
      // into the user's voice.
      const echoText = answer === "yes" ? "Yes" : "No";

      // qaSubmitting locks the composer across the entire chain
      // (matrix LI-4a/LI-4b). Reset in every terminal branch below.
      updateBubble(bubbleId, { submitting: true });
      setQaSubmitting(true);

      // Step 1 — record the user_charisma_label boolean.
      let labelOk = false;
      try {
        const res = await fetch(
          `/api/v2/user/snippets/${encodeURIComponent(snippetId)}/label`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ label: labelBool }),
          }
        );
        labelOk = res.ok;
      } catch (err) {
        console.warn("snippet_label.post_failed surface=fe", err);
      }
      if (!labelOk) {
        // Rollback per spec C4: nothing committed to the thread,
        // bubble returns to clickable state, user can retry.
        updateBubble(bubbleId, { submitting: false });
        setQaSubmitting(false);
        return;
      }

      // Step 2 — user-text echo of the Yes/No pick.
      replaceBubble(bubbleId, { kind: "user_text", text: echoText });
      actionBubbleInfoRef.current.delete(snippetId);

      // Step 3 — typing bubble while the followup roundtrip is in flight.
      const typingId = appendBubble({ kind: "typing" });

      // Step 4 — POST /v2/chat/snippet-followup with the same bool.
      let followup = "";
      try {
        const res = await fetch("/api/v2/chat/snippet-followup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            snippet_id: snippetId,
            user_label: labelBool,
          }),
        });
        if (res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            followup_text?: string;
            debug?: { user_label_interpretation?: string };
          };
          // Dev-only contract guard (probe v1 FE-04). The matrix
          // pin in docs/PANEL-STATE-MATRIX.md fixes the semantic
          // backend uses for `user_label_interpretation`. If
          // backend ever flips it without coordinating, log loud
          // so engineering can update both sides.
          if (process.env.NODE_ENV !== "production") {
            const interpretation = data.debug?.user_label_interpretation;
            if (
              typeof interpretation === "string" &&
              interpretation !== "agreement"
            ) {
              console.warn(
                `snippet_followup.contract_violation surface=fe ` +
                  `debug_field=user_label_interpretation ` +
                  `got="${interpretation}" expected=agreement`
              );
            }
          }
          if (typeof data.followup_text === "string") {
            followup = data.followup_text.trim();
          }
        }
      } catch (err) {
        console.warn("snippet_followup.post_failed surface=fe", err);
      }

      // 5a (happy) vs 5b (EF-4 fallback) — same shape: render the
      // followup bubble (real text or fallback) then advance through
      // the closer chain. The closer auto-fires regardless of branch.
      const followupBubbles = botBubblesFromText(
        followup || FOLLOWUP_FALLBACK
      );
      replaceBubble(typingId, followupBubbles);
      setQaSubmitting(false);
      // Closer chain runs after the followup paint. We don't await
      // here so the user sees the followup bubble immediately;
      // continueAfterFollowup's own 500ms beat handles the cadence.
      void continueAfterFollowup(snippetId);
    },
    [
      actionBubbleInfoRef,
      updateBubble,
      replaceBubble,
      appendBubble,
      setQaSubmitting,
      continueAfterFollowup,
    ]
  );

  return {
    handleSnippetLabel,
    closedOutSnippetIdsRef,
  };
}
