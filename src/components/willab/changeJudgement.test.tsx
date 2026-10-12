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
import { chunkStateFor, type DeckChunk } from "@/lib/willab/deckChunks";
import type { DocumentSuggestion } from "@/services/api/idealText";
import { saveTakeFeedbackResponse } from "@/services/api/takeFeedback";
import { fetchOwnerAnswers } from "@/services/api/bookmarkHistory";
import type { BehindOutcome } from "./saveBehind";
import {
  forgetParagraphSheetData,
  prefetchParagraphSheets,
  readySheetData,
} from "./paragraphSheetData";
import {
  latestAnswerOf,
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
});
