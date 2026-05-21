import { describe, expect, it } from "vitest";
import { deriveToolbar, type ToolbarInputs } from "./toolbar";
import type { Bubble } from "./types";

/**
 * Tests cover the rows in docs/PANEL-STATE-MATRIX.md that involve
 * the non-recording surface's bottom-toolbar slot. Recording-phase
 * rows (LO-1..3, LI-7, RA-1..3) collapse to `{ kind: "none" }`
 * because deriveToolbar's scope is the parent's slot — ChatInterview
 * owns the bottom row in recording mode.
 *
 * Each test names the matrix row it backstops; if a row's spec
 * changes, the test name's reference identifies the test to update.
 */

const bubble = {
  bot_text: (text = "hi"): Bubble => ({
    id: "b1",
    kind: "bot_text",
    text,
  }),
  user_text: (text = "hello"): Bubble => ({
    id: "u1",
    kind: "user_text",
    text,
  }),
  snippet: (id = "s1"): Bubble => ({
    id: `snip-${id}`,
    kind: "snippet",
    data: {
      id,
      type: "charisma",
      badgeLabel: "Charisma Highlight",
      insight: "test",
      audioUrl: null,
      startOffsetMs: 0,
      durationMs: 0,
    },
  }),
  actionPending: (snippetId = "s1"): Bubble => ({
    id: `act-${snippetId}`,
    kind: "action_pending",
    snippetId,
    snippetType: "charisma",
    submitting: false,
  }),
  dashboard: (): Bubble => ({
    id: "d1",
    kind: "dashboard",
    data: { trinity: { power: 0.5, warmth: 0.5, presence: 0.5 } },
  }),
};

function baseInputs(overrides: Partial<ToolbarInputs> = {}): ToolbarInputs {
  return {
    phase: "q_and_a",
    bubbles: [],
    reviewLoadedForActiveSession: false,
    showUploadUi: false,
    pendingFollowUp: false,
    ...overrides,
  };
}

