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

vi.mock("@/hooks/useVisibleLearningExposure", () => ({
  useVisibleLearningExposure: () => undefined,
}));
vi.mock("@/components/results/MediaPlayer", () => ({
  default: () => createElement("div", { "data-testid": "media-player" }),
}));
vi.mock("@/services/api/mlc3FirstClient", async (load) => {
  const actual = await load<typeof import("@/services/api/mlc3FirstClient")>();
  return { ...actual, mlc3FirstClientPresentationEnabled: () => false };
});
vi.mock("@/services/api/takeFeedback", () => ({
  saveTakeFeedbackResponse: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/api/auth-client", () => ({
  getAuthToken: vi.fn(async () => "test-token"),
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
  onLockIn: vi.fn(async () => ({ outcome: "ok" as const, rootPhraseProposal: null })),
  onKeepEvolving: vi.fn(async () => "ok" as const),
  onSetRootPhrase: vi.fn(noop),
  onClose: vi.fn(),
};

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
  return Array.from(container.querySelectorAll("button")).map(
    (b) => (b.textContent ?? b.getAttribute("aria-label") ?? "").trim(),
  );
}

async function render(initial: DocumentSuggestion) {
  await act(async () => {
    root.render(
      createElement(DeckChunkModal, {
        ...props,
        // The deck opens on the first of the chunk's pending ids; a test that
        // opens on another item puts that id first.
        state: chunkStateFor(
          {
            ...chunk(),
            pendingIds: [initial.id, ...inventory.filter((s) => s.id !== initial.id).map((s) => s.id)],
          },
          { document: TEXT, suggestions: inventory },
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

  it("the Confident Voice lane asks the one qualitative question, with words not numbers", async () => {
    const text = await render(confidentVoice);
    expect(text).toContain("Does this sound confident to you?");
    const labels = buttonLabels();
    for (const answer of ["Yes — Confident", "In-between", "No — Not confident", "Not sure", "Audio unclear"]) {
      expect(labels).toContain(answer);
    }
  });

  it("the rewrite lane shows the exact words and the clearer version, and keeps the user's wording available", async () => {
    const text = await render(rewrite);
    expect(text).toContain("What you said");
    expect(text).toContain(rewrite.quote);
    expect(text).toContain("Clearer version");
    expect(text).toContain(rewrite.proposedText!);
    const labels = buttonLabels();
    expect(labels).toContain("Apply suggestion");
    expect(labels).toContain("Edit myself");
    expect(labels).toContain("Keep wording");
  });

  it("the praise lane has nothing to decide: no Apply, no Keep wording", async () => {
    const text = await render(praise);
    expect(text).toContain(praise.quote);
    expect(text).toContain("You said this one really well.");
    const labels = buttonLabels();
    expect(labels).not.toContain("Apply suggestion");
    expect(labels).not.toContain("Keep wording");
    expect(labels).toContain("Useful");
  });

  it("every Manager lane is listed up front, capped at three (L2)", async () => {
    await render(confidentVoice);
    const labels = buttonLabels();
    expect(labels).toContain("1. Possible confident moment");
    expect(labels).toContain("2. Possible clarity improvement");
    expect(labels).toContain("3. Possible strong formulation");
    expect(labels.filter((l) => /^\d\. /.test(l))).toHaveLength(3);
  });

  it("a fourth candidate never becomes a fourth lane (L2 budget)", async () => {
    const extra = suggestion({ id: "s-4", feedbackFamily: "rewrite_clarity", kind: "replace", quote: "ship it now", proposedText: "ship it today" });
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
    expect(buttonLabels().filter((l) => /^\d\. /.test(l))).toHaveLength(3);
  });
});
