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
   * Default Q&A composer (text input). `showUpload` is the
   * per-turn paperclip-visibility flag from Rule G — true only
   * when the most-recent /v2/chat/query response carried
   * `show_upload_ui: true`.
   */
  | { kind: "qa_text"; showUpload: boolean }
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
  const { phase, bubbles, reviewLoadedForActiveSession, showUploadUi } = inputs;

  // Recording phases — ChatInterview owns the bottom row. Caller
  // should not render a toolbar in this case.
  if (RECORDING_PHASES.has(phase)) return { kind: "none" };

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
    hasAnySnippet;

  if (reviewReadyForPractice) return { kind: "practice_cta" };

  // Default for q_and_a + reviewing-with-pending-actions.
  return { kind: "qa_text", showUpload: showUploadUi };
}