describe("deriveToolbar — non-recording surface", () => {
  it("LI-2: pending-greeting q_and_a → composer (default voice-first control)", () => {
    const result = deriveToolbar(
      baseInputs({
        phase: "q_and_a",
        bubbles: [bubble.bot_text("Your charisma snippets haven't arrived…")],
      })
    );
    expect(result).toEqual({ kind: "composer", showUpload: false });
  });

  it("LI-2 (paperclip on): composer carries inline showUpload=true (Rule G)", () => {
    const result = deriveToolbar(
      baseInputs({ phase: "q_and_a", showUploadUi: true })
    );
    expect(result).toEqual({ kind: "composer", showUpload: true });
  });

  it("LI-3a: reviewing, fetch not landed → composer (no practice CTA yet)", () => {
    const result = deriveToolbar(
      baseInputs({
        phase: "reviewing",
        reviewLoadedForActiveSession: false,
        bubbles: [bubble.bot_text()],
      })
    );
    expect(result).toEqual({ kind: "composer", showUpload: false });
  });

  it("LI-3b: reviewing, snippet + action_pending → label_buttons (composer hidden)", () => {
    const result = deriveToolbar(
      baseInputs({
        phase: "reviewing",
        reviewLoadedForActiveSession: true,
        bubbles: [bubble.snippet("s1"), bubble.actionPending("s1")],
      })
    );
    expect(result).toEqual({
      kind: "label_buttons",
      snippetId: "s1",
      snippetType: "charisma",
    });
  });

  it("LI-3b: label_buttons carries the LATEST action_pending (defensive tail-scan)", () => {
    // If the thread somehow holds two action_pendings (network blip
    // resurrected an old one) deriveToolbar picks the most recent —
    // the one the user is actually expected to answer right now.
    const result = deriveToolbar(
      baseInputs({
        phase: "reviewing",
        reviewLoadedForActiveSession: true,
        bubbles: [
          bubble.snippet("s1"),
          bubble.actionPending("s1"),
          bubble.snippet("s2"),
          bubble.actionPending("s2"),
        ],
      })
    );
    expect(result).toEqual({
      kind: "label_buttons",
      snippetId: "s2",
      snippetType: "charisma",
    });
  });

  it("LI-4a → LI-5: action replaced by user_text echo + pendingFollowUp → composer (mic returns)", () => {
    // The action_pending has been replaced by the user-text echo;
    // pendingFollowUp blocks practice_cta. Composer is back so the
    // user can text-or-voice their reply to the AI's follow-up.
    const result = deriveToolbar(
      baseInputs({
        phase: "reviewing",
        reviewLoadedForActiveSession: true,
        pendingFollowUp: true,
        bubbles: [
          bubble.snippet("s1"),
          bubble.user_text("Charisma"),
          bubble.bot_text("Nice — what made you sure?"),
        ],
      })
    );
    expect(result).toEqual({ kind: "composer", showUpload: false });
  });

  it("LI-5: reviewing, all snippets resolved → practice_cta", () => {
    const result = deriveToolbar(
      baseInputs({
        phase: "reviewing",
        reviewLoadedForActiveSession: true,
        bubbles: [
          bubble.dashboard(),
          bubble.snippet("s1"),
          bubble.user_text("YES, this is Charisma"),
          bubble.snippet("s2"),
          bubble.user_text("NO, this is Stress"),
        ],
      })
    );
    expect(result).toEqual({ kind: "practice_cta" });
  });

  it("LI-5 guard: snippet 1 still pending → label_buttons (NOT practice_cta)", () => {
    const result = deriveToolbar(
      baseInputs({
        phase: "reviewing",
        reviewLoadedForActiveSession: true,
        bubbles: [
          bubble.snippet("s1"),
          bubble.actionPending("s1"),
          bubble.snippet("s2"),
          bubble.user_text("YES, this is Charisma"),
        ],
      })
    );
    expect(result).toEqual({
      kind: "label_buttons",
      snippetId: "s1",
      snippetType: "charisma",
    });
  });

  it("LI-9: welcome_back → none (read-only window)", () => {
    const result = deriveToolbar(
      baseInputs({
        phase: "welcome_back",
        bubbles: [bubble.bot_text("Thanks, check your email…")],
      })
    );
    expect(result).toEqual({ kind: "none" });
  });

  it("LI-10: post-welcome q_and_a → composer", () => {
    const result = deriveToolbar(
      baseInputs({ phase: "q_and_a" })
    );
    expect(result).toEqual({ kind: "composer", showUpload: false });
  });

  it("LI-4c: followup_text landed, pendingFollowUp → composer (NOT practice_cta yet)", () => {
    // No action_pending in the thread (the last one was just replaced
    // with the user-text echo). All other practice_cta gates pass.
    // pendingFollowUp blocks the CTA so the user can text-or-voice reply.
    const result = deriveToolbar(
      baseInputs({
        phase: "reviewing",
        reviewLoadedForActiveSession: true,
        pendingFollowUp: true,
        bubbles: [
          bubble.snippet("s1"),
          bubble.user_text("YES, this is Charisma"),
          bubble.bot_text("Nice — what made you confident on that?"),
        ],
      })
    );
    expect(result).toEqual({ kind: "composer", showUpload: false });
  });

  it("LI-4d: user replied to followup, queue drained → practice_cta", () => {
    const result = deriveToolbar(
      baseInputs({
        phase: "reviewing",
        reviewLoadedForActiveSession: true,
        pendingFollowUp: false,
        bubbles: [
          bubble.snippet("s1"),
          bubble.user_text("YES, this is Charisma"),
          bubble.bot_text("Nice — what made you confident on that?"),
          bubble.user_text("Felt natural to me."),
          bubble.bot_text("Let's look at the next moment."),
        ],
      })
    );
    expect(result).toEqual({ kind: "practice_cta" });
  });

  it("paperclip + pendingFollowUp coexist: composer carries both signals", () => {
    // Inline paperclip pattern (post FE-3): showUpload is just a
    // sub-field of the composer mode, not a competing slot. When
    // both signals are true we get an inline paperclip alongside
    // the still-mounted composer that's awaiting the followup
    // reply. Test guards against accidentally re-introducing a
    // slot-replacing upload mode.
    const result = deriveToolbar(
      baseInputs({
        phase: "q_and_a",
        showUploadUi: true,
        pendingFollowUp: true,
      })
    );
    expect(result).toEqual({ kind: "composer", showUpload: true });
  });

  it("EF-1: reviewing, zero snippets fetched → composer (NOT practice_cta)", () => {
    // No snippet bubbles in the thread; only the "no snippets came through"
    // bot bubble. The has-any-snippet guard prevents the CTA from showing.
    const result = deriveToolbar(
      baseInputs({
        phase: "reviewing",
        reviewLoadedForActiveSession: true,
        bubbles: [bubble.bot_text("No snippets came through…")],
      })
    );
    expect(result).toEqual({ kind: "composer", showUpload: false });
  });
});

describe("deriveToolbar — recording phases yield none", () => {
  it.each([
    ["LO-1/LI-1: onboarding", "onboarding"],
    ["LO-3: compiling", "compiling"],
    ["LO-4: metrics_ask", "metrics_ask"],
    ["LI-7: roleplaying", "roleplaying"],
  ] as const)("%s → none", (_label, phase) => {
    const result = deriveToolbar(baseInputs({ phase }));
    expect(result).toEqual({ kind: "none" });
  });
});

describe("deriveToolbar — non-render phases yield none", () => {
  it.each([
    ["loading"],
    ["error"],
  ] as const)("%s → none", (phase) => {
    const result = deriveToolbar(baseInputs({ phase }));
    expect(result).toEqual({ kind: "none" });
  });
});

describe("deriveToolbar — TX-1 thread-persists transition", () => {
  // Acceptance criterion from the matrix: after FE Prompt 1 lifts
  // the thread, reviewing → roleplaying keeps the bubble array
  // intact. deriveToolbar itself sees only the phase change; the
  // bubbles array stays the same instance the parent passes in.
  // We assert that the same bubbles array under phase=roleplaying
  // collapses the toolbar to `none` (so ChatInterview can take
  // over the bottom row) WITHOUT throwing or special-casing the
  // legacy snippet bubbles.
  it("preserved bubbles + phase=roleplaying → none (no crash on legacy bubbles)", () => {
    const persistedThread = [
      bubble.dashboard(),
      bubble.snippet("s1"),
      bubble.user_text("YES, this is Charisma"),
      bubble.snippet("s2"),
      bubble.user_text("NO, this is Stress"),
    ];
    const result = deriveToolbar(
      baseInputs({
        phase: "roleplaying",
        reviewLoadedForActiveSession: true,
        bubbles: persistedThread,
      })
    );
    expect(result).toEqual({ kind: "none" });
  });
});
