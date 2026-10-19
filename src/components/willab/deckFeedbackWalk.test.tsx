// @vitest-environment jsdom
/*
STORY    As a speaker reviewing feedback, I want the walk to open on my
         first praise, browse every step across slides, save
         helper words through the deck, and ask a guest to sign up, so that
         feedback flows into my next Take.
OUTCOME
  O1  Review feedback opens the walk on the first praise.
  O2  The arrows browse every step across slides, answered and waiting,
      without answering anything.
  O3  A tap on a paragraph with an open moment opens the walk there.
  O4  Helper words picked in the walk are saved through the deck's own
      save (the words, then the lock) and show orange in the text at once.
  O5  Never-5: Accept and practise saves the answer through the accept lane,
      and the deck still shows the speaker's own words, not the clearer ones.
  O6  A guest's pick asks to sign up, is not taken, and nothing is written.
PROVES   O1 -> "Review feedback opens the walk on the first praise, not today's sheet"
         O2 -> "‹ › browse every screen across slides, answered and waiting
                alike, and never close the walk (founder 2026-10-15)"
         O3 -> "a tap on a paragraph with an open moment opens the walk there (Q-B3 A)"
         O4 -> "helper words picked in the walk go through the deck's own
                save: the words and the lock"
         O5 -> "Accept and practise writes through the accept lane and leaves the speaker's words on the page"
         O6 -> "a guest's pick asks to sign up and writes nothing"
WHY      Feedback walk lock 2026-10-06/2026-10-12. The paragraph sheet's
         accept lane is in acceptRewrite.test.tsx.
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TranscriptReviewDeck from "./TranscriptReviewDeck";
import { GuestGateContext } from "./GuestSignUpDialog";
import { CHUNK_SHEET_COPY as COPY, WALK_COPY } from "./idealEditCopy";
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
    expect(live()!.querySelector("[data-walk-nav]")!.getAttribute("aria-label")).toBe("Slide 2");
  });

  it("‹ › browse every screen across slides, answered and waiting alike, and never close the walk (founder 2026-10-15)", async () => {
    // Slide 1's clearer version is answered already; slide 2's praise and
    // slide 3's clearer version wait. Walk order: praise, helper words,
    // then the practising, slide by slide.
    const slide1 = SLIDES[0].indexOf("the pilot");
    const slide3 = SLIDES[0].length + 2 + SLIDES[1].length + 2 + SLIDES[2].indexOf("one more quarter");
    const done = {
      ...rewrite, id: "s-rw1", start: slide1, end: slide1 + "the pilot".length, quote: "the pilot",
      proposedText: "our pilot", status: "approved", blockId: "block-1", snippetId: "snip-0",
    } as unknown as DocumentSuggestion;
    const open = {
      ...rewrite, id: "s-rw3", start: slide3, end: slide3 + "one more quarter".length, quote: "one more quarter",
      proposedText: "a fourth quarter", blockId: "block-3", snippetId: "snip-3",
    } as unknown as DocumentSuggestion;
    // Its moment: the paragraph waits only with a Confident Voice item on it.
    const moment3 = { ...judgement, id: "s-cv3", start: slide3, end: open.end, quote: open.quote, blockId: "block-3", snippetId: "snip-3" } as unknown as DocumentSuggestion;
    const p = props({ suggestions: [judgement, praise, done, open, moment3] });
    await render(p);
    await render({ ...p, reviewRequest: 1 });
    const bar = () => live()!.querySelector("[data-walk-nav]")!;
    const arrow = (label: string) => bar().querySelector<HTMLButtonElement>(`button[aria-label='${label}']`)!;
    const next = () => click(arrow(COPY.pagerNext));
    const back = () => click(arrow(COPY.pagerBack));
    expect(screen()).toBe("walk-screen-praise");
    expect(bar().getAttribute("aria-label")).toBe("Slide 2");
    expect(arrow(COPY.pagerBack).disabled).toBe(true);
    expect(arrow(COPY.pagerNext).disabled).toBe(false);
    await next();
    expect(screen()).toBe("walk-screen-helpers");
    await next();
    // The answered step, as given: read only, Next.
    expect(screen()).toBe("walk-screen-clearer");
    expect(bar().getAttribute("aria-label")).toBe("Slide 1");
    expect(live()!.textContent).toContain(WALK_COPY.answeredAccepted);
    await next();
    // The waiting step, live: its pill answers it.
    expect(bar().getAttribute("aria-label")).toBe("Slide 3");
    expect(live()!.querySelector("[data-testid='walk-keep']")).not.toBeNull();
    expect(arrow(COPY.pagerNext).disabled).toBe(true);
    await back();
    expect(bar().getAttribute("aria-label")).toBe("Slide 1");
    await back();
    await back();
    expect(screen()).toBe("walk-screen-praise");
    expect(arrow(COPY.pagerBack).disabled).toBe(true);
    expect(p.onAccept).not.toHaveBeenCalled();
    expect(p.onKeepMine).not.toHaveBeenCalled();
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
    // Nobody to judge and no summary to read: the walk lands on the page.
    // The chosen words are orange in the text at once. With the moment's
    // bookmark on the paragraph, a tap opens the moment first and then its
    // helper-words step (founder 2026-10-14), never the old sheet.
    await act(async () => undefined);
    expect(live()).toBeNull();
    const orange = paragraph("retention went up")!.querySelector<HTMLElement>(".walk-helper-word");
    expect(orange?.textContent).toBe("retention went");
    await click(orange);
    expect(screen()).toBe("walk-screen-praise");
    await click(live()!.querySelector("[data-testid='walk-forward']"));
    expect(screen()).toBe("walk-screen-helpers");
    expect(live()!.querySelector("[data-walk-nav]")!.getAttribute("aria-label")).toBe(`Slide 2 · ${WALK_COPY.navHelperWords}`);
    expect(document.querySelector("[data-testid='helper-words-card']")).toBeNull();
  });

  it("a guest's pick asks to sign up and writes nothing", async () => {
    const signUp = vi.fn(() => true);
    const p = props();
    await render(p, signUp);
    await render({ ...p, reviewRequest: 1 }, signUp);
    await click(live()!.querySelector("[data-testid='walk-forward']"));
    expect(screen()).toBe("walk-screen-helpers");
    const word = [...live()!.querySelectorAll<HTMLButtonElement>("[data-walk-word-picker] button")]
      .find((w) => w.textContent === "retention");
    signUp.mockClear();
    await click(word);
    expect(signUp).toHaveBeenCalled();
    expect(word!.getAttribute("aria-pressed")).not.toBe("true");
    // Going on from the step saves nothing for the guest.
    await click(live()!.querySelector("[data-testid='walk-forward']"));
    expect(p.onSetRootPhrase).not.toHaveBeenCalled();
    expect(p.onLockPart).not.toHaveBeenCalled();
    expect(vi.mocked(saveTakeFeedbackResponse)).not.toHaveBeenCalled();
    expect(paragraph("retention went up")!.querySelector(".walk-helper-word")).toBeNull();
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

  it("Accept and practise writes through the accept lane and leaves the speaker's words on the page", async () => {
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
    expect(paragraph("retention went up")!.textContent).toBe(SLIDES[1]);
    expect(container.querySelector("[data-chunk]")!.parentElement!.textContent).not.toContain("retention rose");
  });
});
