// @vitest-environment jsdom
/* A SPEAKER MAY CHANGE A JUDGEMENT (founder QA1 A, decisions log N51.5;
   build plan D-FW-9; journey Q3: "the back arrow returns to change it").

   ‹ back to an answered Confident Voice moment reopens its judgement with
   the latest answer pressed. A different answer posts and the server's 200
   `revised` is a save like any other; the same answer sends nothing; a
   rewrite never reopens; a revision the server could not save shows the
   signed "Couldn't save your answer." notice. No new strings. */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DeckChunkModal from "./DeckChunkModal";
import OpenChunkSheet from "./OpenChunkSheet";
import { chunkStateFor, type DeckChunk } from "@/lib/willab/deckChunks";
import type { DocumentSuggestion } from "@/services/api/idealText";
import { saveTakeFeedbackResponse } from "@/services/api/takeFeedback";
import { fetchOwnerAnswers } from "@/services/api/bookmarkHistory";
import type { BehindOutcome } from "./saveBehind";
import { CHUNK_SHEET_COPY } from "./idealEditCopy";
import {
  forgetParagraphSheetData,
  prefetchParagraphSheets,
  readySheetData,
} from "./paragraphSheetData";
import {
  answerChanged,
  latestAnswerOf,
  reopenableMoment,
  reopenedJudgement,
} from "@/lib/willab/changeJudgement";

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
  fetchOwnerAnswers: vi.fn(async () => []),
  fetchParagraphHistory: vi.fn(async () => null),
}));

const TEXT = "We should ship it now because the data is clear.";

const moment = {
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
} as unknown as DocumentSuggestion;

const rewrite = {
  id: "s-rw",
  start: 22,
  end: 47,
  quote: "because the data is clear",
  kind: "replace",
  proposedText: "because the numbers back it",
  device: null,
  status: "approved",
  feedbackFamily: "rewrite_clarity",
  takeSessionId: "take-1",
} as unknown as DocumentSuggestion;

function answeredState(items: DocumentSuggestion[] = [moment]) {
  return chunkStateFor(
    {
      part: { id: "p1", text: TEXT, locked: false },
      paragraphIndex: 0,
      start: 0,
      end: TEXT.length,
      status: "clean",
      pendingIds: [],
      approvedIds: [],
      decidedIds: items.map((i) => i.id),
    } as DeckChunk,
    { document: TEXT, suggestions: items },
  );
}

const behind: { failText: string; done: Promise<BehindOutcome> }[] = [];
const saveBehind = vi.fn((task: () => Promise<BehindOutcome>, failText: string) => {
  behind.push({ failText, done: task() });
});
const onAnswered = vi.fn();
const onJudged = vi.fn();

function sheetProps() {
  return {
    onAccept: vi.fn(async () => true),
    onKeepMine: vi.fn(async () => true),
    onLockIn: vi.fn(async () => ({ outcome: "ok" as const, rootPhraseProposal: null })),
    onSetRootPhrase: vi.fn(async () => true),
    onClose: vi.fn(),
    onJudged,
    onAnswered,
    saveBehind,
  };
}

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  behind.length = 0;
  vi.mocked(saveTakeFeedbackResponse).mockClear();
  onAnswered.mockClear();
  onJudged.mockClear();
  forgetParagraphSheetData();
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

function answerButton(label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find(
    (b) => (b.textContent ?? "").trim() === label,
  );
  if (!button) throw new Error(`no button "${label}"`);
  return button as HTMLButtonElement;
}

function pressed(): string[] {
  return Array.from(container.querySelectorAll('button[aria-pressed="true"]')).map(
    (b) => (b.textContent ?? "").trim(),
  );
}

async function renderReopened(answer: "yes" | "in_between" | "no", item = moment) {
  await act(async () => {
    root.render(
      createElement(DeckChunkModal, {
        ...sheetProps(),
        state: answeredState(item === moment ? [moment] : [item]),
        reopen: { item, answer },
      }),
    );
  });
}

