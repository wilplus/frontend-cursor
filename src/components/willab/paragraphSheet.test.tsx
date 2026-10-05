// @vitest-environment jsdom
/* The paragraph overlay (founder lock 2026-09-30, B5, B8, D6, D7, Q1): two
   states, the practise state and the saved state, never the paragraph
   text; Practise hands back to the judgement sheet on its exercise step,
   and an answer in the judgement sheet hands the paragraph to its own
   sheet. */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OpenChunkSheet, { asJudgement } from "./OpenChunkSheet";
import DeckChunkModal from "./DeckChunkModal";
import { chunkStateFor, type DeckChunk } from "@/lib/willab/deckChunks";
import type { DocumentSuggestion } from "@/services/api/idealText";
import { fetchOwnerAnswers } from "@/services/api/bookmarkHistory";
import { forgetParagraphSheetData } from "./paragraphSheetData";

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

describe("the paragraph overlay, saved state (founder lock 2026-09-30, B8, D6)", () => {
  it("shows the helper words, the player and History, never the paragraph text, and one black button", async () => {
    await render(); // the fixture's headline is "ship it now"
    const sheet = container.querySelector('[data-testid="paragraph-sheet"]');
    expect(sheet).not.toBeNull();
    expect(sheet?.querySelector("h2")?.textContent).toBe("Helper words saved");
    const saved = container.querySelector('[data-testid="overlay-saved"]');
    expect(saved).not.toBeNull();
    const helper = container.querySelector('[data-testid="paragraph-helper-card"]')?.textContent ?? "";
    expect(helper).toContain("Helper words");
    expect(helper).toContain("ship it now");
    // No judgement, no practise card (B8), no paragraph text (D6).
    expect(container.querySelector('[data-testid="judgement-label"]')).toBeNull();
    expect(container.querySelector('[data-testid="practise-card"]')).toBeNull();
    expect(sheet?.textContent).not.toContain(TEXT);
    // One collapsed History row (Q1), earlier Takes as single rows.
    const history = container.querySelector('[data-testid="paragraph-history"]');
    expect(history?.textContent).toContain("History");
    expect(history?.textContent).toContain("Take 1");
    expect(history?.textContent).not.toContain("Take 2");
    expect(sheet?.textContent).not.toMatch(/\d+\s*%|\bscore\b/i);
    // Outside the walk the one black button reads Next too (N48.3 Q8 A, D10).
    const next = sheet?.querySelector('[data-testid="paragraph-sheet-next"]') as HTMLButtonElement;
    expect(next.textContent).toBe("Next");
    await act(async () => next.click());
    expect(closeSheet).toHaveBeenCalled();
  });

  it("in the walk, the header is the slide and the black button is Next, which moves the walk on", async () => {
    const onNext = vi.fn();
    const onDone = vi.fn();
    await act(async () => {
      root.render(
        createElement(OpenChunkSheet, {
          state: state(),
          arcId: "arc-1",
          takeSessionId: "take-1",
          headline: "ship it now",
          onUseHelperWords: useWords,
          onClose: closeSheet,
          onDone,
          slideLabel: "Slide 2",
          pager: { index: 0, total: 3, label: "Slide 2", onBack: vi.fn(), onNext },
          renderSheet: () => null,
        }),
      );
    });
    const sheet = container.querySelector('[data-testid="paragraph-sheet"]') as HTMLElement;
    const nav = sheet.querySelector('[data-testid="feedback-pager"]') as HTMLElement;
    expect(nav.textContent).toContain("Slide 2");
    expect(nav.textContent).not.toContain("moment");
    const next = sheet.querySelector('[data-testid="paragraph-sheet-next"]') as HTMLButtonElement;
    expect(next.textContent).toBe("Next");
    await act(async () => next.click());
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("outside the walk, the slide alone heads the sheet", async () => {
    await act(async () => {
      root.render(
        createElement(OpenChunkSheet, {
          state: state(),
          arcId: "arc-1",
          takeSessionId: "take-1",
          headline: "ship it now",
          onUseHelperWords: useWords,
          onClose: closeSheet,
          slideLabel: "Slide 2",
          renderSheet: () => null,
        }),
      );
    });
    const sheet = container.querySelector('[data-testid="paragraph-sheet"]') as HTMLElement;
    expect(sheet.querySelector('[data-testid="paragraph-sheet-slide"]')?.textContent).toBe("Slide 2");
    expect(sheet.querySelector('[data-testid="feedback-pager"]')).toBeNull();
  });

  it("carries only the five answers into the sheet", () => {
    expect(asJudgement("in_between")).toBe("in_between");
    expect(asJudgement("apply_suggestion")).toBeNull();
    expect(asJudgement(null)).toBeNull();
  });
});

describe("the paragraph overlay, practise state (founder lock 2026-09-30, B5, D1, D7)", () => {
  const renderOpen = (answer: string, over: Partial<DocumentSuggestion> = {}) =>
    act(async () => {
      const item = { ...answered, ...over } as DocumentSuggestion;
      const s = chunkStateFor(
        {
          part: { id: "p1", text: TEXT, locked: false },
          paragraphIndex: 0,
          start: 0,
          end: TEXT.length,
          status: "clean",
          pendingIds: [],
          approvedIds: [],
          decidedIds: [item.id],
        } as DeckChunk,
        { document: TEXT, suggestions: [item] },
      );
      root.render(
        createElement(OpenChunkSheet, {
          state: s,
          arcId: "arc-1",
          takeSessionId: "take-1",
          headline: null,
          onUseHelperWords: useWords,
          onClose: closeSheet,
          renderSheet: (practiseAgain) =>
            createElement(DeckChunkModal, {
              state: s,
              practiseAgain,
              onAccept: vi.fn(async () => true),
              onKeepMine: vi.fn(async () => true),
              onLockIn: vi.fn(async () => ({ outcome: "ok" as const, rootPhraseProposal: null })),
              onSetRootPhrase: vi.fn(async () => true),
              onClose: vi.fn(),
            }),
        }),
      );
    });
  const withAnswer = async (answer: string, over: Partial<DocumentSuggestion> = {}) => {
    vi.mocked(fetchOwnerAnswers).mockResolvedValue([{ feedbackId: "s-cv", response: answer }]);
    forgetParagraphSheetData();
    await renderOpen(answer, over);
  };
  const labels = () =>
    Array.from(container.querySelectorAll("button")).map((b) => b.textContent?.trim());

  it("Not sure: a yellow label, the exercise as the card with its video, Practise with Skip under it; no paragraph text", async () => {
    await withAnswer("not_sure", {
      practiceExercise: {
        id: "ex-1",
        instruction: "Say it again, slower.",
        explanationVideoRef: "https://media/coach-exercise.mp4",
      },
    } as unknown as Partial<DocumentSuggestion>);
    const sheet = container.querySelector('[data-testid="paragraph-sheet"]') as HTMLElement;
    expect(sheet.querySelector("h2")?.textContent).toBe("This paragraph");
    const label = container.querySelector('[data-testid="judgement-label"]');
    expect(label?.getAttribute("data-tone")).toBe("yellow");
    expect(label?.textContent).toContain("Your judgement:");
    expect(label?.textContent).toContain("Not sure");
    const card = container.querySelector('[data-testid="practise-card"]');
    expect(card?.getAttribute("data-kind")).toBe("exercise");
    expect(card?.querySelector("video")?.getAttribute("src")).toBe("https://media/coach-exercise.mp4");
    expect(card?.textContent).toContain("Say it again, slower.");
    // Order: player, label, card, History (B5).
    const text = sheet.textContent ?? "";
    expect(text.indexOf("Your judgement:")).toBeLessThan(text.indexOf("Say it again, slower."));
    expect(text.indexOf("Say it again, slower.")).toBeLessThan(text.indexOf("History"));
    expect(text).not.toContain(TEXT);
    expect(labels()).toContain("Practise");
    expect(labels()).toContain("Skip");
    expect(labels()).not.toContain("Not now");
    expect(labels()).not.toContain("Next");
  });

  it("Practise opens the judgement sheet on its exercise step", async () => {
    await withAnswer("no");
    const practise = container.querySelector('[data-testid="paragraph-sheet-practise"]') as HTMLButtonElement;
    await act(async () => practise.click());
    expect(container.querySelector('[data-testid="paragraph-sheet"]')).toBeNull();
    expect(container.querySelector('[data-testid="practice-offer"]')).not.toBeNull();
  });

  it("Skip moves on without opening the helper words (B2)", async () => {
    closeSheet.mockClear();
    await withAnswer("no");
    await act(async () => (container.querySelector('[data-testid="paragraph-sheet-skip"]') as HTMLButtonElement).click());
    expect(closeSheet).toHaveBeenCalled();
    expect(container.textContent ?? "").not.toContain("Choose your helper words");
  });

  it("Yes: a green label, the praise as the card, Next and nothing under it; Next opens the helper words (24e)", async () => {
    const praise = {
      id: "s-pr",
      start: 22,
      end: 47,
      quote: "because the data is clear",
      kind: "advice",
      proposedText: null,
      device: "impeccable",
      status: "dismissed",
      feedbackFamily: "great_formulation",
      takeSessionId: "take-1",
      cueKeys: [],
    } as unknown as DocumentSuggestion;
    vi.mocked(fetchOwnerAnswers).mockResolvedValue([{ feedbackId: "s-cv", response: "yes" }]);
    forgetParagraphSheetData();
    const s = chunkStateFor(
      {
        part: { id: "p1", text: TEXT, locked: false },
        paragraphIndex: 0,
        start: 0,
        end: TEXT.length,
        status: "clean",
        pendingIds: [praise.id],
        approvedIds: [],
        decidedIds: [answered.id],
      } as DeckChunk,
      { document: TEXT, suggestions: [answered, praise] },
    );
    await act(async () => {
      root.render(
        createElement(OpenChunkSheet, {
          state: s,
          arcId: "arc-1",
          takeSessionId: "take-1",
          headline: null,
          onUseHelperWords: useWords,
          onClose: closeSheet,
          renderSheet: () => null,
        }),
      );
    });
    expect(container.querySelector('[data-testid="judgement-label"]')?.getAttribute("data-tone")).toBe("green");
    expect(container.querySelector('[data-testid="judgement-label"]')?.textContent).toContain("Confident");
    const card = container.querySelector('[data-testid="practise-card"]');
    expect(card?.getAttribute("data-kind")).toBe("praise");
    expect(card?.textContent).toContain("because the data is clear");
    expect(labels()).toContain("Next");
    expect(labels()).not.toContain("Skip");
    expect(labels()).not.toContain("Practise");
    await act(async () => (container.querySelector('[data-testid="paragraph-sheet-next"]') as HTMLButtonElement).click());
    expect(container.textContent).toContain("Choose your helper words");
    expect(container.textContent).toContain("0 of 4 words");
  });

  it("In-between: a blue label, Next with Practise as the plain link under it (Q1 B)", async () => {
    await withAnswer("in_between");
    expect(container.querySelector('[data-testid="judgement-label"]')?.getAttribute("data-tone")).toBe("blue");
    const next = container.querySelector('[data-testid="paragraph-sheet-next"]') as HTMLButtonElement;
    expect(next.textContent).toBe("Next");
    const link = container.querySelector('[data-testid="paragraph-sheet-practise"]') as HTMLButtonElement;
    expect(link.textContent).toBe("Practise");
    expect(next.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("Audio unclear: a grey label, no practise card, Next", async () => {
    await withAnswer("audio_unclear");
    expect(container.querySelector('[data-testid="judgement-label"]')?.getAttribute("data-tone")).toBe("grey");
    expect(container.querySelector('[data-testid="practise-card"]')).toBeNull();
    expect(labels()).toContain("Next");
    expect(labels()).not.toContain("Done");
    expect(labels()).not.toContain("Practise");
  });

  it("a Not sure answer with nothing matched: the plain moment to say again, with the coach's sentence (D1, Q5)", async () => {
    await withAnswer("not_sure", {
      practiceExercise: null,
      coachRequest: { status: "open", kind: "error" },
    } as unknown as Partial<DocumentSuggestion>);
    const card = container.querySelector('[data-testid="practise-card"]');
    expect(card?.getAttribute("data-kind")).toBe("plain");
    expect(card?.textContent).toContain("Say it again");
    expect(card?.textContent).toContain("We should ship it now");
    expect(container.querySelector('[data-testid="coach-request-line"]')?.textContent).toBe(
      "Your coach is working on your exercise.",
    );
  });
});

describe("the hand-off (founder lock 2026-09-30, B5)", () => {
  it("answering in the judgement sheet opens the paragraph's own sheet with that answer said back", async () => {
    vi.mocked(fetchOwnerAnswers).mockResolvedValue([]);
    forgetParagraphSheetData();
    const pending = { ...answered, status: null } as DocumentSuggestion;
    const s = chunkStateFor(
      {
        part: { id: "p1", text: TEXT, locked: false },
        paragraphIndex: 0,
        start: 0,
        end: TEXT.length,
        status: "waiting",
        pendingIds: [pending.id],
        approvedIds: [],
        decidedIds: [],
      } as DeckChunk,
      { document: TEXT, suggestions: [pending] },
    );
    await act(async () => {
      root.render(
        createElement(OpenChunkSheet, {
          state: s,
          arcId: "arc-1",
          takeSessionId: "take-1",
          headline: null,
          onUseHelperWords: useWords,
          onClose: closeSheet,
          renderSheet: (practiseAgain, onAnswered) =>
            createElement(DeckChunkModal, {
              state: s,
              practiseAgain,
              onAnswered,
              onAccept: vi.fn(async () => true),
              onKeepMine: vi.fn(async () => true),
              onLockIn: vi.fn(async () => ({ outcome: "ok" as const, rootPhraseProposal: null })),
              onSetRootPhrase: vi.fn(async () => true),
              onClose: vi.fn(),
            }),
        }),
      );
    });
    // 24e-1 (Phase 6): the bookmark opens on its feedback, never on the
    // question; Next asks the judgement.
    expect(container.textContent).not.toContain("Does this sound confident to you?");
    expect(container.querySelector('[data-testid="paragraph-sheet"]')).not.toBeNull();
    await act(async () =>
      (container.querySelector('[data-testid="paragraph-sheet-next"]') as HTMLButtonElement).click());
    expect(container.textContent).toContain("Does this sound confident to you?");
    const no = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "No",
    ) as HTMLButtonElement;
    await act(async () => no.click());
    // The overlay, with the answer just given, before any server read.
    const label = container.querySelector('[data-testid="judgement-label"]');
    expect(label?.getAttribute("data-tone")).toBe("red");
    expect(label?.textContent).toContain("Not confident");
    expect(container.textContent).not.toContain("Does this sound confident to you?");
    expect(container.querySelector('[data-testid="practise-card"]')?.getAttribute("data-kind")).toBe("exercise");
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
    // Still the waiting moment's sheet (24e-1: it opens on the feedback),
    // never swapped for the history: Next still asks the judgement.
    expect(container.querySelector('[data-testid="judge"]')).toBeNull();
    await act(async () =>
      (container.querySelector('[data-testid="paragraph-sheet-next"]') as HTMLButtonElement).click());
    expect(container.querySelector('[data-testid="judge"]')).not.toBeNull();
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
      (b) => b.textContent?.trim() === "Use these helper words",
    );
    expect(pill?.disabled).toBe(true);
    const tokens = container.querySelectorAll('[data-testid="picker-tokens"] button');
    expect(Array.from(tokens).some((t) => t.getAttribute("aria-pressed") === "true")).toBe(false);
    expect(sheet?.textContent).toContain("0 of 4 words");
    const word = Array.from(tokens).find((t) => t.textContent === "data");
    await act(async () => (word as HTMLButtonElement).click());
    expect(pill?.disabled).toBe(false);
    // The counter follows the run (founder lock 2026-09-30, B3).
    expect(sheet?.textContent).toContain("1 of 4 words");
    await act(async () => pill?.click());
    expect(useWords).toHaveBeenCalledTimes(1);
    expect(useWords.mock.calls[0][0].text).toBe("data");
    expect(closeSheet).toHaveBeenCalled();
  });
});

describe("the picker's Take 1 note (founder 2026-10-05, N48.3 Q8 A)", () => {
  const NOTE = "These words show while you record your next take";

  async function openPicker(firstTake: boolean) {
    forgetParagraphSheetData();
    await act(async () => {
      root.render(
        createElement(OpenChunkSheet, {
          state: state(),
          arcId: "arc-1",
          takeSessionId: "take-1",
          headline: null,
          onUseHelperWords: useWords,
          startPicking: true,
          firstTake,
          onClose: closeSheet,
          renderSheet: () => null,
        }),
      );
    });
  }

  it("shows the Feedback sheet's line under the title on Take 1", async () => {
    await openPicker(true);
    const sheet = container.querySelector('[data-testid="paragraph-sheet"]');
    expect(sheet?.querySelector("h2")?.textContent).toBe("Choose your helper words");
    expect(sheet?.textContent).toContain(NOTE);
  });

  it("does not show it on a later Take", async () => {
    await openPicker(false);
    const sheet = container.querySelector('[data-testid="paragraph-sheet"]');
    expect(sheet?.querySelector("h2")?.textContent).toBe("Choose your helper words");
    expect(sheet?.textContent).not.toContain(NOTE);
  });
});
