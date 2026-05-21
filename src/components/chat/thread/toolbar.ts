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
   * take. Click handler in the page flips `phase` to `roleplaying`
   * which mounts the existing ChatInterview recording surface (the
   * `/v2/coaching/trial-recording` flow). Distinct from the small
   * Lounge mic that lives inside `composer`.
   */
  | { kind: "recording_ready" }
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
   * True between snippet-followup landing and the user replying.
   * Blocks `practice_cta` — even when no action_pending remains,
   * the user owes a reply to the followup question and the
   * composer must stay mounted. Caller resets this once the
   * reply is handled (and the next snippet, if any, has been
   * revealed). Matrix rows LI-4c / LI-4d.
   */
  pendingFollowUp: boolean;
  /**
   * True once the snippet-label closer chain has finished (the
   * intro bubble landed) and the user is one tap away from
   * recording a fresh take. Highest-precedence panel mode while
   * set — wins over composer / label_buttons / practice_cta. The
   * page resets it to false when the user actually taps the big
   * mic (transition to phase=roleplaying handles that).
   */
  recordingReady: boolean;
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
    pendingFollowUp,
    recordingReady,
  } = inputs;

  // Recording phases — ChatInterview owns the bottom row. Caller
  // should not render a toolbar in this case.
  if (RECORDING_PHASES.has(phase)) return { kind: "none" };

  // Recording-ready primer wins over every other non-recording
  // mode. The closer-out chain (thanks → intro) has terminated and
  // we want a single, deliberate big-mic affordance — not a
  // composer, not action buttons, not the practice CTA. The page
  // only sets this flag in reviewing-adjacent phases.
  if (recordingReady && !RECORDING_PHASES.has(phase)) {
    return { kind: "recording_ready" };
  }

  // Loading/error/welcome_back render no toolbar:
  //   loading & error: the parent's body is a centered message.
  //   welcome_back: the two welcome bubbles are read-only for
  //     ~400ms before the q_and_a transition mounts the composer.
  if (TOOLBAR_LESS_PHASES.has(phase)) return { kind: "none" };

  // Practice CTA precedence — reviewing phase, fetch landed,
  // every snippet bubble has been paired with a user-text echo
  // (i.e. no `action_pending` remains in the thread), and at
  // least one snippet actually showed up. The "at least one
  // snippet" guard prevents the CTA from appearing in the
  // zero-snippet edge case (EF-1) where the user would
  // otherwise see a Start-practice button against an empty
  // analysis.
  const hasPendingAction = bubbles.some((b) => b.kind === "action_pending");
  const hasAnySnippet = bubbles.some((b) => b.kind === "snippet");
  const reviewReadyForPractice =
    phase === "reviewing" &&
    reviewLoadedForActiveSession &&
    !hasPendingAction &&
    hasAnySnippet &&
    !pendingFollowUp;

  if (reviewReadyForPractice) return { kind: "practice_cta" };

  // Snippet labeling slot — when an action_pending bubble is the
  // currently active labeling prompt, the panel renders the binary
  // Charisma/Stress buttons + the composer is hidden. Lookup is
  // "latest action_pending in the thread"; the one before any
  // followup that's already been answered. We don't need to
  // distinguish "labeled but followup not yet replied" because
  // pendingFollowUp gates that case (no action_pending exists at
  // that moment — it was replaced by the user_text echo on label).
  if (phase === "reviewing" && hasPendingAction) {
    // Scan from the tail so a stale unresolved bubble (e.g. a
    // network blip mid-label) doesn't shadow a fresh one. There
    // should normally be exactly one active action_pending at a
    // time per the serial-reveal contract, but the tail-scan is
    // defensive.
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

  // Default — composer (text input + optional small mic). Inline
  // paperclip is gated on `showUploadUi` per Rule G.
  return { kind: "composer", showUpload: showUploadUi };
}
