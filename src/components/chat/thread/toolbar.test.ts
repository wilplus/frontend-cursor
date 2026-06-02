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
    showUploadUi: false,
    recordingReadyForSnippetId: null,
    awaitingAdminReview: false,
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

  it("LI-3a: reviewing, no action_pending yet → composer", () => {
    const result = deriveToolbar(
      baseInputs({
        phase: "reviewing",
        bubbles: [bubble.bot_text()],
      })
    );
    expect(result).toEqual({ kind: "composer", showUpload: false });
  });

  it("LI-3b: reviewing, snippet + action_pending → label_buttons (composer hidden)", () => {
    const result = deriveToolbar(
      baseInputs({
        phase: "reviewing",
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

  it("LI-5 guard: snippet 1 still pending → label_buttons (latest action_pending wins)", () => {
    const result = deriveToolbar(
      baseInputs({
        phase: "reviewing",
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

  it("T2: opening phase → opener_mic (big mic captures the dad-joke voice reply)", () => {
    const result = deriveToolbar(
      baseInputs({
        phase: "opening",
        bubbles: [bubble.bot_text("Attention, before we begin…")],
      })
    );
    expect(result).toEqual({ kind: "opener_mic" });
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

  it("EF-1: reviewing, zero snippets fetched → composer (chat stays open)", () => {
    // No snippet bubbles in the thread; only the "no snippets came through"
    // bot bubble. User can keep chatting via the composer; no terminal CTA.
    const result = deriveToolbar(
      baseInputs({
        phase: "reviewing",
        bubbles: [bubble.bot_text("No snippets came through…")],
      })
    );
    expect(result).toEqual({ kind: "composer", showUpload: false });
  });
});

describe("deriveToolbar — recording_ready (snippet closer chain done)", () => {
  it("recordingReadyForSnippetId set in reviewing → recording_ready (wins over composer)", () => {
    const result = deriveToolbar(
      baseInputs({
        phase: "reviewing",
        recordingReadyForSnippetId: "s1",
        bubbles: [
          bubble.snippet("s1"),
          bubble.user_text("Yes"),
          bubble.bot_text("Nice — what made you sure?"),
          bubble.bot_text("Thanks for that feedback!"),
          bubble.bot_text("Let's record a fresh take."),
        ],
      })
    );
    expect(result).toEqual({
      kind: "recording_ready",
      snippetId: "s1",
    });
  });

  it("recordingReadyForSnippetId wins even with showUploadUi (Rule G yields)", () => {
    // Rule G's per-turn paperclip flag does NOT trump the
    // intentional terminal big-mic affordance.
    const result = deriveToolbar(
      baseInputs({
        phase: "q_and_a",
        recordingReadyForSnippetId: "s1",
        showUploadUi: true,
      })
    );
    expect(result).toEqual({
      kind: "recording_ready",
      snippetId: "s1",
    });
  });

  it("recordingReadyForSnippetId in a recording phase → none (ChatInterview owns)", () => {
    const result = deriveToolbar(
      baseInputs({
        phase: "roleplaying",
        recordingReadyForSnippetId: "s1",
      })
    );
    expect(result).toEqual({ kind: "none" });
  });

  it("label_buttons wins over recording_ready when a NEW action_pending lands", () => {
    // Admin re-publishes a new snippet WHILE the user is in the
    // recording-ready state (haven't tapped yet). The new
    // action_pending bubble appears → label_buttons takes the
    // slot. The user gets to label the new snippet first; the
    // big-mic state will return after THAT snippet's closer chain.
    const result = deriveToolbar(
      baseInputs({
        phase: "reviewing",
        recordingReadyForSnippetId: "s1",
        bubbles: [
          bubble.snippet("s1"),
          bubble.user_text("Yes"),
          bubble.bot_text("Thanks for that feedback!"),
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

  it("awaitingAdminReview = true → none (post-upload idle, input blocked)", () => {
    // After the multipart upload completes, the user waits for
    // the admin to publish. No composer, no big mic, no label
    // buttons — until a new snippet lands (label_buttons takes
    // over) or the user navigates away.
    const result = deriveToolbar(
      baseInputs({
        phase: "reviewing",
        awaitingAdminReview: true,
        bubbles: [
          bubble.snippet("s1"),
          bubble.user_text("Yes"),
          bubble.bot_text("Got it. Your coach is reviewing your new recording…"),
        ],
      })
    );
    expect(result).toEqual({ kind: "none" });
  });

  it("label_buttons wins over awaitingAdminReview when a fresh snippet lands", () => {
    // Admin publishes a NEW snippet while the user is in the
    // post-upload wait state → new action_pending breaks the
    // idle, panel flips back to label_buttons for the new
    // snippet.
    const result = deriveToolbar(
      baseInputs({
        phase: "reviewing",
        awaitingAdminReview: true,
        bubbles: [
          bubble.snippet("s1"),
          bubble.user_text("Yes"),
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
        bubbles: persistedThread,
      })
    );
    expect(result).toEqual({ kind: "none" });
  });
});
