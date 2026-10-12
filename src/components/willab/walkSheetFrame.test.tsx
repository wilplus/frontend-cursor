// @vitest-environment jsdom
/* The Feedback sheet's frame, as Ideal Text Final Screens draws it (audit of
   2026-09-29 against the locked design):
     - one sheet height for every step, the coach step included;
     - the compact "Play this moment · 0:09" row on Good job, Suggestion, the
       paragraph sheet, not the full player (the Exercise is practised in
       the Feedback walk since 2026-10-10);
     - a tap on a grey bar draws the paragraph sheet's frame at once, even
       before its reads land. */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DeckChunkModal from "./DeckChunkModal";
import ParagraphSheet from "./ParagraphSheet";
import { forgetParagraphSheetData } from "./paragraphSheetData";
import { chunkStateFor, type DeckChunk } from "@/lib/willab/deckChunks";
import type { DocumentSuggestion } from "@/services/api/idealText";
import type { RootPhraseSpan } from "@/services/api/partLock";
import type { BehindOutcome } from "./saveBehind";
import { PRAISE_CUE_COPY } from "@/lib/willab/trackedChangeWhy";
import { fetchParagraphHistory } from "@/services/api/bookmarkHistory";

vi.mock("@/hooks/useVisibleLearningExposure", () => ({
  useVisibleLearningExposure: () => undefined,
}));
vi.mock("@/hooks/useExerciseRenderedAck", () => ({
  useExerciseRenderedAck: () => undefined,
}));
// The player records whether it was asked for the compact row.
vi.mock("@/components/results/MediaPlayer", () => ({
  default: (props: { compact?: boolean }) =>
    createElement("div", { "data-testid": "media-player", "data-compact": String(props.compact === true) }),
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
  fetchOwnerAnswers: vi.fn(async () => []),
  fetchParagraphHistory: vi.fn(async () => null),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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
  snippetAudioRef: "https://media/moment.wav",
  startOffsetMs: 0,
  durationMs: 9000,
  practiceExercise: {
    id: "ex-1",
    instruction: "Say it again, slower.",
    explanationVideoRef: "https://media/coach-exercise.mp4",
  },
  evidence: {
    projectId: "arc-1",
    takeSessionId: "take-1",
    slideIndex: 0,
    paragraphIndex: 0,
    start: 0,
    end: 22,
  },
} as unknown as Partial<DocumentSuggestion>);

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

function chunk(pending: DocumentSuggestion[]): DeckChunk {
  return {
    part: { id: "p1", text: TEXT, locked: false },
    paragraphIndex: 0,
    start: 0,
    end: TEXT.length,
    status: "waiting",
    pendingIds: pending.map((s) => s.id),
    approvedIds: [],
  } as DeckChunk;
}

const props = {
  onAccept: vi.fn(async () => true),
  onKeepMine: vi.fn(async () => true),
  onJudged: vi.fn(),
  onLockIn: vi.fn(async (_text: string) => ({
    outcome: "ok" as const,
    rootPhraseProposal: null,
  })),
  onSetRootPhrase: vi.fn(async (_phrase: RootPhraseSpan | null) => true),
  onClose: vi.fn(),
  saveBehind: vi.fn((task: () => Promise<BehindOutcome>) => {
    void task();
  }),
};

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  forgetParagraphSheetData();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function renderSheet(pending: DocumentSuggestion[]) {
  await act(async () => {
    root.render(
      createElement(DeckChunkModal, {
        ...props,
        state: chunkStateFor(chunk(pending), { document: TEXT, suggestions: pending }),
      }),
    );
  });
}

async function click(label: string) {
  const button = Array.from(container.querySelectorAll("button")).find(
    (b) => (b.textContent ?? "").trim() === label && !b.hasAttribute("data-sheet-grabber"),
  );
  if (!button) throw new Error(`no button labelled "${label}"`);
  await act(async () => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

const playerCompact = () =>
  container.querySelector('[data-testid="media-player"]')?.getAttribute("data-compact");

describe("the compact player row", () => {
  it("Suggestion and Good job draw the compact row, not the full player", async () => {
    await renderSheet([confidentVoice, rewrite, praise]);
    await click("Yes");
    expect(container.textContent).toContain("Suggestion");
    expect(playerCompact()).toBe("true");
    await click("Keep my wording");
    expect(container.textContent).toContain("Good job");
    expect(playerCompact()).toBe("true");
  });
});

describe("the paragraph sheet while its reads are pending", () => {
  it("draws the frame with the helper words, and never the paragraph text (D6)", async () => {
    vi.mocked(fetchParagraphHistory).mockReturnValueOnce(new Promise(() => undefined) as never);
    const decided = suggestion({
      ...confidentVoice,
      id: "s-done",
      status: "dismissed",
    } as Partial<DocumentSuggestion>);
    await act(async () => {
      root.render(
        createElement(ParagraphSheet, {
          arcId: "arc-1",
          takeSessionId: "take-1",
          partId: "p-pending",
          text: TEXT,
          headline: "ship it now",
          decided: [decided],
          onClose: () => undefined,
        }),
      );
    });
    const frame = container.querySelector('[data-testid="paragraph-sheet"]');
    expect(frame).not.toBeNull();
    // Saved helper words: the saved state, drawn at once with what it has.
    const saved = container.querySelector('[data-testid="overlay-saved"]');
    expect(saved).not.toBeNull();
    expect(saved?.textContent).toContain("ship it now");
    expect(frame?.textContent).not.toContain(TEXT);
  });

  it("without saved words, the practise state draws the player and the button at once", async () => {
    vi.mocked(fetchParagraphHistory).mockReturnValueOnce(new Promise(() => undefined) as never);
    const decided = suggestion({
      ...confidentVoice,
      id: "s-done-2",
      status: "dismissed",
    } as Partial<DocumentSuggestion>);
    await act(async () => {
      root.render(
        createElement(ParagraphSheet, {
          arcId: "arc-1",
          takeSessionId: "take-1",
          partId: "p-pending-2",
          text: TEXT,
          headline: null,
          decided: [decided],
          onClose: () => undefined,
        }),
      );
    });
    expect(container.querySelector('[data-testid="paragraph-sheet-loading"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="paragraph-sheet-next"]')).not.toBeNull();
    expect(container.textContent).not.toContain(TEXT);
  });
});

describe("Good job as the design draws it (L4)", () => {
  it("says what this moment's voice did, from the closed cue vocabulary, under the lead", async () => {
    const cued = suggestion({ ...praise, cueKeys: ["wide_range", "not_a_key"] } as Partial<DocumentSuggestion>);
    await renderSheet([confidentVoice, cued]);
    await click("Yes");
    expect(container.textContent).toContain("Good job");
    expect(container.textContent).toContain("It was your confident moment.");
    expect(container.textContent).toContain(PRAISE_CUE_COPY.wide_range);
    // An unknown cue renders nothing, never an invented sentence.
    expect(container.textContent).not.toMatch(/not_a_key/);
  });
});
