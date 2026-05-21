/**
 * `deriveToolbar` — pure function that maps the /chat surface's
 * observable state to the bottom-toolbar slot mode. Lives in its
 * own file because (a) it has unit tests covering every row in
 * `docs/PANEL-STATE-MATRIX.md` and (b) keeping it out of the
 * React component file makes the test imports trivially clean
 * (no "use client" leakage, no JSX, no React deps).
 *
 * Scope note: this helper is responsible for the NON-RECORDING
 * surface only — `welcome_back`, `q_and_a`, and `reviewing`. The
 * recording phases (`onboarding`, `compiling`, `metrics_ask`,
 * `roleplaying`) manage their own toolbar inside `ChatInterview`
 * today; the function returns `{ kind: "none" }` for them so the
 * caller knows to defer to ChatInterview's bottom-row rendering.
 * Phase 1b will lift the recording toolbar out and let
 * `deriveToolbar` own it too.
 */
import type { Bubble, Phase } from "@/components/chat/thread/types";

export type ToolbarMode =
  /**
   * The parent surface owns no toolbar this phase — either it's
   * a non-rendering phase (loading, error) or a recording phase
   * where ChatInterview draws its own bottom row.
   */
  | { kind: "none" }
  /**
   * Default control on the non-recording surface — the chat input
   * bar: text field, optional small mic (only when Web Speech +
   * MediaRecorder are both supported), and send button. The mic
   * opens a dual-capture session (Web Speech transcript visible
   * in the input + raw audio streamed to MediaRecorder for silent
   * acoustic analysis on the backend); typing only is the C1 JSON
   * fallback. See `ChatInputBar` for the rendered widget.
   *
   * `showUpload` is Rule G's per-turn paperclip flag — when true
   * the composer renders an inline paperclip affordance next to
   * the send button. Inline rather than slot-replacing because
   * the composer stays mounted continuously (typing/voicing a
   * question and attaching a file aren't mutually exclusive UX).
   */
  | { kind: "composer"; showUpload: boolean }
  /**
   * Snippet-label binary — Charisma vs Stress, rendered as two
   * panel-level buttons. While in this mode the composer (mic +
   * text input) is HIDDEN, not just disabled (matrix C-LI-4): the
   * user shouldn't be able to accidentally type or record while
   * the label decision is pending. `snippetId` + `snippetType`
   * route the click through to the parent's `handleSnippetLabel`
   * via the toolbar render path, same handler the inline-bubble
   * path used previously. Switches back to `composer` the moment
   * the snippet-followup landing replaces the action_pending
   * bubble with the user_text echo.
   */
  | {
      kind: "label_buttons";
      snippetId: string;
      snippetType: "charisma" | "stress";
    }
  /**
   * Big-mic primer — closer-out sequence done (label → followup →
   * thanks → intro), user is one tap away from recording a fresh
   * take. The panel renders the canonical `VoiceRecordButton`
   * (same big-mic visual used in onboarding) wired to multipart-
   * upload to `/api/v2/user/chat/upload-answer` with
   * `source_snippet_id`. Distinct from the small Lounge mic that
   * lives inside `composer`.
   */
  | { kind: "recording_ready"; snippetId: string }
  /**
   * Practice CTA — all snippets in the reviewing thread have
   * been resolved (no action_pending bubbles remain), so the
   * user is ready to hand off into the 120s roleplay.
   */
  | { kind: "practice_cta" };

export interface ToolbarInputs {
  phase: Phase;
  /** Current bubble array from `useThread`. */
  bubbles: Bubble[];
  /**
   * True iff the reviewing-phase fetch has landed for the
   * currently active session. Wires through from the parent's
   * `reviewLoadedRef.current === activeSessionId` check —
   * pulled out as a bool so this function stays pure and
   * doesn't need to know about refs or session ids.
   */
  reviewLoadedForActiveSession: boolean;
  /**
   * Per-turn paperclip flag (Rule G). Passed through unchanged
   * to the qa_text mode.
   */
  showUploadUi: boolean;
  /**
   * Snippet id whose closer chain just finished — drives the
   * `recording_ready` panel mode. Null = not in recording-ready
   * state. Set by `continueAfterFollowup` after the intro bubble
   * lands; reset to null when the multipart upload completes (and
   * `awaitingAdminReview` takes over) or when the user navigates
   * to a recording phase. Carries the snippet id explicitly so the
   * upload payload knows which snippet it's attaching to.
   */
  recordingReadyForSnippetId: string | null;
  /**
   * True between a successful post-labeling upload and the next
   * admin publish landing in the thread. Renders no toolbar — the
   * user is supposed to wait, not chat. Cleared when a new
   * action_pending bubble is revealed (a fresh snippet is ready
   * to label).
   */
  awaitingAdminReview: boolean;
}