describe("‹ reopens the judgement with the earlier answer pressed", () => {
  it("shows the question with the latest stored answer pressed", async () => {
    await renderReopened("in_between");
    expect(container.textContent).toContain(CHUNK_SHEET_COPY.confidenceQuestion);
    expect(pressed()).toEqual(["In-between"]);
  });

  it("a different answer posts, and the 200 revised is a save that updates the answer", async () => {
    vi.mocked(saveTakeFeedbackResponse).mockResolvedValueOnce({
      ok: true,
      revised: true,
      followUp: "library_video",
    });
    // The page read the answers ahead: the stored answer is Yes.
    vi.mocked(fetchOwnerAnswers).mockResolvedValue([{ feedbackId: "s-cv", response: "yes" }]);
    await act(async () => prefetchParagraphSheets(null, "take-1", []));
    await renderReopened("yes");
    expect(pressed()).toEqual(["Yes"]);
    await act(async () => answerButton("No").click());
    expect(saveTakeFeedbackResponse).toHaveBeenCalledTimes(1);
    expect(vi.mocked(saveTakeFeedbackResponse).mock.calls[0][0]).toMatchObject({
      takeSessionId: "take-1",
      feedbackId: "s-cv",
      feedbackFamily: "confident_voice",
      response: "no",
    });
    expect(await behind[0].done).toBe("ok");
    // The row's status and the hand-off follow the NEW answer.
    expect(onJudged).toHaveBeenCalledWith(expect.objectContaining({ id: "s-cv" }), "dismissed");
    expect(onAnswered).toHaveBeenCalledWith("no");
    // The answer stands in the read at once, so ‹ again shows it.
    expect(latestAnswerOf("s-cv", readySheetData(null, "take-1", "p1")?.answers ?? [])).toBe("no");
  });

  it("the same answer sends nothing and moves on as before", async () => {
    await renderReopened("no");
    await act(async () => answerButton("No").click());
    expect(saveTakeFeedbackResponse).not.toHaveBeenCalled();
    expect(behind).toHaveLength(0);
    expect(onAnswered).toHaveBeenCalledWith("no");
  });

  it("a revision the server could not save (500) shows the signed notice", async () => {
    vi.mocked(saveTakeFeedbackResponse).mockResolvedValueOnce({
      ok: false,
      error: "Could not save this response.",
    });
    await renderReopened("yes");
    await act(async () => answerButton("In-between").click());
    expect(await behind[0].done).toBe("failed");
    expect(behind[0].failText).toBe(CHUNK_SHEET_COPY.failAnswerBehind);
  });

  it("a rewrite's answer never reopens: no question, nothing pressed, nothing sent", async () => {
    await renderReopened("yes", rewrite);
    expect(container.textContent).not.toContain(CHUNK_SHEET_COPY.confidenceQuestion);
    expect(pressed()).toEqual([]);
    expect(saveTakeFeedbackResponse).not.toHaveBeenCalled();
  });

  it("puts no number in the reopened judgement (AC-9)", async () => {
    await renderReopened("in_between");
    expect(container.textContent ?? "").not.toMatch(/\d/);
  });
});

describe("the paragraph opened by ‹ (OpenChunkSheet)", () => {
  function renderOpened(reopenJudgement: boolean, items: DocumentSuggestion[] = [moment]) {
    const s = answeredState(items);
    return act(async () => {
      root.render(
        createElement(OpenChunkSheet, {
          state: s,
          arcId: "arc-1",
          takeSessionId: "take-1",
          headline: null,
          onClose: vi.fn(),
          reopenJudgement,
          renderSheet: (practiseAgain, handOff, reopen) =>
            createElement(DeckChunkModal, {
              ...sheetProps(),
              state: s,
              practiseAgain,
              onAnswered: handOff,
              reopen,
            }),
        }),
      );
    });
  }

  it("reopens the judgement on the latest answer, and a change hands back to the paragraph's sheet", async () => {
    vi.mocked(fetchOwnerAnswers).mockResolvedValue([{ feedbackId: "s-cv", response: "yes" }]);
    await renderOpened(true);
    expect(container.textContent).toContain(CHUNK_SHEET_COPY.confidenceQuestion);
    expect(pressed()).toEqual(["Yes"]);
    await act(async () => answerButton("No").click());
    expect(saveTakeFeedbackResponse).toHaveBeenCalledTimes(1);
    expect(container.textContent).not.toContain(CHUNK_SHEET_COPY.confidenceQuestion);
    const label = container.querySelector('[data-testid="judgement-label"]');
    expect(label?.textContent).toContain("Not confident");
  });

  it("a tap from the page (not ‹) opens the paragraph's own sheet, as before", async () => {
    vi.mocked(fetchOwnerAnswers).mockResolvedValue([{ feedbackId: "s-cv", response: "yes" }]);
    await renderOpened(false);
    expect(container.textContent).not.toContain(CHUNK_SHEET_COPY.confidenceQuestion);
    expect(container.querySelector('[data-testid="paragraph-sheet"]')).not.toBeNull();
  });

  it("no known answer: the paragraph's own sheet, never a made-up one", async () => {
    vi.mocked(fetchOwnerAnswers).mockResolvedValue([]);
    await renderOpened(true);
    expect(container.textContent).not.toContain(CHUNK_SHEET_COPY.confidenceQuestion);
    expect(container.querySelector('[data-testid="paragraph-sheet"]')).not.toBeNull();
  });
});

describe("the rules (pure)", () => {
  it("only an answered Confident Voice moment on an unsaved paragraph reopens", () => {
    expect(reopenableMoment({ pending: [], decided: [moment] }, false)?.id).toBe("s-cv");
    expect(reopenableMoment({ pending: [], decided: [moment] }, true)).toBeNull();
    expect(reopenableMoment({ pending: [], decided: [rewrite] }, false)).toBeNull();
    expect(reopenableMoment({ pending: [moment], decided: [] }, false)).toBeNull();
  });

  it("reads only the five answers, and saves only a change", () => {
    expect(latestAnswerOf("s-cv", [{ feedbackId: "s-cv", response: "apply_suggestion" }])).toBeNull();
    expect(latestAnswerOf("s-cv", [{ feedbackId: "s-cv", response: "not_sure" }])).toBe("not_sure");
    expect(reopenedJudgement({ item: rewrite, answer: "yes" })).toBeNull();
    expect(answerChanged(null, "yes")).toBe(true);
    expect(answerChanged({ item: moment, answer: "yes" }, "yes")).toBe(false);
    expect(answerChanged({ item: moment, answer: "yes" }, "no")).toBe(true);
  });
});
