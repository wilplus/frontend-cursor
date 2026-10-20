// @vitest-environment jsdom
/*
 * STORY    As a speaker, I want my answer on a bookmark with no exercise to
 *          lead to the right lane, so that a No always leads somewhere and
 *          Audio unclear leads nowhere.
 * OUTCOME
 *   O1  No (a recognised problem, no exercise): the sheet says the coach is
 *       working on it, with my recording, and Next closes the sheet.
 *   O2  Audio unclear on the same bookmark: no coach sentence, the sheet closes.
 *   O3  Yes on the same bookmark: no coach sentence.
 * PROVES   O1 -> "says the coach is working on it, with your recording, and Next moves on (D10)"
 *          O2 -> "Audio unclear never reaches the coach sentence, and closes"
 *          O3 -> "a Yes shows no coach sentence"
 * WHY      Founder 2026-09-29 (follow-up matrix); the exercise itself is
 *          practised in the Feedback walk since 2026-10-10.
 */
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
vi.mock("@/services/api/takeFeedback", async (load) => {
  const actual = await load<typeof import("@/services/api/takeFeedback")>();
  return { ...actual, saveTakeFeedbackResponse: vi.fn(async () => ({ ok: true })) };
});
vi.mock("@/lib/api/auth-client", () => ({
  getAuthToken: vi.fn(async () => "test-token"),
}));

const TEXT =
  "We should ship it now because the data is clear and the team is ready.";

/* THE BOOKMARK WITH NO EXERCISE (founder 2026-09-29): a No no longer leads
   nowhere. The server sends the bookmark to the coach when the answer saves;
   the sheet says so on the Exercise screen, and Next is the way on. */
const bare = {
  id: "s-cv-bare",
  start: 0,
  end: 21,
  quote: "We should ship it now",
  kind: "advice",
  proposedText: null,
  device: null,
  feedbackFamily: "confident_voice",
  source: "confident_voice",
  snippetId: "snip-1",
  takeSessionId: "take-1",
  practiceExercise: null,
  evidence: {
    projectId: "arc-1", takeSessionId: "take-1", slideIndex: 0,
    paragraphIndex: 0, start: 0, end: 21,
  },
} as unknown as DocumentSuggestion;

function chunk(): DeckChunk {
  return {
    part: { id: "p1", text: TEXT, locked: false },
    paragraphIndex: 0,
    start: 0,
    end: TEXT.length,
    status: "waiting",
    pendingIds: [bare.id],
    approvedIds: [],
  } as DeckChunk;
}

const props = {
  onAccept: vi.fn(async () => true),
  onKeepMine: vi.fn(async () => true),
  onJudged: vi.fn(),
  onLockIn: vi.fn(async () => ({ outcome: "ok" as const, rootPhraseProposal: null })),
  onSetRootPhrase: vi.fn(async () => true),
  onClose: vi.fn(),
  saveBehind: vi.fn((task: () => Promise<unknown>) => { void task(); }),
};

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

function buttons(): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll("button"));
}
function button(label: string): HTMLButtonElement {
  const found = buttons().find(
    (b) => (b.textContent ?? "").trim() === label && !b.hasAttribute("data-sheet-grabber"),
  );
  if (!found) throw new Error(`no button labelled "${label}"`);
  return found;
}
async function click(label: string) {
  await act(async () => {
    button(label).dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}
const notice = () => container.querySelector('[data-testid="coach-request-notice"]');

const recognisedBare = { ...bare, id: "s-cv-rec-bare", problemRecognised: true } as DocumentSuggestion;

describe("a No on a bookmark with no exercise", () => {
  it("says the coach is working on it, with your recording, and Next moves on (D10)", async () => {
    // Read weak, a problem fired, nothing targets it: an error the coach
    // always answers with a video (the follow-up matrix, founder 2026-09-29).
    props.onClose.mockClear();
    await act(async () => {
      root.render(
        createElement(DeckChunkModal, {
          ...props,
          state: chunkStateFor(
            { ...chunk(), pendingIds: [recognisedBare.id] } as DeckChunk,
            { document: TEXT, suggestions: [recognisedBare] },
          ),
        }),
      );
    });
    await click("No");
    expect(notice()).not.toBeNull();
    expect(notice()?.textContent).toContain("Your coach is working on your exercise.");
    expect(notice()?.textContent).toContain("What you said");
    const labels = buttons().map((b) => b.textContent?.trim());
    expect(labels).toContain("Next");
    expect(labels).not.toContain("Practise");
    expect(props.onClose).not.toHaveBeenCalled();
    await click("Next");
    // The only item was answered and a No has no helper-words step: the
    // sheet is done, and the host closes it.
    expect(props.onClose).toHaveBeenCalled();
  });
});

describe("the lane on every bookmark (founder 2026-09-29)", () => {
  const recognised = { ...bare, id: "s-cv-rec", problemRecognised: true } as DocumentSuggestion;
  async function open(target: DocumentSuggestion) {
    props.onClose.mockClear();
    await act(async () => {
      root.render(
        createElement(DeckChunkModal, {
          ...props,
          state: chunkStateFor(
            { ...chunk(), pendingIds: [target.id] } as DeckChunk,
            { document: TEXT, suggestions: [target] },
          ),
        }),
      );
    });
  }

  it("Audio unclear never reaches the coach sentence, and closes", async () => {
    await open(recognised);
    await click("Audio unclear");
    expect(notice()).toBeNull();
    expect(props.onClose).toHaveBeenCalled();
  });

  it("a Yes shows no coach sentence", async () => {
    await open(recognised);
    await click("Yes");
    expect(notice()).toBeNull();
    // The sheet moved on from the question rather than stopping on it.
    expect(buttons().some((b) => b.textContent?.trim() === "Audio unclear")).toBe(false);
  });
});