const RECORDING_PHASES: ReadonlySet<Phase> = new Set<Phase>([
  "onboarding",
  "compiling",
  "metrics_ask",
  "roleplaying",
]);

const TOOLBAR_LESS_PHASES: ReadonlySet<Phase> = new Set<Phase>([
  "loading",
  "error",
  "welcome_back",
]);

export function deriveToolbar(inputs: ToolbarInputs): ToolbarMode {
  const {
    phase,
    bubbles,
    reviewLoadedForActiveSession,
    showUploadUi,
    recordingReadyForSnippetId,
    awaitingAdminReview,
  } = inputs;

  // Recording phases — ChatInterview owns the bottom row. Caller
  // should not render a toolbar in this case.
  if (RECORDING_PHASES.has(phase)) return { kind: "none" };

  // Loading/error/welcome_back render no toolbar:
  //   loading & error: the parent's body is a centered message.
  //   welcome_back: the two welcome bubbles are read-only for
  //     ~400ms before the q_and_a transition mounts the composer.
  if (TOOLBAR_LESS_PHASES.has(phase)) return { kind: "none" };

  // label_buttons takes precedence over awaitingAdminReview /
  // recording_ready: a freshly-revealed action_pending bubble means
  // the admin published a new snippet, ending the wait state. The
  // tail-scan picks the LATEST action_pending so a stale one (from
  // a re-fetched session, network-blip resurrection) doesn't shadow
  // a fresh one.
  if (phase === "reviewing") {
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      if (b.kind === "action_pending") {
        return {
          kind: "label_buttons",
          snippetId: b.snippetId,
          snippetType: b.snippetType,
        };
      }
    }
  }

  // After a successful post-labeling upload the user sits idle
  // until the admin publishes again. No toolbar — input is
  // intentionally blocked (matrix C-LI-2 "no further user input
  // until the admin publishes").
  if (awaitingAdminReview) return { kind: "none" };

  // Recording-ready primer — closer-out chain done, big mic ready
  // for the user's fresh take. The snippet id rides through so the
  // multipart upload knows what to attach to.
  if (recordingReadyForSnippetId) {
    return {
      kind: "recording_ready",
      snippetId: recordingReadyForSnippetId,
    };
  }

  // Practice CTA precedence — reviewing phase, fetch landed,
  // every snippet bubble has been paired with a user-text echo
  // (i.e. no `action_pending` remains in the thread), and at
  // least one snippet actually showed up. The "at least one
  // snippet" guard prevents the CTA from appearing in the
  // zero-snippet edge case (EF-1) where the user would
  // otherwise see a Start-practice button against an empty
  // analysis. With the closer-out chain (PR #19) the
  // `recording_ready` mode usually takes over before this
  // fallback fires — practice_cta survives as a safety net for
  // sessions where the closer chain didn't run (e.g. all
  // snippets already labeled on a prior mount).
  const hasPendingAction = bubbles.some((b) => b.kind === "action_pending");
  const hasAnySnippet = bubbles.some((b) => b.kind === "snippet");
  const reviewReadyForPractice =
    phase === "reviewing" &&
    reviewLoadedForActiveSession &&
    !hasPendingAction &&
    hasAnySnippet;

  if (reviewReadyForPractice) return { kind: "practice_cta" };

  // Default — composer (text input + optional small mic). Inline
  // paperclip is gated on `showUploadUi` per Rule G. The
  // label_buttons / awaiting / recording_ready precedence above
  // means we only land here for q_and_a / reviewing where no
  // labeling chain is active.
  return { kind: "composer", showUpload: showUploadUi };
}
