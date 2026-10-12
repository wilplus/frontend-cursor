// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  F1 surface net (audit Q-T8, Phase 2) — the per-slide review modal.         */
/*                                                                            */
/*  Renders the REAL component with fixture payloads and asserts two things   */
/*  the source-grep fences could not:                                         */
/*    1. AC-9 as behaviour: nothing that reads as a score, ratio, percentage  */
/*       or verdict appears in the rendered text, for every feedback family,  */
/*       including when the fixture carries numeric-looking fields.           */
/*    2. The three Manager lanes each render their own face: Confident Voice  */
/*       (the agree question), the actionable rewrite (Accept / Keep mine),   */
/*       and evidence-backed praise (nothing to decide).                      */
/* -------------------------------------------------------------------------- */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DeckChunkModal from "./DeckChunkModal";
import { chunkStateFor, type DeckChunk } from "@/lib/willab/deckChunks";
import type { DocumentSuggestion } from "@/services/api/idealText";
import type { RootPhraseSpan } from "@/services/api/partLock";
import type { BehindOutcome } from "./saveBehind";
import { PRAISE_LEAD } from "@/lib/willab/trackedChangeWhy";

// Personalised practice is on unless a test turns it off.
const practice = vi.hoisted(() => ({ offered: true }));
vi.mock("@/services/api/consentChoices", () => ({
  practiseOfferedNow: () => practice.offered,
  readPractiseOffered: async () => practice.offered,
}));

vi.mock("@/hooks/useVisibleLearningExposure", () => ({
  useVisibleLearningExposure: () => undefined,
}));
vi.mock("@/components/results/MediaPlayer", () => ({
  default: () => createElement("div", { "data-testid": "media-player" }),
}));
/* ConfidentVoicePractice is gone (§3) — the exercise is a STEP now, drawn by
   the sheet, so there is nothing to mock. The real offer card carries the
   data-testid the practice assertions look for. */
/* No MLC-3 mock any more: the speaker sheet's service lane, and the
   NEXT_PUBLIC_MLC3_SERVICE_UI_ENABLED flag that switched it, were removed
   with the retired loop (founder 2026-09-30, L8; contract 66; audit ML-15).
   The path these tests pin is now the only path. */
vi.mock("@/services/api/takeFeedback", async (load) => {
  const actual = await load<typeof import("@/services/api/takeFeedback")>();
  return { ...actual, saveTakeFeedbackResponse: vi.fn(async () => ({ ok: true })) };
});
vi.mock("@/lib/api/auth-client", () => ({
  getAuthToken: vi.fn(async () => "test-token"),
}));
/* The practice ROW, not the practice screens. "Not now" asks the server to
   open a row so it can close it; with nothing opened the hook takes its
   "nothing to close" branch and reports a closed practice with no judgement —
   which is the exact path the regression below is about. Mocked rather than
   left to a bare fetch so the branch is chosen deliberately instead of by
   whatever jsdom does with an unmocked network call. */
vi.mock("@/services/api/confidentVoicePractice", () => ({
  // The refusal shape, not null: the hook reads `result.ok`. A row that never
  // opened is the honest case here and it is the one the offer screen starts
  // from, before anything has been recorded.
  startConfidencePractice: vi.fn(async () => ({ ok: false, error: null })),
  uploadConfidencePracticeAttempt: vi.fn(async () => ({ ok: false, error: null })),
  fetchConfidencePractice: vi.fn(async () => ({ ok: false, error: null })),
}));

const TEXT =
  "We should ship it now because the data is clear and the team is ready.";

function suggestion(over: Partial<DocumentSuggestion>): DocumentSuggestion {
  return {
    id: "s-base",
    start: 0,
    end: 22,
    quote: "We should ship it now",
    kind: "advice",
    proposedText: null,
    device: null,
    ...over,
  } as DocumentSuggestion;
}

const confidentVoice = suggestion({
  id: "s-cv",
  feedbackFamily: "confident_voice",
  source: "confident_voice",
  snippetId: "snip-1",
  takeSessionId: "take-1",
  tentative: true,
  // numeric-looking fields a careless render might print
  confidence: 0.83,
  score: 7,
} as Partial<DocumentSuggestion>);

const rewrite = suggestion({
  id: "s-rw",
  feedbackFamily: "rewrite_clarity",
  kind: "replace",
  start: 23,
  end: 47,
  quote: "because the data is clear",
  proposedText: "because the numbers back it",
  takeSessionId: "take-1",
});

const praise = suggestion({
  id: "s-pr",
  feedbackFamily: "great_formulation",
  device: "impeccable",
  start: 52,
  end: 70,
  quote: "the team is ready",
  cueKeys: ["steady_pace"],
  takeSessionId: "take-1",
} as Partial<DocumentSuggestion>);

const inventory = [confidentVoice, rewrite, praise];

