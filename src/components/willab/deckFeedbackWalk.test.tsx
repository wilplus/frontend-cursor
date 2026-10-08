// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  The Feedback walk mounted on the real deck, behind its switch (build plan  */
/*  D-FW-14; feedbackWalkOn).                                                  */
/*                                                                            */
/*  Off: the deck is exactly as it was (Review feedback opens the sheet).     */
/*  On: Review feedback opens the walk on the coach's note or the first       */
/*  praise; a tap on a paragraph with an open moment opens it there (Q-B3 A); */
/*  helper words picked in it go through the deck's own save; a guest's pick  */
/*  asks to sign up and writes nothing.                                       */
/* -------------------------------------------------------------------------- */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TranscriptReviewDeck from "./TranscriptReviewDeck";
import { GuestGateContext } from "./GuestSignUpDialog";
import { CHUNK_SHEET_COPY as COPY, WALK_COPY } from "./idealEditCopy";
import { coachWordKey, coachWordSeen } from "./coachWordSeen";
import { exerciseOf, judgementBehind, praiseWordsOf, rewriteOf } from "./useDeckFeedbackWalk";
import { saveTakeFeedbackResponse } from "@/services/api/takeFeedback";
import { PRAISE_CUE_COPY, PRAISE_LEAD } from "@/lib/willab/trackedChangeWhy";
import type { Part } from "@/lib/willab/documentParts";
import type { CoachMessage, DocumentSuggestion } from "@/services/api/idealText";

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
vi.mock("./useConfidentMomentBundle", () => ({
  useConfidentMomentBundle: () => ({ projection: null, status: "off", refresh: () => undefined }),
}));
vi.mock("./ConfidentMomentCoachingBundle", () => ({ default: () => null }));
vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: vi.fn(async () => "t") }));
vi.mock("@/hooks/useVisibleLearningExposure", () => ({
  useVisibleLearningExposure: () => undefined,
}));
/** The microphone, counted: the walk's practise must not open it with the
 *  switch off (D-FW-16). */
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
    armed: false,
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

const WORD: CoachMessage = {
  text: "Your opening landed. Keep the pause.",
  videoUrl: null,
  takeIndex: 2,
  publishedAt: "2026-10-06T09:00:00Z",
  takeSessionId: "take-2",
};

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
const walkOn = () => vi.stubEnv("NEXT_PUBLIC_FEEDBACK_WALK", "on");
const walk = () => document.querySelector("[data-feedback-walk]");
const live = () => document.querySelector<HTMLElement>("[data-feedback-walk] .walk-layer:not(.walk-ghost)");
const screen = () => live()?.querySelector<HTMLElement>("[data-testid^='walk-screen-']")?.dataset.testid ?? null;
const pager = () => document.querySelector('[data-testid="feedback-pager"]');
const click = async (el: Element | null | undefined) => {
  await act(async () => (el as HTMLElement).click());
};
const paragraph = (words: string) =>
  [...container.querySelectorAll<HTMLElement>("[data-chunk]")].find((el) => (el.textContent ?? "").includes(words));

describe("the switch off", () => {
  it("leaves the deck as it is: no walk, and Review feedback opens today's sheet", async () => {
    const p = props();
    await render(p);
    expect(walk()).toBeNull();
    await render({ ...p, reviewRequest: 1 });
    expect(walk()).toBeNull();
    expect(pager()).not.toBeNull();
  });

  it("a tap on the waiting paragraph opens today's sheet", async () => {
    await render(props());
    await click(paragraph("retention went up"));
    expect(walk()).toBeNull();
    expect(pager()).not.toBeNull();
  });
});

