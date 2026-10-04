// @vitest-environment jsdom
/* JUDGEMENT AFTER FEEDBACK (contract 24e-1; F1 Repair Plan Phase 6): a
   waiting moment opens on its feedback. A confident moment shows its praise
   and Next asks the judgement; a moment that needed work shows its card with
   Practise and Skip. The open and a skip are told to the backend. */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OpenChunkSheet, { asJudgement } from "./OpenChunkSheet";
import DeckChunkModal from "./DeckChunkModal";
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
vi.mock("@/services/api/mlc3FirstClient", async (load) => {
  const actual = await load<typeof import("@/services/api/mlc3FirstClient")>();
  return { ...actual, mlc3FirstClientPresentationEnabled: false };
});
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
  finishConfidencePractice: vi.fn(async () => ({ ok: false, error: null })),
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

function state() {
  return chunkStateFor(
    {
      part: { id: "p1", text: TEXT, locked: false },
      paragraphIndex: 0,
      start: 0,
      end: TEXT.length,
      status: "clean",
      pendingIds: [],
      approvedIds: [],
      decidedIds: [answered.id],
    } as DeckChunk,
    { document: TEXT, suggestions: [answered] },
  );
}

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

const praiseNote = {
  id: "s-pr", start: 0, end: 21, quote: "We should ship it now",
  kind: "advice", feedbackFamily: "great_formulation", source: "great_formulation",
  status: null, snippetId: "snip-1", takeSessionId: "take-1",
} as unknown as DocumentSuggestion;

async function open(
  moment: DocumentSuggestion,
  notes: DocumentSuggestion[] = [],
  practiseHost: { onLockIn: () => Promise<never>; onHelperWordsSaved: () => void } | null = null,
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
        onClose: vi.fn(), onSkip, practiseHost,
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
    await open({ ...answered, status: null, bookmarkTier: "confident" } as DocumentSuggestion, [praiseNote]);
    expect(container.querySelector('[data-testid="judge"]')).toBeNull();
    expect(container.querySelector('[data-testid="practise-card"]')?.getAttribute("data-kind")).toBe("praise");
    expect(ids()).toContain("paragraph-sheet-next");
    expect(reportMomentEvent).toHaveBeenCalledWith("snip-1", "opened", ["praise"]);
    await act(async () =>
      (container.querySelector('[data-testid="paragraph-sheet-next"]') as HTMLButtonElement).click());
    expect(container.querySelector('[data-testid="judge"]')).not.toBeNull();
  });

  it("a moment that needed work opens on its exercise with Practise and Skip; Skip settles it unanswered", async () => {
    const { onSkip } = await open({ ...answered, status: null, bookmarkTier: "weak" } as DocumentSuggestion);
    expect(container.querySelector('[data-testid="practise-card"]')?.getAttribute("data-kind")).toBe("exercise");
    expect(ids()).toEqual(expect.arrayContaining(["paragraph-sheet-practise", "paragraph-sheet-skip"]));
    expect(container.querySelector('[data-testid="judgement-label"]')).toBeNull();
    await act(async () =>
      (container.querySelector('[data-testid="paragraph-sheet-skip"]') as HTMLButtonElement).click());
    expect(reportMomentEvent).toHaveBeenCalledWith("snip-1", "skipped");
    expect(onSkip).toHaveBeenCalled();
  });

  it("the open is told once", async () => {
    await open({ ...answered, status: null, bookmarkTier: "weak" } as DocumentSuggestion);
    await open({ ...answered, status: null, bookmarkTier: "weak" } as DocumentSuggestion);
    expect(vi.mocked(reportMomentEvent).mock.calls.filter((c) => c[1] === "opened")).toHaveLength(1);
  });

  it("Practise opens the card shown, a library exercise included", async () => {
    const library = {
      ...answered, status: null, bookmarkTier: "weak",
      practiceExercise: { ...(answered as DocumentSuggestion).practiceExercise, chosenByCoach: false },
    } as DocumentSuggestion;
    await open(library, [], { onLockIn: vi.fn(), onHelperWordsSaved: vi.fn() });
    expect(container.querySelector('[data-testid="practise-card"]')?.getAttribute("data-kind")).toBe("exercise");
    await act(async () =>
      (container.querySelector('[data-testid="paragraph-sheet-practise"]') as HTMLButtonElement).click());
    expect(container.querySelector('[data-testid="practise-sheet"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="judge"]')).toBeNull();
  });

  it("Next before the judgement reads Next, also on the last moment", async () => {
    await open({ ...answered, status: null, bookmarkTier: "confident" } as DocumentSuggestion, [praiseNote]);
    expect(container.querySelector('[data-testid="paragraph-sheet-next"]')?.textContent).toBe("Next");
  });
});