function chunk(): DeckChunk {
  return {
    part: { id: "p1", text: TEXT, locked: false },
    paragraphIndex: 0,
    start: 0,
    end: TEXT.length,
    status: "waiting",
    pendingIds: inventory.map((s) => s.id),
    approvedIds: [],
  } as DeckChunk;
}

const noop = async () => true;
const props = {
  onAccept: vi.fn(noop),
  onKeepMine: vi.fn(noop),
  onJudged: vi.fn(),
  // Typed so the mock records its argument, for the same reason
  // onSetRootPhrase is: the bold-on-tap test reads the TEXT that was locked,
  // not merely that a lock happened.
  onLockIn: vi.fn(async (_text: string) => ({
    outcome: "ok" as const,
    rootPhraseProposal: null,
  })),
  // Typed so the mock records its argument: the promotion test needs to read
  // the span that was stored, not merely that something was.
  onSetRootPhrase: vi.fn(async (_phrase: RootPhraseSpan | null) => true),
  onClose: vi.fn(),
  // Tap and go (founder 2026-09-28): the host runs the writes the sheet no
  // longer waits for. The spy runs each one and keeps what it came to.
  saveBehind: vi.fn((task: () => Promise<BehindOutcome>, failText: string) => {
    behind.push({ failText, done: task() });
  }),
};
const behind: { failText: string; done: Promise<BehindOutcome> }[] = [];

/** AC-9: what a user must never read on this surface. */
const SCORE_LIKE = [
  /\b\d+(\.\d+)?\s*%/, // 83%
  /\b\d+\s*\/\s*\d+\b/, // 7/10
  /\b\d\.\d{2}\b/, // 0.83
  /\bscore\b/i,
  /\bverdict\b/i,
  /\bconfidence (level|index|rating)\b/i,
  /\bclassif/i,
];

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

function buttonLabels(): string[] {
  // Text first, then aria-label — an icon-only button (the Edit myself pencil)
  // has an EMPTY textContent, not a null one, so `??` would never reach the
  // label and the decision would read as unnamed.
  return Array.from(container.querySelectorAll("button")).map((b) => {
    const text = (b.textContent ?? "").trim();
    return text || (b.getAttribute("aria-label") ?? "").trim();
  });
}

/** Click the button carrying exactly this label, and flush what it starts.
 *
 *  The sheet's TITLE is itself a button (it doubles as the drag grabber), so
 *  on the lock step there are two elements reading "Lock" and the naive match
 *  hits the grabber — which toggles the detent and decides nothing. Skipping
 *  the grabber is the difference between testing the pill and testing the
 *  sheet's height.
 */