describe("the switch on", () => {
  it("Review feedback opens the walk on the first praise, not today's sheet", async () => {
    walkOn();
    const p = props();
    await render(p);
    expect(live()).toBeNull();
    await render({ ...p, reviewRequest: 1 });
    expect(screen()).toBe("walk-screen-praise");
    expect(live()!.className).toContain("walk-m-open");
    expect(pager()).toBeNull();
    expect(live()!.querySelector("[data-walk-message]")!.textContent).toBe(
      [PRAISE_LEAD, PRAISE_CUE_COPY.landed_ending].join(""),
    );
    expect(live()!.querySelector("[data-walk-nav]")!.getAttribute("aria-label")).toBe(
      `Slide 2 · ${COPY.pagerMoment} 1 ${COPY.pagerOf} 1`,
    );
  });

  it("opens on the coach's note when the coach left one, and marks it seen", async () => {
    walkOn();
    const p = props({ coachMessage: WORD });
    await render(p);
    await render({ ...p, reviewRequest: 1 });
    expect(screen()).toBe("walk-screen-coachnote");
    expect(live()!.querySelector("[data-walk-message]")!.textContent).toBe(WORD.text);
    expect(document.querySelector("[data-coach-message-step]")).toBeNull();
    expect(coachWordSeen(coachWordKey("arc-1", WORD))).toBe(true);
    await click(live()!.querySelector("[data-testid='walk-forward']"));
    expect(screen()).toBe("walk-screen-praise");
  });

  it("a tap on a paragraph with an open moment opens the walk there (Q-B3 A)", async () => {
    walkOn();
    await render(props());
    await click(paragraph("retention went up"));
    expect(screen()).toBe("walk-screen-praise");
    expect(pager()).toBeNull();
  });

  it("with nothing for this phase to show, Review feedback keeps today's sheet", async () => {
    walkOn();
    // A judgement with no snippet to save the answer on draws no screen.
    const p = props({ suggestions: [{ ...judgement, snippetId: null }] });
    await render(p);
    await render({ ...p, reviewRequest: 1 });
    expect(live()).toBeNull();
    // Today's walk across the bookmarks, its paragraph sheet drawn in the
    // walk's look with the switch on (D-IT-6): the ‹ › bar is the walk's.
    const sheet = document.querySelector('[data-walk-stage] [data-testid="paragraph-sheet"]');
    expect(sheet?.querySelector("[data-walk-nav]")).not.toBeNull();
    expect(pager()).toBeNull();
  });

  it("helper words picked in the walk go through the deck's own save: the words and the lock", async () => {
    walkOn();
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

  it("a guest's pick opens sign-up and writes nothing", async () => {
    walkOn();
    const block = vi.fn(() => true);
    const p = props();
    await render(p, block);
    await render({ ...p, reviewRequest: 1 }, block);
    await click(live()!.querySelector("[data-testid='walk-forward']"));
    const word = live()!.querySelector<HTMLButtonElement>("[data-walk-word-picker] button")!;
    await click(word);
    expect(block).toHaveBeenCalled();
    expect(word.getAttribute("aria-pressed")).toBe("false");
    expect(p.onSetRootPhrase).not.toHaveBeenCalled();
    expect(p.onLockPart).not.toHaveBeenCalled();
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

  it("the switch off: no walk, nothing decided, today's sheet", async () => {
    const p = props({ suggestions: [judgement, praise, rewrite] });
    await render(p);
    await render({ ...p, reviewRequest: 1 });
    expect(walk()).toBeNull();
    expect(pager()).not.toBeNull();
    expect(p.onAccept).not.toHaveBeenCalled();
  });

  it("draws the served words after the praise and its helper words", async () => {
    walkOn();
    await toClearer(props({ suggestions: [judgement, praise, rewrite] }));
    expect([...live()!.querySelectorAll("[data-walk-player] s")].map((n) => n.textContent)).toEqual(["went up"]);
    expect([...live()!.querySelectorAll("[data-walk-new-words] em")].map((n) => n.textContent)).toEqual(["rose"]);
    expect(live()!.querySelector("[data-testid='walk-forward']")!.textContent).toBe(COPY.pillAcceptPractise);
  });

  it("Accept and practise writes through the accept lane: the response, then the deck's onAccept", async () => {
    walkOn();
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

  it("Keep my words records the decline through the deck's onKeepMine and skips the practise", async () => {
    walkOn();
    const p = props({ suggestions: [judgement, praise, rewrite] });
    await toClearer(p);
    await click(live()!.querySelector("[data-testid='walk-keep']"));
    await act(async () => undefined);
    expect(vi.mocked(saveTakeFeedbackResponse)).toHaveBeenCalledWith(
      expect.objectContaining({ feedbackId: "s-rw", response: "keep_wording" }),
    );
    expect(p.onKeepMine).toHaveBeenCalledWith(expect.objectContaining({ id: "s-rw" }));
    expect(p.onAccept).not.toHaveBeenCalled();
    expect(screen()).not.toBe("walk-screen-clearer");
  });

  it("with personalised practice off the button reads Accept", async () => {
    walkOn();
    practice.on = false;
    await toClearer(props({ suggestions: [judgement, praise, rewrite] }));
    expect(live()!.querySelector("[data-testid='walk-forward']")!.textContent).toBe(WALK_COPY.clearerAccept);
  });
});

describe("rewriteOf", () => {
  it("is the served quote and proposal of a clearer-version replace, and nothing else", () => {
    expect(rewriteOf(rewrite)).toEqual({ quote: "retention went up", proposedText: "retention rose", item: rewrite });
    expect(rewriteOf({ ...rewrite, kind: "bold" })).toBeNull();
    expect(rewriteOf({ ...rewrite, proposedText: null })).toBeNull();
    expect(rewriteOf({ ...rewrite, feedbackFamily: "confident_voice" })).toBeNull();
    expect(rewriteOf({ ...rewrite, feedbackFamily: "confident_voice", openCard: "rewrite" })).not.toBeNull();
    expect(rewriteOf(praise)).toBeNull();
  });
});

describe("praiseWordsOf", () => {
  it("is the item's signed line when it carries one, else the sheet's own words", () => {
    expect(praiseWordsOf({ ...praise, praiseLine: "A signed line." })).toEqual(["A signed line."]);
    expect(praiseWordsOf(praise)).toEqual([PRAISE_LEAD, PRAISE_CUE_COPY.landed_ending]);
    expect(praiseWordsOf({ ...praise, tentative: true, cueKeys: ["unknown"] })).toEqual([COPY.praiseTentative]);
  });
});

describe("the practise in the walk (D-FW-16)", () => {
  /** The clearer version with the evidence a practise is opened on. */
  const practisable = {
    ...rewrite,
    evidence: { projectId: "arc-1", takeSessionId: "take-2", slideIndex: 1, paragraphIndex: 1, start: 0, end: 17 },
  } as unknown as DocumentSuggestion;
  const practiseCalls = () =>
    vi.mocked(fetch).mock.calls.map(([url]) => String(url)).filter((url) => url.includes("confidence-practice"));

  it("the switch off: no walk, no practise opened, no microphone", async () => {
    const p = props({ suggestions: [judgement, praise, practisable] });
    await render(p);
    await render({ ...p, reviewRequest: 1 });
    expect(walk()).toBeNull();
    expect(pager()).not.toBeNull();
    expect(mic.starts).toBe(0);
    expect(practiseCalls()).toEqual([]);
  });

  it("Accept and practise opens the practise on the served item's snippet, recording at once", async () => {
    walkOn();
    const p = props({ suggestions: [judgement, praise, practisable] });
    await render(p);
    await render({ ...p, reviewRequest: 1 });
    await click(live()!.querySelector("[data-testid='walk-forward']"));
    await click(live()!.querySelector("[data-testid='walk-skip']"));
    expect(screen()).toBe("walk-screen-clearer");
    await click(live()!.querySelector("[data-testid='walk-forward']"));
    await act(async () => undefined);
    expect(screen()).toBe("walk-screen-practise");
    expect(mic.starts).toBe(1);
    expect(practiseCalls()).toEqual(["/api/v2/user/snippets/snip-1/confidence-practice"]);
    expect(live()!.querySelector("[data-walk-say]")!.textContent).toBe("retention rose");
    await click(live()!.querySelector("button[aria-label='Close']"));
    expect(mic.cancels).toBeGreaterThan(0);
  });

  it("a served rewrite with nothing to open a practise on goes straight past it", async () => {
    walkOn();
    const p = props({ suggestions: [judgement, praise, rewrite] });
    await render(p);
    await render({ ...p, reviewRequest: 1 });
    await click(live()!.querySelector("[data-testid='walk-forward']"));
    await click(live()!.querySelector("[data-testid='walk-skip']"));
    await click(live()!.querySelector("[data-testid='walk-forward']"));
    expect(screen()).not.toBe("walk-screen-practise");
    expect(mic.starts).toBe(0);
  });
});

describe("the exercise in the walk (D-FW-17)", () => {
  const EVIDENCE = { projectId: "arc-1", takeSessionId: "take-2", slideIndex: 1, paragraphIndex: 1, start: 0, end: 17 };
  const OFFER = {
    exerciseId: "ex-1", version: 1, title: "Land it", instruction: "Let the last word fall.",
    introduction: "", yesIntroduction: "", noIntroduction: "",
    explanationVideoRef: "https://media/library-ex.mp4", passage: "retention went up",
    practiceId: null, resume: false, doneBefore: false, chosenByCoach: false,
  };
  /** The moment's Confident Voice item, its follow-up the exercise card. */
  const withExercise = (over: Record<string, unknown> = {}) =>
    ({ ...judgement, openCard: "exercise", evidence: EVIDENCE, practiceExercise: { ...OFFER, ...over } }) as unknown as DocumentSuggestion;
  const practiseCalls = () =>
    vi.mocked(fetch).mock.calls.map(([url]) => String(url)).filter((url) => url.includes("confidence-practice"));

  it("the switch off: no walk, no exercise video, nothing opened", async () => {
    const p = props({ suggestions: [withExercise(), praise] });
    await render(p);
    await render({ ...p, reviewRequest: 1 });
    expect(walk()).toBeNull();
    expect(pager()).not.toBeNull();
    expect(document.querySelector("[data-testid='walk-screen-exVideo']")).toBeNull();
    expect(mic.starts).toBe(0);
    expect(practiseCalls()).toEqual([]);
  });

  it("after the praise, the library exercise's video, then Practise opens the practise on it", async () => {
    walkOn();
    const p = props({ suggestions: [withExercise(), praise] });
    await render(p);
    await render({ ...p, reviewRequest: 1 });
    await click(live()!.querySelector("[data-testid='walk-forward']"));
    await click(live()!.querySelector("[data-testid='walk-skip']"));
    expect(screen()).toBe("walk-screen-exVideo");
    expect(live()!.querySelector("[data-coach-video] video")!.getAttribute("src")).toBe("https://media/library-ex.mp4");
    expect(container.textContent).not.toContain(COPY.coachWorkingOnExercise);
    await click(live()!.querySelector("[data-testid='walk-forward']"));
    await act(async () => undefined);
    expect(screen()).toBe("walk-screen-practise");
    expect(mic.starts).toBe(1);
    expect(practiseCalls()).toEqual(["/api/v2/user/snippets/snip-1/confidence-practice"]);
    expect(live()!.querySelector("[data-walk-say]")!.textContent).toBe("retention went up");
  });

  it("the coach's video wins over the library's; with no video the practise comes straight away", () => {
    expect(exerciseOf(withExercise({ chosenByCoach: true, explanationVideoRef: "https://media/coach.mp4" }))).toMatchObject({
      video: "https://media/coach.mp4",
      byCoach: true,
      instruction: "Let the last word fall.",
      say: "retention went up",
    });
    expect(exerciseOf(withExercise({ explanationVideoRef: "" }))!.video).toBeNull();
  });

  it("only where the follow-up names the exercise, or the coach chose it, and a practise can open", () => {
    // A praise moment carrying a library offer is praise, not an exercise.
    expect(exerciseOf({ ...withExercise(), openCard: "praise" } as DocumentSuggestion)).toBeNull();
    expect(exerciseOf({ ...withExercise({ chosenByCoach: true }), openCard: "praise" } as DocumentSuggestion)).not.toBeNull();
    expect(exerciseOf({ ...withExercise(), evidence: null } as DocumentSuggestion)).toBeNull();
    expect(exerciseOf(judgement)).toBeNull();
  });
});

describe("\"Judgement time!\" and the judgements in the walk (D-FW-18)", () => {
  const POST = {
    slug: "why-we-ask-you-to-judge-honestly",
    title: "Why we ask you to judge honestly",
    excerpt: "",
    category: "science",
    body: "The first paragraph.\n\nThe second paragraph.",
    author_name: "WillpowerLab",
  };
  let requests: { url: string; body: unknown }[];
  function serve(journal: "published" | "missing") {
    requests = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        requests.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
        if (url.endsWith("/api/v2/journal/posts/why-we-ask-you-to-judge-honestly") && journal === "published") {
          return new Response(JSON.stringify(POST), { status: 200, headers: { "Content-Type": "application/json" } });
        }
        if (url.endsWith("/moment-event")) {
          return new Response(JSON.stringify({ recorded: true, follow_up: "none" }), { status: 200 });
        }
        return new Response("{}", { status: 404 });
      }),
    );
  }
  const forward = () => click(live()!.querySelector("[data-testid='walk-forward']"));
  const skip = () => click(live()!.querySelector("[data-testid='walk-skip']"));
  const wait = (ms: number) => act(async () => new Promise((r) => setTimeout(r, ms)));
  /** Review feedback, past the praise and its helper words (skipped). */
  async function toIntro(p: ReturnType<typeof props>) {
    await render(p);
    await render({ ...p, reviewRequest: 1 });
    expect(screen()).toBe("walk-screen-praise");
    await forward();
    await skip();
    expect(screen()).toBe("walk-screen-intro");
  }

  it("the switch off: no walk, no Journal read, nothing judged", async () => {
    serve("published");
    const onJudged = vi.fn();
    const p = props({ onJudged });
    await render(p);
    await render({ ...p, reviewRequest: 1 });
    expect(walk()).toBeNull();
    expect(requests.some((r) => r.url.includes("/journal/"))).toBe(false);
    expect(onJudged).not.toHaveBeenCalled();
  });

  it("with only a judgement left, Review feedback opens \"Judgement time!\"", async () => {
    walkOn();
    serve("missing");
    const p = props({ suggestions: [judgement] });
    await render(p);
    await render({ ...p, reviewRequest: 1 });
    expect(screen()).toBe("walk-screen-intro");
  });

  it("the link opens the published post inside the walk; with none to read there is no link", async () => {
    walkOn();
    serve("published");
    await toIntro(props());
    expect(requests.filter((r) => r.url.endsWith("/api/v2/journal/posts/why-we-ask-you-to-judge-honestly"))).toHaveLength(1);
    await click(live()!.querySelector("[data-testid='walk-journal']"));
    expect(screen()).toBe("walk-screen-journal");
    expect(live()!.querySelector("[data-walk-journal-title]")!.textContent).toBe(POST.title);
    await click(live()!.querySelector("[data-testid='walk-journal-back']"));
    expect(screen()).toBe("walk-screen-intro");

    await act(async () => root.unmount());
    root = createRoot(container);
    serve("missing");
    await toIntro(props());
    expect(live()!.querySelector("[data-testid='walk-journal']")).toBeNull();
  });

  it("an answer saves the speaker's own Confident Voice answer through the feedback-response route, behind the screen", async () => {
    walkOn();
    serve("missing");
    const onJudged = vi.fn();
    await toIntro(props({ onJudged }));
    await forward();
    expect(screen()).toBe("walk-screen-judge");
    await click(live()!.querySelector("[data-walk-answer='yes']"));
    expect(saveTakeFeedbackResponse).not.toHaveBeenCalled();
    await wait(320);
    expect(saveTakeFeedbackResponse).toHaveBeenCalledTimes(1);
    expect(vi.mocked(saveTakeFeedbackResponse).mock.calls[0][0]).toMatchObject({
      takeSessionId: "take-2",
      feedbackId: "s-cv",
      feedbackFamily: "confident_voice",
      response: "yes",
    });
    expect(onJudged).toHaveBeenCalledWith(expect.objectContaining({ id: "s-cv" }), "approved");
    expect(document.querySelector("[data-walk-toast]")!.textContent).toBe("Yes ✓");
    expect(requests.some((r) => r.url.endsWith("/moment-event"))).toBe(false);
  });

  it("Skip settles the moment as skipped: a moment event, its bar cleared, no answer written", async () => {
    walkOn();
    serve("missing");
    const onJudged = vi.fn();
    await toIntro(props({ onJudged }));
    await skip();
    await wait(0);
    const events = requests.filter((r) => r.url.endsWith("/moment-event"));
    expect(events).toHaveLength(1);
    expect(events[0].url).toContain("/api/v2/user/snippets/snip-1/moment-event");
    expect(events[0].body).toMatchObject({ event: "skipped" });
    expect(onJudged).toHaveBeenCalledWith(expect.objectContaining({ id: "s-cv" }), "dismissed");
    expect(saveTakeFeedbackResponse).not.toHaveBeenCalled();
    expect(live()).toBeNull();
  });
});

describe("judgementBehind (QA1 A)", () => {
  it("sends only a change; a changed answer's 200 `revised` is a save; a replaced Take is final", async () => {
    const save = vi.mocked(saveTakeFeedbackResponse);
    save.mockClear();
    expect(await judgementBehind({ item: judgement, answer: "yes", earlier: "yes" })).toBe("ok");
    expect(save).not.toHaveBeenCalled();
    save.mockResolvedValueOnce({ ok: true, revised: true });
    expect(await judgementBehind({ item: judgement, answer: "no", earlier: "yes" })).toBe("ok");
    expect(save.mock.calls[0][0]).toMatchObject({ feedbackFamily: "confident_voice", response: "no" });
    save.mockResolvedValueOnce({ ok: false, error: "x", reason: "superseded" });
    expect(await judgementBehind({ item: judgement, answer: "yes", earlier: null })).toBe("final");
    save.mockResolvedValueOnce({ ok: false, error: null });
    expect(await judgementBehind({ item: judgement, answer: "yes", earlier: null })).toBe("failed");
  });
});
