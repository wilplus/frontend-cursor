// @vitest-environment jsdom
/* The answered bookmark (founder 2026-09-25, Q19 A): an answered paragraph
   opens its history on one screen; Practise hands back to the judgement
   sheet on its exercise step. */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OpenChunkSheet, { asJudgement } from "./OpenChunkSheet";
import DeckChunkModal from "./DeckChunkModal";
import { chunkStateFor, type DeckChunk } from "@/lib/willab/deckChunks";
import type { DocumentSuggestion } from "@/services/api/idealText";

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
vi.mock("@/services/api/takeFeedback", () => ({
  saveTakeFeedbackResponse: vi.fn(async () => ({ ok: true })),
}));
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
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

function render() {
  const s = state();
  return act(async () => {
    root.render(
      createElement(OpenChunkSheet, {
        state: s,
        arcId: "arc-1",
        takeSessionId: "take-1",
        onClose: vi.fn(),
        renderSheet: (practiseAgain) =>
          createElement(DeckChunkModal, {
            state: s,
            practiseAgain,
            onAccept: vi.fn(async () => true),
            onKeepMine: vi.fn(async () => true),
            onLockIn: vi.fn(async () => ({
              outcome: "ok" as const,
              rootPhraseProposal: null,
            })),
            onKeepEvolving: vi.fn(async () => "ok" as const),
            onSetRootPhrase: vi.fn(async () => true),
            onClose: vi.fn(),
          }),
      }),
    );
  });
}

describe("the answered bookmark", () => {
  it("opens on the history: exercise, answer, versions, helper words", async () => {
    await render();
    const sheet = container.querySelector('[data-testid="answered-bookmark"]');
    expect(sheet).not.toBeNull();
    const text = sheet?.textContent ?? "";
    expect(text).toContain("Say it again, slower.");
    expect(text).toContain("You said: Not sure");
    expect(text).toContain("How this changed");
    expect(text.indexOf("Take 2")).toBeLessThan(text.indexOf("Take 1"));
    expect(text).toContain("Helper words");
    expect(text).toContain("ship it now");
    expect(text).not.toMatch(/\d+\s*%|\bscore\b/i);
  });

  it("Practise opens the judgement sheet on its exercise step", async () => {
    await render();
    const practise = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Practise",
    );
    await act(async () => practise?.click());
    expect(container.querySelector('[data-testid="answered-bookmark"]')).toBeNull();
    expect(
      container.querySelector('[data-testid="practice-offer"]'),
    ).not.toBeNull();
  });

  it("carries only the five answers into the sheet", () => {
    expect(asJudgement("in_between")).toBe("in_between");
    expect(asJudgement("apply_suggestion")).toBeNull();
    expect(asJudgement(null)).toBeNull();
  });
});

describe("the sheet is chosen once, when it opens", () => {
  it("answering inside the judgement sheet does not swap it for the history", async () => {
    const pending = { ...answered, status: null } as DocumentSuggestion;
    const make = (item: DocumentSuggestion, decided: string[], waiting: string[]) =>
      chunkStateFor(
        {
          part: { id: "p1", text: TEXT, locked: false },
          paragraphIndex: 0,
          start: 0,
          end: TEXT.length,
          status: "waiting",
          pendingIds: waiting,
          approvedIds: [],
          decidedIds: decided,
        } as DeckChunk,
        { document: TEXT, suggestions: [item] },
      );
    const renderWith = (s: ReturnType<typeof make>) =>
      act(async () => {
        root.render(
          createElement(OpenChunkSheet, {
            state: s,
            arcId: "arc-1",
            takeSessionId: "take-1",
            onClose: vi.fn(),
            renderSheet: () => createElement("div", { "data-testid": "judge" }),
          }),
        );
      });
    await renderWith(make(pending, [], [pending.id]));
    await renderWith(make(answered, [answered.id], []));
    expect(container.querySelector('[data-testid="judge"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="answered-bookmark"]')).toBeNull();
  });
});