async function click(label: string) {
  const button = Array.from(container.querySelectorAll("button")).find(
    (b) =>
      (b.textContent ?? "").trim() === label &&
      !b.hasAttribute("data-sheet-grabber"),
  );
  if (!button) throw new Error(`no button labelled "${label}"`);
  await act(async () => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

/** Open the sheet on ONE lane.
 *
 *  Since 2026-09-15 the ladder sorts confidence to the front whatever the
 *  payload order, so seeding the whole inventory and expecting to land on the
 *  rewrite screen no longer works — and should not. A per-lane test therefore
 *  hands the sheet exactly the item it is about; ordering has its own test
 *  below, with the whole inventory. */
async function render(initial: DocumentSuggestion) {
  await act(async () => {
    root.render(
      createElement(DeckChunkModal, {
        ...props,
        state: chunkStateFor(
          { ...chunk(), pendingIds: [initial.id] } as DeckChunk,
          { document: TEXT, suggestions: [initial] },
        ),
      }),
    );
  });
  return container.textContent ?? "";
}

describe("DeckChunkModal — F1 net", () => {
  it.each([
    ["confident voice", confidentVoice],
    ["rewrite", rewrite],
    ["praise", praise],
  ])("AC-9: the %s face renders no score, ratio, percentage or verdict", async (_name, item) => {
    const text = await render(item);
    expect(text.length).toBeGreaterThan(20);
    for (const pattern of SCORE_LIKE) {
      expect(text, `matched ${pattern}`).not.toMatch(pattern);
    }
  });

  it("the rewrite lane shows the exact words and the clearer version, and keeps the user's wording available", async () => {
    const text = await render(rewrite);
    expect(text).toContain("What you said");
    expect(text).toContain(rewrite.quote);
    expect(text).toContain("Clearer version");
    expect(text).toContain(rewrite.proposedText!);
    const labels = buttonLabels();
    // One pill, the verb of this screen, and the decline as a link. No pencil
    // on the card (Final Screens, founder 2026-09-29).
    expect(labels).toContain("Apply");
    expect(labels).not.toContain("Edit myself");
    expect(labels).toContain("Keep my wording");
    // Never two buttons side by side: the decline is a grey link under the
    // pill, and there is no third competing action.
    expect(labels).not.toContain("Apply suggestion");
  });

  it("a fourth candidate is never reachable, however far you walk (L2 budget)", async () => {
    const extra = suggestion({
      id: "s-4",
      feedbackFamily: "rewrite_clarity",
      kind: "replace",
      quote: "ship it now",
      // Distinctive on purpose: if the cap leaks, this string shows up.
      proposedText: "FOURTH-LANE-SHOULD-BE-UNREACHABLE",
      takeSessionId: "take-1",
    });
    await act(async () => {
      root.render(
        createElement(DeckChunkModal, {
          ...props,
          state: {
            ...chunkStateFor(
              { ...chunk(), pendingIds: [...inventory, extra].map((s) => s.id) } as DeckChunk,
              { document: TEXT, suggestions: [...inventory, extra] },
            ),
            // Past the model's own cap on purpose: the modal must cap too.
            pending: [...inventory, extra],
          },
        }),
      );
    });

    // Walk the whole ladder by deciding whatever is on screen. The walk
    // doubles as proof that the queue advances on its own, which is the only
    // route between steps now.
    const decided: string[] = [];
    for (let step = 0; step < 6; step += 1) {
      const text = container.textContent ?? "";
      if (text.includes("Does this sound confident to you?")) {
        decided.push("confident_voice");
        // Answering IS the decision — no Done step behind it (2026-09-15).
        await click("Yes");
      } else if (text.includes("Clearer version")) {
        decided.push("rewrite_clarity");
        await click("Keep my wording");
      } else if (text.includes(PRAISE_LEAD)) {
        decided.push("great_formulation");
        await click("Next");
      } else {
        break;
      }
    }

    expect(decided).toEqual([
      "confident_voice",
      "rewrite_clarity",
      "great_formulation",
    ]);
    expect(container.textContent).not.toContain(
      "FOURTH-LANE-SHOULD-BE-UNREACHABLE",
    );
  });

  it("reports the judgement to the host the moment it is saved (24g-1)", async () => {
    // Founder 2026-09-21: "the state of the text didn't change and the
    // bookmark stayed there … it must be happening on the blink of an eye
    // level". Accept and Keep mine already flip the row on the host; the
    // Confident Voice answer never told the host anything, so the mark
    // stayed lit until the next refetch. A Yes reads "approved" — the
    // ladder stays open — and every other answer reads "dismissed", which is
    // exactly what the server serves for that row from then on.
    const judged = vi.mocked(props.onJudged);
    judged.mockClear();

    await render(confidentVoice);
    await click("Yes");
    expect(judged).toHaveBeenCalledTimes(1);
    expect(judged.mock.calls[0][0].id).toBe(confidentVoice.id);
    expect(judged.mock.calls[0][1]).toBe("approved");
  });

  it("never carries one clip's answer onto the next clip (L3)", async () => {
    // The Confident Voice answer is per ITEM. When it did not reset on
    // advance, a second confident-voice item on the same chunk opened already
    // answered — thank-you copy over a clip nobody rated — and since Done
    // posts `agreeValue ?? "not_sure"`, tapping it filed the PREVIOUS clip's
    // owner answer against this one. That is a provenance breach, not a
    // cosmetic slip. Ordinary under the V3 policy, which returns one Confident
    // Voice item per 75-word block, not one per Take.
    const second = suggestion({
      id: "s-cv2",
      feedbackFamily: "confident_voice",
      source: "confident_voice",
      snippetId: "snip-2",
      takeSessionId: "take-1",
      start: 52,
      end: 70,
      quote: "the team is ready",
    } as Partial<DocumentSuggestion>);
    const pair = [confidentVoice, second];
    await act(async () => {
      root.render(
        createElement(DeckChunkModal, {
          ...props,
          state: chunkStateFor(
            { ...chunk(), pendingIds: pair.map((s) => s.id) } as DeckChunk,
            { document: TEXT, suggestions: pair },
          ),
        }),
      );
    });

    const { saveTakeFeedbackResponse } = await import(
      "@/services/api/takeFeedback"
    );
    const saved = vi.mocked(saveTakeFeedbackResponse);
    saved.mockClear();

    // One tap: the answer saves and advances, with no Done step between.
    await click("Yes");

    // The second item must be ASKING, not thanking.
    expect(container.textContent).toContain("Does this sound confident to you?");
    expect(buttonLabels()).toContain("Yes");

    // And nothing may have been filed against the second clip yet. Every write
    // so far belongs to the clip the speaker actually rated.
    const ratedIds = saved.mock.calls.map(([arg]) => arg.feedbackId);
    expect(ratedIds).not.toContain(second.id);
    expect(new Set(ratedIds)).toEqual(new Set([confidentVoice.id]));
  });
});
