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

const useWords = vi.fn(async (_span: { text: string }) => true);
const closeSheet = vi.fn();

function render(s = state()) {
  return act(async () => {
    root.render(
      createElement(OpenChunkSheet, {
        state: s,
        arcId: "arc-1",
        takeSessionId: "take-1",
        headline: "ship it now",
        onUseHelperWords: useWords,
        onClose: closeSheet,
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
            onSetRootPhrase: vi.fn(async () => true),
            onClose: vi.fn(),
          }),
      }),
    );
  });
}

describe("the answered bookmark", () => {
  it("opens on one screen: helper words and now, exercise, answer, one timeline", async () => {
    await render();
    const sheet = container.querySelector('[data-testid="paragraph-sheet"]');
    expect(sheet).not.toBeNull();
    const text = sheet?.textContent ?? "";
    const now = container.querySelector('[data-testid="paragraph-now"]')?.textContent ?? "";
    expect(now).toContain("Helper words");
    expect(now).toContain("ship it now");
    expect(now).toContain(TEXT);
    expect(text).toContain("Say it again, slower.");
    expect(text).toContain("You said: Not sure");
    expect(text).toContain("How this changed");
    expect(text.indexOf("Take 2")).toBeLessThan(text.indexOf("Take 1"));
    expect(text).not.toMatch(/\d+\s*%|\bscore\b/i);
  });

  it("the helper words are not a button on a paragraph that is not locked", async () => {
    await render();
    const words = container.querySelector<HTMLButtonElement>(
      '[data-testid="paragraph-helper-words"]',
    );
    expect(words?.disabled).toBe(true);
  });

  it("Practise opens the judgement sheet on its exercise step", async () => {
    await render();
    const practise = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Practise",
    );
    await act(async () => practise?.click());
    expect(container.querySelector('[data-testid="paragraph-sheet"]')).toBeNull();
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
            headline: null,
            onClose: vi.fn(),
            renderSheet: () => createElement("div", { "data-testid": "judge" }),
          }),
        );
      });
    await renderWith(make(pending, [], [pending.id]));
    await renderWith(make(answered, [answered.id], []));
    expect(container.querySelector('[data-testid="judge"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="paragraph-sheet"]')).toBeNull();
  });
});

describe("a locked paragraph chooses new helper words (Q27 B)", () => {
  function lockedState() {
    return chunkStateFor(
      {
        part: { id: "p1", text: TEXT, locked: true },
        paragraphIndex: 0,
        start: 0,
        end: TEXT.length,
        status: "locked",
        pendingIds: [],
        approvedIds: [],
        decidedIds: [],
      } as DeckChunk,
      { document: TEXT, suggestions: [] },
    );
  }

  it("opens the sheet on a locked paragraph with nothing answered", async () => {
    await render(lockedState());
    expect(container.querySelector('[data-testid="paragraph-sheet"]')).not.toBeNull();
  });

  it("tapping the helper words opens the picker with nothing selected; Use this phrase locks them", async () => {
    useWords.mockClear();
    closeSheet.mockClear();
    await render(lockedState());
    await act(async () =>
      container
        .querySelector<HTMLButtonElement>('[data-testid="paragraph-helper-words"]')
        ?.click(),
    );
    const sheet = container.querySelector('[data-testid="paragraph-sheet"]');
    expect(sheet?.textContent).toContain("Choose your helper words");
    expect(sheet?.textContent).toContain("ship it now");
    const pill = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Use this phrase",
    );
    expect(pill?.disabled).toBe(true);
    const tokens = container.querySelectorAll('[data-testid="picker-tokens"] button');
    expect(Array.from(tokens).some((t) => t.getAttribute("aria-pressed") === "true")).toBe(false);
    const word = Array.from(tokens).find((t) => t.textContent === "data");
    await act(async () => (word as HTMLButtonElement).click());
    expect(pill?.disabled).toBe(false);
    await act(async () => pill?.click());
    expect(useWords).toHaveBeenCalledTimes(1);
    expect(useWords.mock.calls[0][0].text).toBe("data");
    expect(closeSheet).toHaveBeenCalled();
  });
});
