// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  The Feedback walk mounted on the real deck (build plan D-FW-14; permanent  */
/*  since the founder's 2026-10-11 "keep the new designs, make them           */
/*  permanent").                                                              */
/*                                                                            */
/*  Review feedback opens the walk on the coach's note or the first           */
/*  praise; a tap on a paragraph with an open moment opens it there (Q-B3 A); */
/*  helper words picked in it go through the deck's own save; a guest's pick  */
/*  asks to sign up and writes nothing.                                       */
/* -------------------------------------------------------------------------- */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TranscriptReviewDeck from "./TranscriptReviewDeck";
import { GuestGateContext } from "./GuestSignUpDialog";
import { CHUNK_SHEET_COPY as COPY } from "./idealEditCopy";
import { saveTakeFeedbackResponse } from "@/services/api/takeFeedback";
import { PRAISE_CUE_COPY, PRAISE_LEAD } from "@/lib/willab/trackedChangeWhy";
import type { Part } from "@/lib/willab/documentParts";
import type { DocumentSuggestion } from "@/services/api/idealText";

vi.mock("@/services/api/takeFeedback", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/api/takeFeedback")>()),
  saveTakeFeedbackResponse: vi.fn(async () => ({ ok: true })),
}));
const practice = vi.hoisted(() => ({ on: true }));
vi.mock("@/services/api/consentChoices", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/api/consentChoices")>()),
  practiseOfferedNow: () => practice.on,
  readPractiseOffered: async () => practice.on,
}));
vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: vi.fn(async () => "t") }));
vi.mock("@/hooks/useVisibleLearningExposure", () => ({
  useVisibleLearningExposure: () => undefined,
}));
/** The microphone, counted: the walk's practise opens it only on a
 *  practise screen (D-FW-16). */
const mic = vi.hoisted(() => ({ starts: 0, cancels: 0 }));
vi.mock("@/hooks/useDualCaptureMic", () => ({
  useDualCaptureMic: () => ({
    state: { status: "idle" },
    start: async () => {
      mic.starts += 1;
    },
    stop: async () => undefined,
    cancel: () => {
      mic.cancels += 1;
    },
    getAudioStartedAt: () => null,
  }),
}));
vi.mock("@/components/results/MediaPlayer", () => ({ default: () => createElement("div") }));
vi.mock("@/services/api/bookmarkHistory", () => ({
  fetchOwnerAnswers: vi.fn(async () => []),
  fetchParagraphHistory: vi.fn(async () => null),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SLIDES = [
  "Good morning. Today I want to show you how the pilot changed our numbers.",
  "Three things stood out: retention went up, churn went down, and the team stayed calm.",
  "So here is what I am asking for: one more quarter of the same budget.",
];
const text = SLIDES.join("\n\n");
const at = text.indexOf("retention went up");
const base = {
  end: at + "retention went up".length, quote: "retention went up", kind: "advice",
  proposedText: null, device: null, tentative: false, status: "pending", blockId: "block-2",
  snippetAudioRef: "https://media/moment.wav", startOffsetMs: 0, durationMs: 9000,
  cueKeys: [], praiseLine: null, rewriteMove: null, why: null, snippetId: "snip-1",
  takeSessionId: "take-2", takeIndex: 2, visual: "star", pendingBetterVersion: false,
  pendingCopy: null, blockKey: null,
};
/** The Confident Voice moment on paragraph 2, waiting. */
const judgement = {
  ...base, id: "s-cv", start: at, feedbackFamily: "confident_voice", source: "confident_voice",
} as unknown as DocumentSuggestion;
/** Its praise, on the same block. */
const praise = {
  ...base, id: "s-praise", start: at + 1, feedbackFamily: "great_formulation", source: "delivery",
  cueKeys: ["landed_ending"],
} as unknown as DocumentSuggestion;

/** A clearer version on the same block: the served rewrite. */
const rewrite = {
  ...base, id: "s-rw", start: at, kind: "replace", proposedText: "retention rose",
  feedbackFamily: "rewrite_clarity", source: "new_take", blockKey: 2,
} as unknown as DocumentSuggestion;

const noop = async () => true;
function props(over: Record<string, unknown> = {}) {
  const parts: Part[] = SLIDES.map((t, i) => ({ id: `p${i + 1}`, text: t }));
  return {
    title: "My Q3 pitch",
    document: text,
    parts,
    suggestions: [judgement, praise],
    pieceSlideIndexes: [0, 1, 2],
    piecePartIds: ["p1", "p2", "p3"],
    slideTitles: ["Opening", "Results", "The ask"],
    arcId: "arc-1",
    takeSessionId: "take-2",
    takeCount: 2,
    onAccept: vi.fn(noop),
    onKeepMine: vi.fn(noop),
    onLockPart: vi.fn(async () => ({ outcome: "ok" as const, rootPhraseProposal: null })),
    onSetRootPhrase: vi.fn(noop),
    onEditSlide: vi.fn(noop),
    onClose: vi.fn(),
    ...over,
  };
}

Element.prototype.scrollTo = Element.prototype.scrollTo ?? (() => undefined);
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => undefined);

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  practice.on = true;
  mic.starts = 0;
  mic.cancels = 0;
  vi.mocked(saveTakeFeedbackResponse).mockClear();
  window.localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 })));
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function render(p: ReturnType<typeof props> & { reviewRequest?: number }, block?: () => boolean) {
  const deck = createElement(TranscriptReviewDeck, p);
  await act(async () => {
    root.render(block ? createElement(GuestGateContext.Provider, { value: block }, deck) : deck);
  });
}
const live = () => document.querySelector<HTMLElement>("[data-feedback-walk] .walk-layer:not(.walk-ghost)");
const screen = () => live()?.querySelector<HTMLElement>("[data-testid^='walk-screen-']")?.dataset.testid ?? null;
const pager = () => document.querySelector('[data-testid="feedback-pager"]');
const click = async (el: Element | null | undefined) => {
  await act(async () => (el as HTMLElement).click());
};
const paragraph = (words: string) =>
  [...container.querySelectorAll<HTMLElement>("[data-chunk]")].find((el) => (el.textContent ?? "").includes(words));

