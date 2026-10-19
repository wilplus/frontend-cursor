// @vitest-environment jsdom
/*
STORY    As a speaker, I want a waiting moment to open on its feedback first,
         praise then judgement, or an exercise with Practise and Skip, so that
         I learn before I judge (the feedback step of the loop).
OUTCOME
  O1  A confident moment opens on its praise; Next (no Skip) then asks the
      judgement.
  O2  A moment that needed work opens on its exercise with Practise and
      Skip; no judgement is asked first.
  O3  The open is told to the backend with what was shown; a Skip is told
      and settles the moment unanswered (the host moves on with it).
PROVES   O1, O3 -> "a confident moment opens on its praise; Next asks the judgement"
         O2, O3 -> "a moment that needed work opens on its exercise with Practise and Skip; Skip settles it unanswered"
WHY      Contract 24e-1 (F1 Repair Plan Phase 6): judgement after feedback.
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OpenChunkSheet from "./OpenChunkSheet";
import { chunkStateFor, type DeckChunk } from "@/lib/willab/deckChunks";
import type { DocumentSuggestion } from "@/services/api/idealText";
import { fetchOwnerAnswers } from "@/services/api/bookmarkHistory";
import { forgetParagraphSheetData } from "./paragraphSheetData";
import { reportMomentEvent } from "@/services/api/momentEvents";

vi.mock("@/services/api/momentEvents", () => ({
  reportMomentEvent: vi.fn(async () => ({ kind: "recorded", followUp: "none" })),
}));

vi.mock("@/hooks/useVisibleLearningExposure", () => ({
  useVisibleLearningExposure: () => undefined,
}));
vi.mock("@/components/results/MediaPlayer", () => ({
  default: () => createElement("div"),
}));
vi.mock("@/services/api/takeFeedback", async (load) => {
  const actual = await load<typeof import("@/services/api/takeFeedback")>();
  return { ...actual, saveTakeFeedbackResponse: vi.fn(async () => ({ ok: true })) };
});
vi.mock("@/lib/api/auth-client", () => ({
  getAuthToken: vi.fn(async () => "test-token"),
}));
vi.mock("@/services/api/confidentVoicePractice", () => ({
  startConfidencePractice: vi.fn(async () => ({ ok: false, error: null })),
  uploadConfidencePracticeAttempt: vi.fn(async () => ({ ok: false, error: null })),
  fetchConfidencePractice: vi.fn(async () => ({ ok: false, error: null })),
}));
vi.mock("@/services/api/bookmarkHistory", () => ({
  fetchOwnerAnswers: vi.fn(async () => [
    { feedbackId: "s-cv", response: "not_sure" },
  ]),
  fetchParagraphHistory: vi.fn(async () => ({
    slideIndex: 0,
    versions: [
      { takeIndex: 1, paragraphs: ["We ship it."], at: null },
      { takeIndex: 2, paragraphs: [TEXT], at: null },
    ],
    helperWords: [{ phrases: ["ship it now"], at: null }],
    practice: [],
  })),
}));

const TEXT = "We should ship it now because the data is clear.";

const answered = {
  id: "s-cv",
  start: 0,
  end: 21,
  quote: "We should ship it now",
  kind: "advice",
  proposedText: null,
  device: null,
  status: "dismissed",
  feedbackFamily: "confident_voice",
  source: "confident_voice",
  snippetId: "snip-1",
  takeSessionId: "take-1",
  practiceExercise: { id: "ex-1", instruction: "Say it again, slower." },
  evidence: {
    projectId: "arc-1",
    takeSessionId: "take-1",
    slideIndex: 0,
    paragraphIndex: 0,
    start: 0,
    end: 21,
  },
} as unknown as DocumentSuggestion;

const praise = {
  id: "s-praise",
  start: 22,
  end: TEXT.length,
  quote: "because the data is clear",
  kind: "advice",
  proposedText: null,
  device: null,
  status: null,
  feedbackFamily: "great_formulation",
  praiseLine: "Plain and direct.",
} as unknown as DocumentSuggestion;

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  vi.mocked(reportMomentEvent).mockClear();
  vi.mocked(fetchOwnerAnswers).mockResolvedValue([]);
  forgetParagraphSheetData();
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function open(
  moment: DocumentSuggestion,
  notes: DocumentSuggestion[] = [],
  onPractise: (partId: string, card: unknown, moment: unknown) => boolean = vi.fn(() => true),
) {
  const onSkip = vi.fn();
  const items = [moment, ...notes];
  const s = chunkStateFor(
    {
      part: { id: "p1", text: TEXT, locked: false },
      paragraphIndex: 0, start: 0, end: TEXT.length, status: "waiting",
      pendingIds: items.map((i) => i.id), approvedIds: [], decidedIds: [],
    } as DeckChunk,
    { document: TEXT, suggestions: items },
  );
  await act(async () => {
    root.render(
      createElement(OpenChunkSheet, {
        state: s, arcId: "arc-1", takeSessionId: "take-1", headline: null,
        onClose: vi.fn(), onSkip, onPractise,
        renderSheet: () => createElement("div", { "data-testid": "judge" }),
      }),
    );
  });
  return { onSkip };
}

const ids = () =>
  Array.from(container.querySelectorAll("[data-testid^='paragraph-sheet-']"))
    .map((el) => el.getAttribute("data-testid"));

describe("judgement after feedback (24e-1)", () => {
  it("a confident moment opens on its praise; Next asks the judgement", async () => {
    const { onSkip } = await open(
      { ...answered, status: null, bookmarkTier: "confident" } as DocumentSuggestion,
      [praise],
    );
    expect(container.querySelector('[data-testid="practise-card"]')?.getAttribute("data-kind")).toBe("praise");
    expect(container.querySelector('[data-testid="praise-line"]')?.textContent).toBe("Plain and direct.");
    expect(container.querySelector('[data-testid="judge"]')).toBeNull();
    expect(ids()).not.toContain("paragraph-sheet-skip");
    expect(reportMomentEvent).toHaveBeenCalledWith("snip-1", "opened", ["praise"]);
    await act(async () =>
      (container.querySelector('[data-testid="paragraph-sheet-next"]') as HTMLButtonElement).click());
    expect(container.querySelector('[data-testid="judge"]')).not.toBeNull();
    expect(reportMomentEvent).not.toHaveBeenCalledWith("snip-1", "skipped");
    expect(onSkip).not.toHaveBeenCalled();
  });

  it("a moment that needed work opens on its exercise with Practise and Skip; Skip settles it unanswered", async () => {
    const { onSkip } = await open({ ...answered, status: null, bookmarkTier: "weak" } as DocumentSuggestion);
    expect(container.querySelector('[data-testid="practise-card"]')?.getAttribute("data-kind")).toBe("exercise");
    expect(ids()).toEqual(expect.arrayContaining(["paragraph-sheet-practise", "paragraph-sheet-skip"]));
    expect(container.querySelector('[data-testid="judgement-label"]')).toBeNull();
    expect(container.querySelector('[data-testid="judge"]')).toBeNull();
    expect(reportMomentEvent).toHaveBeenCalledWith("snip-1", "opened", ["exercise"]);
    await act(async () =>
      (container.querySelector('[data-testid="paragraph-sheet-skip"]') as HTMLButtonElement).click());
    expect(reportMomentEvent).toHaveBeenCalledWith("snip-1", "skipped");
    // Tap and go (founder 2026-10-05): the skipped moment rides along, so the
    // page settles its bar at once.
    expect(onSkip).toHaveBeenCalledWith(expect.objectContaining({ snippetId: "snip-1" }));
  });
});