describe("the walk on the deck", () => {
  it("Review feedback opens the walk on the first praise, not today's sheet", async () => {
    const p = props();
    await render(p);
    expect(live()).toBeNull();
    await render({ ...p, reviewRequest: 1 });
    expect(screen()).toBe("walk-screen-praise");
    expect(live()!.className).toContain("walk-m-open");
    expect(pager()).toBeNull();
    // "Good job" is the bubble's first line, then the praise (lock 2026-10-12).
    expect(live()!.querySelector("[data-walk-message]")!.textContent).toBe(
      [COPY.titlePraise, [PRAISE_LEAD, PRAISE_CUE_COPY.landed_ending].join(" ")].join(""),
    );
    expect(live()!.querySelector("[data-walk-nav]")!.getAttribute("aria-label")).toBe(
      `Slide 2 · ${COPY.pagerMoment} 1 ${COPY.pagerOf} 1`,
    );
  });

  it("a tap on a paragraph with an open moment opens the walk there (Q-B3 A)", async () => {
    await render(props());
    await click(paragraph("retention went up"));
    expect(screen()).toBe("walk-screen-praise");
    expect(pager()).toBeNull();
  });

  it("helper words picked in the walk go through the deck's own save: the words and the lock", async () => {
    const p = props();
    await render(p);
    await render({ ...p, reviewRequest: 1 });
    await click(live()!.querySelector("[data-testid='walk-forward']"));
    expect(screen()).toBe("walk-screen-helpers");
    const words = [...live()!.querySelectorAll<HTMLButtonElement>("[data-walk-word-picker] button")];
    const retention = words.findIndex((w) => w.textContent === "retention");
    await click(words[retention]);
    await click(words[retention + 1]);
    await click(live()!.querySelector("[data-testid='walk-forward']"));
    const chunkOf = (call: unknown[]) => (call[0] as { part: { id: string } }).part.id;
    expect(p.onSetRootPhrase).toHaveBeenCalledTimes(1);
    const [rootCall] = p.onSetRootPhrase.mock.calls as unknown[][];
    expect(chunkOf(rootCall)).toBe("p2");
    const start = SLIDES[1].indexOf("retention went");
    expect(rootCall[1]).toEqual({ text: "retention went", start, end: start + "retention went".length });
    expect(p.onLockPart).toHaveBeenCalledTimes(1);
    const [lockCall] = p.onLockPart.mock.calls as unknown[][];
    expect(chunkOf(lockCall)).toBe("p2");
    expect(lockCall[1]).toBe(SLIDES[1]);
  });
});

describe("the clearer version in the walk (D-FW-15)", () => {
  const toClearer = async (p: ReturnType<typeof props>) => {
    await render(p);
    await render({ ...p, reviewRequest: 1 });
    expect(screen()).toBe("walk-screen-praise");
    await click(live()!.querySelector("[data-testid='walk-forward']"));
    await click(live()!.querySelector("[data-testid='walk-skip']"));
    expect(screen()).toBe("walk-screen-clearer");
  };

  it("Accept and practise writes through the accept lane: the response, then the deck's onAccept", async () => {
    const p = props({ suggestions: [judgement, praise, rewrite] });
    await toClearer(p);
    await click(live()!.querySelector("[data-testid='walk-forward']"));
    await act(async () => undefined);
    expect(vi.mocked(saveTakeFeedbackResponse)).toHaveBeenCalledWith(
      expect.objectContaining({ feedbackId: "s-rw", response: "apply_suggestion" }),
    );
    expect(p.onAccept).toHaveBeenCalledWith(expect.objectContaining({ id: "s-rw" }));
    expect(p.onKeepMine).not.toHaveBeenCalled();
    expect(screen()).not.toBe("walk-screen-clearer");
  });
});
