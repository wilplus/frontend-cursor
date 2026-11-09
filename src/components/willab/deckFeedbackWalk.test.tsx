// @vitest-environment jsdom
/*
STORY    As a speaker reviewing feedback, I want the walk to open on my
         first praise, move through its chat with ‹ ›, save
         helper words through the deck, and ask a guest to sign up, so that
         feedback flows into my next Take.
OUTCOME
  O1  Review feedback opens the walk on the first praise; the bar names
      its slide by the slide's title in my deck (backend N397).
  O2  The arrows move through the walk's chat, step by step, without
      answering anything or closing it.
  O3  A tap on a paragraph, with or without its black line, opens the same walk at what it asks (its
      praise just above it in the chat) and, once answered, lands back on
      the Ideal Text. Tapped again with nothing left, the text or its
      orange words, it opens the whole walk to scroll through, at the
      helper words it answered, with no buttons.
  O4  Helper words picked in the walk are saved through the deck's own
      save (the words, then the lock) and show orange in the text at once.
  O5  Never-5: Accept and practise saves the answer through the accept lane,
      and the deck still shows the speaker's own words, not the clearer ones.
  O6  A guest's pick asks to sign up, is not taken, and nothing is written.
  O7  A moment the walk went past (its helper words skipped, its practise
      skipped) loses its black line at once and is told to the server; its
      paragraph then opens the walk as given, never its practise again.
  O8  A moment whose voice sounded confident and whose words are reworded
      offers its helper words after the rewording; one whose voice did not,
      only the rewording (N113).
  O9  The One thing walk on the deck: their best, then the one fix; after
      "Keep mine" and a skipped try, the helper words come on their own
      through the deck's own save (the lock, then the words), marked whole
      (N323 item 2), both moments lose their black line, and Close under
      "Lesson done." asks the summary once and goes back to the chat (N309);
      other speakers' moment is asked as the walk opens (N309 item 2);
      ✕ on the finished walk asks it once too, so the chat after the walk
      always comes (C9, B11), but not for an older Take played again under
      a newer Take, nor when the chat cannot tell (D4, between two Takes);
      a page opened again while it is still written never asks it twice;
      a finished Take's page opened later asks it with the try and the
      helper words its chat kept (D2, E1).
  O10 With no moment to fix, the pace game is the One thing walk's fix,
      and its opening keeps its tip, "give “{words}” more room" with the
      Sniper's helper words, in the chat for "Last time" next Take (N347
      item 3), a slow stretch's "keep “{words}” moving" (N459 item 2); its scale names its zones "too slow", "just right", "too
      fast", and Skip gets "Okay, we'll skip this one." in the walk and the
      chat (N405). The chat says "And here's one moment to try another way:", the
      stretch's clip and the Sniper's line in the walk's order (E2).
  O11 The walk opens whole, behind the wait: my name in the hello and Last
      time from the server's tip before my best, never longer than its
      bound (C0, C0a, A2).
  O12 A walk closed during its Clearer version's try opens again on the
      Clearer version, never the AI clip (N381).
  O13 A Sniper only opened, then left with ✕ before a try, is still to
      play: a door opened while the Take still waits plays it live, with
      its Try it and Skip (B10, T).
PROVES   O1 -> "Review feedback opens the walk on the first praise, not today's sheet"
         O2 -> "‹ › move through the walk's chat, never answering and never
                closing it (founder 2026-10-20)"
         O3 -> "a paragraph with or without the line opens the same walk at
                what it asks, its buttons as the step stands (founder
                2026-10-20, N89)"
         O4 -> "helper words picked in the walk go through the deck's own
                save: the words and the lock"
         O5 -> "Accept and practise writes through the accept lane and leaves the speaker's words on the page"
         O6 -> "a guest's pick asks to sign up and writes nothing"
         O7 -> "a moment walked through loses its black line and opens as
                given, never its practise again (founder 2026-10-21)"
         O8 -> "a confident voice whose words are reworded gets its helper
                words after the rewording (founder 2026-10-22, N113)"
         O9 -> "the One thing walk saves its helper words without a pick, settles both moments and asks the summary once at Close (N309)",
               "✕ on the finished walk asks the summary once, as Close does, so the chat after the walk comes (C9, B11)",
               "an older Take's finished walk, played again and closed with ✕ under a newer Take, asks no summary (D4, between two Takes)",
               "a page opened again while the summary is still written asks it no second time, the dots on until it ends (C9, D4)",
               "a finished Take's page opened later asks the summary with the try and the helper words its chat kept (D2, E1)"
         O10 -> "the pace game as the walk's fix keeps its tip in the chat, for Last time next Take (N347 item 3)",
                "a slow stretch as the walk's fix keeps its own tip, for Last time next Take (N459 item 2)"
         O11 -> "the walk opens whole, behind the wait: my name in the hello and Last time from the server's tip, before my best (C0, C0a)",
                "the walk never waits on its reads past its bound: a profile that never answers opens it with \"Hi.\""
         O12 -> "a walk closed during its Clearer version's try opens again on the Clearer version, never the AI clip (N381)"
         O13 -> "a Sniper opened, then left with ✕ before a try, is played live from a door while the Take still waits (B10, T)"
WHY      Feedback walk lock 2026-10-06/2026-10-12; founder 2026-10-21 ("the
         black lines on the ideal text are still there even though I walked
         through them"); 2026-10-22 (N113, "After the rewording"). The
         paragraph sheet's
         accept lane is in acceptRewrite.test.tsx.
*/
import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TranscriptReviewDeck from "./TranscriptReviewDeck";
import { WALK_OPEN_WAIT_MS } from "./useDeckFeedbackWalk";
import { GuestGateContext } from "./GuestSignUpDialog";
import { CHUNK_SHEET_COPY as COPY, ONE_THING_COPY, WALK_COPY } from "./idealEditCopy";
import { TEMPO_COPY } from "@/lib/willab/tempoStep";
import { tipSaid } from "@/lib/willab/walkLines";
import { saveTakeFeedbackResponse } from "@/services/api/takeFeedback";
import { reportMomentEvent } from "@/services/api/momentEvents";
import { PRAISE_CUE_COPY, PRAISE_LEAD } from "@/lib/willab/trackedChangeWhy";
import type { Part } from "@/lib/willab/documentParts";
import type { DocumentSuggestion } from "@/services/api/idealText";
import { FOUNDER_EMAIL } from "@/lib/founder";
import { forgetSharedUserProfile } from "@/services/api/userProfile";

vi.mock("@/services/api/takeFeedback", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/api/takeFeedback")>()),
  saveTakeFeedbackResponse: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/services/api/momentEvents", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/api/momentEvents")>()),
  reportMomentEvent: vi.fn(async () => ({ kind: "recorded", followUp: "none" })),
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
vi.mock("@/hooks/useDualCaptureMic", async () => {
  const React = await import("react");
  type State = { status: "idle" } | { status: "recording"; partialText: string } | { status: "stopped"; finalText: string; audioBlob: Blob; durationSec: number };
  return {
    useDualCaptureMic: () => {
      const [state, setState] = React.useState<State>({ status: "idle" });
      return {
        state,
        start: async () => {
          mic.starts += 1;
          setState({ status: "recording", partialText: "" });
        },
        stop: async () => setState({ status: "stopped", finalText: "", audioBlob: new Blob(["x".repeat(2000)]), durationSec: 4 }),
        cancel: () => {
          mic.cancels += 1;
          setState({ status: "idle" });
        },
        getAudioStartedAt: () => null,
        getPausedMs: () => 0,
      };
    },
  };
});
vi.mock("@/components/results/MediaPlayer", () => ({ default: () => createElement("div") }));
vi.mock("@/services/api/bookmarkHistory", () => ({
  fetchOwnerAnswers: vi.fn(async () => []),
  fetchParagraphHistory: vi.fn(async () => null),
}));
/** The Lounge thread the walk posts into; none outside it. Who is signed
 *  in: the founder sees the tempo step (O10). */
const chat = vi.hoisted(() => ({ thread: null as unknown }));
vi.mock("./LoungeThreadContext", () => ({ useLoungeThreadMaybe: () => chat.thread }));
const who = vi.hoisted(() => ({ email: null as string | null }));
vi.mock("./useUserEmail", () => ({ useUserEmail: () => who.email }));

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
  chat.thread = null;
  who.email = null;
  mic.starts = 0;
  mic.cancels = 0;
  vi.mocked(saveTakeFeedbackResponse).mockClear();
  vi.mocked(reportMomentEvent).mockClear();
  window.localStorage.clear();
  // Nothing served but the tempo route's "no stretch", which the walk's
  // opening waits for (`walkReady`); a failed read would be asked again.
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) =>
    String(input).includes("/review/tempo/")
      ? new Response(JSON.stringify({ tempo: null }), { status: 200, headers: { "Content-Type": "application/json" } })
      : new Response("{}", { status: 404 }),
  ));
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
    expect(live()!.querySelector("[data-walk-part] [data-walk-message]")!.textContent).toBe(
      [COPY.titlePraise, [PRAISE_LEAD, PRAISE_CUE_COPY.landed_ending].join(" ")].join(""),
    );
    // The bar names the slide by its title in the deck, not "Slide 2" (backend N397).
    expect(live()!.querySelector("[data-walk-nav]")!.getAttribute("aria-label")).toBe("Results");
  });

  it("‹ › move through the walk's chat, never answering and never closing it (founder 2026-10-20)", async () => {
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
    expect(bar().getAttribute("aria-label")).toBe("Results");
    // The newest step is the last in the chat: › is off, and so is ‹ on the
    // first step.
    expect(arrow(COPY.pagerBack).disabled).toBe(true);
    expect(arrow(COPY.pagerNext).disabled).toBe(true);
    await click(live()!.querySelector("[data-testid='walk-forward']"));
    expect(screen()).toBe("walk-screen-helpers");
    expect(bar().getAttribute("aria-label")).toBe(`Results · ${WALK_COPY.navHelperWords}`);
    // ‹ goes up the chat; it answers nothing and closes nothing.
    expect(arrow(COPY.pagerBack).disabled).toBe(false);
    await back();
    await next();
    expect(screen()).toBe("walk-screen-helpers");
    expect(live()).not.toBeNull();
    expect(p.onAccept).not.toHaveBeenCalled();
    expect(p.onKeepMine).not.toHaveBeenCalled();
  });

  it("a paragraph with or without the line opens the same walk at what it asks, its buttons as the step stands (founder 2026-10-20, N89)", async () => {
    const p = props();
    await render(p);
    await click(paragraph("retention went up"));
    // The helper words first, the confident moment just above them, in the
    // Take's whole walk (one mechanism: the same door as a Lounge bubble).
    expect(screen()).toBe("walk-screen-helpers");
    expect(live()!.querySelector("[data-walk-part] [data-walk-message]")!.textContent).toContain(COPY.titlePraise);
    // The confident moment met above them still reaches the coach's queue.
    expect(reportMomentEvent).toHaveBeenCalledWith("snip-1", "opened", ["praise"]);
    // The step's own buttons: the picker's pill is there.
    expect(live()!.querySelector("[data-walk-dock]")!.childElementCount).toBeGreaterThan(0);
    const word = [...live()!.querySelectorAll<HTMLButtonElement>("[data-walk-word-picker] button")]
      .find((w) => w.textContent === "retention");
    await click(word);
    await click(live()!.querySelector("[data-testid='walk-forward']"));
    expect(p.onSetRootPhrase).toHaveBeenCalledTimes(1);
    // The one moment answered, the walk runs on to its end, onto the page.
    await act(async () => undefined);
    expect(live()).toBeNull();
    // Tapped again, the text or its orange words: the same walk as given,
    // open on the helper words it answered, the parts before and after
    // there to scroll, the newest part keeping the dock (founder
    // 2026-10-21).
    const opensAgain = async (el: Element | null | undefined) => {
      await click(el);
      await act(async () => undefined);
      expect(live()!.querySelector("[data-testid='walk-screen-helpers']")).not.toBeNull();
      expect(live()!.querySelector("[data-walk-dock]")!.childElementCount).toBeGreaterThan(0);
      await click(live()!.querySelector("button[aria-label='Close']"));
      await act(async () => undefined);
      expect(live()).toBeNull();
    };
    await opensAgain(paragraph("retention went up"));
    await opensAgain(paragraph("retention went up")!.querySelector(".walk-helper-word"));
  });

  it("a moment walked through loses its black line and opens as given, never its practise again (founder 2026-10-21)", async () => {
    // Slide 2's praise and slide 3's correction, said again: the Take's most
    // confident moment, so the walk never passes it by (N109).
    const slide3 = text.indexOf("one more quarter");
    const moment3 = {
      ...judgement, id: "s-cv3", start: slide3, end: slide3 + "one more quarter".length,
      quote: "one more quarter", blockId: "block-3", snippetId: "snip-3", highestMoment: true,
      evidence: { projectId: "arc-1", takeSessionId: "take-2", slideIndex: 2, paragraphIndex: 2, start: 0, end: 16 },
    } as unknown as DocumentSuggestion;
    // The page keeps what the walk settles, as the Ideal Text does.
    function Page(over: { reviewRequest?: number }) {
      const [suggestions, setSuggestions] = useState<DocumentSuggestion[]>([judgement, praise, moment3]);
      return createElement(TranscriptReviewDeck, {
        ...props({ suggestions }),
        ...over,
        onJudged: (s: DocumentSuggestion, status: "approved" | "dismissed") =>
          setSuggestions((all) => all.map((x) => (x.id === s.id ? { ...x, status } : x))),
      });
    }
    const line = (words: string) => paragraph(words)!.className.includes("before:bg-foreground");
    await act(async () => root.render(createElement(Page, {})));
    expect(line("retention went up")).toBe(true);
    expect(line("one more quarter")).toBe(true);
    await act(async () => root.render(createElement(Page, { reviewRequest: 1 })));
    expect(screen()).toBe("walk-screen-praise");
    await click(live()!.querySelector("[data-testid='walk-forward']"));
    await click(live()!.querySelector("[data-testid='walk-skip']"));
    // Past the helper words: slide 2 is answered, its line goes at once.
    expect(line("retention went up")).toBe(false);
    expect(reportMomentEvent).toHaveBeenCalledWith("snip-1", "skipped");
    // Slide 3: Practise. The recorder has no Skip (founder 2026-11-03):
    // three tries nothing answers, then Next.
    await click(live()!.querySelector("[data-testid='walk-practise']"));
    expect(live()!.querySelector("[data-walk-dock] [data-testid='walk-skip']")).toBeNull();
    for (let i = 0; i < 3; i += 1) {
      await click(live()!.querySelector("[data-walk-dock] button[aria-label='Stop']"));
      await act(async () => undefined);
      if (i < 2) await click(live()!.querySelector("[data-testid='walk-again']"));
    }
    await click(live()!.querySelector("[data-testid='walk-forward']"));
    await act(async () => undefined);
    expect(line("one more quarter")).toBe(false);
    expect(reportMomentEvent).toHaveBeenCalledWith("snip-3", "skipped");
    // Nothing else to walk: onto the page.
    expect(live()).toBeNull();
    // Tapped, the paragraph opens the walk as given: Next, no Practise.
    await click(paragraph("one more quarter"));
    await act(async () => undefined);
    expect(live()).not.toBeNull();
    expect(live()!.querySelector("[data-testid='walk-practise']")).toBeNull();
    expect(live()!.querySelector("[data-walk-dock] [data-testid='walk-forward']")!.textContent).toBe(COPY.pagerNext);
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
    // The chosen words are orange in the text at once.
    await act(async () => undefined);
    expect(live()).toBeNull();
    const orange = paragraph("retention went up")!.querySelector<HTMLElement>(".walk-helper-word");
    expect(orange?.textContent).toBe("retention went");
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

  it("a confident voice whose words are reworded gets its helper words after the rewording (founder 2026-10-22, N113)", async () => {
    // Practice off, so Accept moves straight on.
    practice.on = false;
    for (const confident of [true, false]) {
      // Served as V3 serves it: the moment corrected with its Clearer
      // version, flagged when its voice reached the floor.
      const moment = {
        ...judgement, bookmarkTier: "standard", practicePrompt: true, helperWordsPrompt: confident,
      } as unknown as DocumentSuggestion;
      await render(props({ suggestions: [moment, rewrite] }));
      await render({ ...props({ suggestions: [moment, rewrite] }), reviewRequest: confident ? 1 : 2 });
      expect(screen()).toBe("walk-screen-clearer");
      await click(live()!.querySelector("[data-testid='walk-forward']"));
      await act(async () => undefined);
      if (confident) {
        expect(screen()).toBe("walk-screen-helpers");
        expect(live()!.querySelector("[data-walk-word-picker] button")).not.toBeNull();
      } else {
        expect(live()?.querySelector("[data-testid='walk-screen-helpers']") ?? null).toBeNull();
      }
      await act(async () => root.unmount());
      root = createRoot(container);
    }
  });
});


describe("the One thing walk on the deck (founder 2026-10-31, N309)", () => {
  const first = SLIDES[0].indexOf("Today I want");
  /** Their best on slide 1 (the strongest). */
  const best = {
    ...base, id: "s-best", start: first, end: first + 12, quote: "Today I want", blockId: "block-1",
    feedbackFamily: "confident_voice", source: "confident_voice", openCard: "praise",
    bookmarkTier: "confident", highestMoment: true, walkSlot: "strongest", snippetId: "snip-best",
    praiseLine: "Smooth and steady, no stumbling. That sounded confident!",
  } as unknown as DocumentSuggestion;

  it("the One thing walk saves its helper words without a pick, settles both moments and asks the summary once at Close (N309)", async () => {
    // Their best on slide 1; the one fix on slide 2, its Clearer version
    // (the between).
    const fix = {
      ...base, id: "s-fix", start: at, kind: "replace", proposedText: "retention rose",
      feedbackFamily: "rewrite_clarity", source: "new_take", blockKey: 2, bookmarkTier: "standard",
      practicePrompt: true, walkSlot: "between",
      evidence: { projectId: "arc-1", takeSessionId: "take-2", slideIndex: 1, paragraphIndex: 1, start: 0, end: 17 },
    } as unknown as DocumentSuggestion;
    const fixVoice = { ...judgement, bookmarkTier: "standard", practicePrompt: true, walkSlot: "between" } as unknown as DocumentSuggestion;
    const onClose = vi.fn();
    const append = vi.fn(async (draft: unknown) => draft);
    chat.thread = { messages: [], loading: false, append, reload: vi.fn(async () => undefined) };
    const p = props({ suggestions: [best, fixVoice, fix], onLensClose: onClose });
    await render(p);
    await render({ ...p, reviewRequest: 1 });
    expect(screen()).toBe("walk-screen-praise");
    // Other speakers' moment is asked as the walk opens, so it is there
    // when the walk gets to it (N309 item 2): Take 2's level is high.
    const queued = vi.mocked(fetch).mock.calls.map((c) => String(c[0])).filter((u) => u.includes("/communities/queue"));
    expect(queued).toEqual([expect.stringContaining("take=take-2&level=high")]);
    expect(live()!.textContent).toContain("Why it worked: smooth and steady, no stumbling.");
    await click(live()!.querySelector("[data-testid='walk-forward']"));
    expect(screen()).toBe("walk-screen-clearer");
    await click(live()!.querySelector("[data-testid='walk-keep']"));
    expect(p.onKeepMine).toHaveBeenCalled();
    // Their own sentence, on the recorder; its trash is the Skip (N435 item 3).
    expect(screen()).toBe("walk-screen-practise");
    // The walk's answer stays in the chat too, once (N452 item 1).
    const drafts = () => append.mock.calls.map(([d]) => d as { body: string; metadata: Record<string, unknown> });
    expect(drafts().filter((d) => d.metadata.step === "practise").map((d) => d.body)).toEqual([ONE_THING_COPY.keepWords]);
    await click(live()!.querySelector("[data-walk-dock] button[aria-label='Delete']"));
    await act(async () => undefined);
    // The helper words, on their own: "retention went up", their own words,
    // through the deck's save (the lock, then the words), no picker.
    expect(live()!.querySelector("[data-walk-word-picker]")).toBeNull();
    expect(live()!.querySelector("[data-walk-helper-words]")!.textContent).toBe("retention went up");
    const chunkOf = (call: unknown[]) => (call[0] as { part: { id: string } }).part.id;
    expect((p.onLockPart.mock.calls as unknown[][]).map(chunkOf)).toEqual(["p2"]);
    expect((p.onSetRootPhrase.mock.calls as unknown[][]).map((c) => [chunkOf(c), (c[1] as { text: string }).text])).toEqual([
      ["p2", "retention went up"],
    ]);
    // The walk's own words go whole, past the cap on a pick by hand (N323
    // item 2).
    expect((p.onSetRootPhrase.mock.calls as unknown[][])[0][1]).toMatchObject({ whole: true });
    // Both moments were told to the server as walked past.
    expect(vi.mocked(reportMomentEvent).mock.calls.map((c) => c[0])).toEqual(expect.arrayContaining(["snip-best", "snip-1"]));
    expect(screen()).toBe("walk-screen-done");
    const fetched = () => vi.mocked(fetch).mock.calls.map((c) => String(c[0])).filter((u) => u.includes("/review/summary"));
    expect(fetched()).toEqual([]);
    await click(live()!.querySelector("[data-testid='walk-close']"));
    expect(fetched()).toHaveLength(1);
    expect(onClose).toHaveBeenCalled();
  });

  it("✕ on the finished walk asks the summary once, as Close does, so the chat after the walk comes (C9, B11)", async () => {
    const onClose = vi.fn();
    // The chat's newest recording is this Take's own (D4, between two
    // Takes), and the chat keeps what the walk posts.
    const recorded = { client_id: "rec-2", role: "system", kind: "recording_summary", body: "", metadata: { session_id: "take-2", arc_id: "arc-1", take_index: 2 }, client_created_at: "" };
    const thread = {
      messages: [recorded] as unknown[],
      loading: false,
      append: vi.fn(async (d: { clientId: string; role: string; kind: string; body: string; metadata: Record<string, unknown> }) => {
        thread.messages = [...thread.messages, { client_id: d.clientId, role: d.role, kind: d.kind, body: d.body, metadata: d.metadata, client_created_at: "" }];
        return d;
      }),
      reload: vi.fn(async () => undefined),
    };
    chat.thread = thread;
    const p = props({ suggestions: [best], onLensClose: onClose });
    await render(p);
    await render({ ...p, reviewRequest: 1 });
    expect(screen()).toBe("walk-screen-praise");
    await click(live()!.querySelector("[data-testid='walk-forward']"));
    await act(async () => undefined);
    expect(screen()).toBe("walk-screen-done");
    const fetched = () => vi.mocked(fetch).mock.calls.map((c) => String(c[0])).filter((u) => u.includes("/review/summary"));
    expect(fetched()).toEqual([]);
    await click(live()!.querySelector("button[aria-label='Close']"));
    await act(async () => undefined);
    expect(fetched()).toHaveLength(1);
    expect(onClose).toHaveBeenCalled();
  });

  it("an older Take's finished walk, played again and closed with ✕ under a newer Take, asks no summary (D4, between two Takes)", async () => {
    // Take 2 of this project ended with no summary; a Take of another
    // project was recorded since, so the chat's newest recording is its.
    const row = (client_id: string, kind: string, metadata: Record<string, unknown>, role = "bot") => ({ client_id, role, kind, body: "", metadata, client_created_at: "" });
    const messages = [
      row("rec-2", "recording_summary", { session_id: "take-2", arc_id: "arc-1", take_index: 2 }, "system"),
      row("end-2", "walk_step", { step: "end", take_session_id: "take-2", arc_id: "arc-1", take_index: 2 }),
      row("rec-b1", "recording_summary", { session_id: "take-b1", arc_id: "arc-b", take_index: 1 }, "system"),
    ];
    chat.thread = { messages, loading: false, append: vi.fn(async (draft: unknown) => draft), reload: vi.fn(async () => undefined), setWriting: vi.fn() };
    const p = props({ suggestions: [{ ...best, status: "approved" } as DocumentSuggestion] });
    await render(p);
    await act(async () => undefined);
    const fetched = () => vi.mocked(fetch).mock.calls.map((c) => String(c[0])).filter((u) => u.includes("/review/summary"));
    // The page opening asks nothing either.
    expect(fetched()).toEqual([]);
    await render({ ...p, replayRequest: 1 } as typeof p);
    await act(async () => undefined);
    expect(screen()).toBe("walk-screen-praise");
    await click(live()!.querySelector("button[aria-label='Close']"));
    await act(async () => undefined);
    expect(fetched()).toEqual([]);
  });

  it("a page opened again while the summary is still written asks it no second time, the dots on until it ends (C9, D4)", async () => {
    let answer: (r: Response) => void = () => undefined;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/review/summary")) return new Promise<Response>((done) => (answer = done));
      if (url.includes("/review/tempo/")) return new Response(JSON.stringify({ tempo: null }), { status: 200, headers: { "Content-Type": "application/json" } });
      return new Response("{}", { status: 404 });
    }));
    const row = (client_id: string, kind: string, metadata: Record<string, unknown>, role = "bot") => ({ client_id, role, kind, body: "", metadata, client_created_at: "" });
    const messages = [
      row("rec-2", "recording_summary", { session_id: "take-2", arc_id: "arc-1", take_index: 2 }, "system"),
      row("end-2", "walk_step", { step: "end", take_session_id: "take-2", arc_id: "arc-1", take_index: 2 }),
    ];
    const setWriting = vi.fn();
    chat.thread = { messages, loading: false, append: vi.fn(async (draft: unknown) => draft), reload: vi.fn(async () => undefined), setWriting };
    const p = props({ suggestions: [{ ...best, status: "approved" } as DocumentSuggestion] });
    const fetched = () => vi.mocked(fetch).mock.calls.map((c) => String(c[0])).filter((u) => u.includes("/review/summary"));
    // The finished Take's page asks as it opens, then is closed and opened
    // again while the summary is still being written.
    await render(p);
    await act(async () => undefined);
    expect(fetched()).toHaveLength(1);
    await act(async () => root.unmount());
    root = createRoot(container);
    await render(p);
    await act(async () => undefined);
    expect(fetched()).toHaveLength(1);
    expect(setWriting.mock.calls).toEqual([[true]]);
    // The one ask ends (here, failed): the dots go, and a later end may ask again.
    await act(async () => answer(new Response("{}", { status: 404 })));
    expect(setWriting.mock.calls).toEqual([[true], [false]]);
  });

  it("a finished Take's page opened later asks the summary with the try and the helper words its chat kept (D2, E1)", async () => {
    // The walk ended at "Lesson done." with no Close: its try landed and
    // the speaker picked their words, all kept in the chat, no summary yet.
    const row = (client_id: string, kind: string, metadata: Record<string, unknown>, role = "bot", body = "") => ({ client_id, role, kind, body, metadata, client_created_at: "" });
    const step = (step: string, author = "app") => ({ step, author, take_session_id: "take-2", arc_id: "arc-1", take_index: 2 });
    const messages = [
      row("rec-2", "recording_summary", { session_id: "take-2", arc_id: "arc-1", take_index: 2 }, "system"),
      row("improved-2", "walk_step", step("improved"), "bot", "That sounded clearer."),
      row("words-2", "walk_step", step("words:p2:retention went up", "speaker"), "user", "retention went up"),
      row("end-2", "walk_step", step("end")),
    ];
    chat.thread = { messages, loading: false, append: vi.fn(async (draft: unknown) => draft), reload: vi.fn(async () => undefined), setWriting: vi.fn() };
    await render(props({ suggestions: [{ ...best, status: "approved" } as DocumentSuggestion] }));
    await act(async () => undefined);
    const asked = vi.mocked(fetch).mock.calls.filter((c) => String(c[0]).includes("/review/summary"));
    expect(asked).toHaveLength(1);
    expect(JSON.parse(String((asked[0][1] as RequestInit).body))).toMatchObject({ practice: "better", helper_words: ["retention went up"] });
  });

  it("the walk opens whole, behind the wait: my name in the hello and Last time from the server's tip, before my best (C0, C0a)", async () => {
    // The profile answers late; the walk waits for it, never saying "Hi."
    // first and swapping it in place.
    let named: (r: Response) => void = () => undefined;
    const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/user/profile")) return new Promise<Response>((done) => (named = done));
      if (url.includes("/review/last-fix/take-2")) {
        return json({ last: { kind: "voice", slide_index: 0, clip: { url: "https://media/last.wav", snippet_id: "snip-best" } }, tip: "Lean on “today”" });
      }
      if (url.includes("/review/tempo/")) return json({ tempo: null });
      return new Response("{}", { status: 404 });
    }));
    forgetSharedUserProfile();
    try {
      const p = props({ suggestions: [best] });
      await render(p);
      await render({ ...p, reviewRequest: 1 });
      expect(live()).toBeNull();
      await act(async () => named(json({ first_name: "Maya" })));
      expect(screen()).toBe("walk-screen-praise");
      expect(live()!.querySelector("[data-walk-hello]")!.textContent).toBe("Hi Maya.");
      // The tip the server read from the last walk's fix step: the chat need
      // not hold it (C-LASTFIX).
      expect(live()!.querySelector("[data-walk-last]")!.textContent).toBe(ONE_THING_COPY.lastTime("lean on “today”"));
    } finally {
      forgetSharedUserProfile();
    }
  });

  it("the walk never waits on its reads past its bound: a profile that never answers opens it with \"Hi.\"", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes("/user/profile") ? new Promise<Response>(() => undefined) : new Response("{}", { status: 404 }),
    ));
    forgetSharedUserProfile();
    try {
      const p = props({ suggestions: [best] });
      await render(p);
      await render({ ...p, reviewRequest: 1 });
      expect(live()).toBeNull();
      await act(async () => {
        vi.advanceTimersByTime(WALK_OPEN_WAIT_MS);
      });
      expect(screen()).toBe("walk-screen-praise");
      expect(live()!.querySelector("[data-walk-hello]")!.textContent).toBe(ONE_THING_COPY.hello(null));
    } finally {
      vi.useRealTimers();
      forgetSharedUserProfile();
    }
  });

  it("a walk closed during its Clearer version's try opens again on the Clearer version, never the AI clip (N381)", async () => {
    // "Keep mine" was tapped: the rewrite is decided, the moment still waits.
    const kept = {
      ...base, id: "s-fix", start: at, kind: "replace", proposedText: "retention rose", status: "dismissed",
      feedbackFamily: "rewrite_clarity", source: "new_take", blockKey: 2, bookmarkTier: "standard",
      practicePrompt: true, walkSlot: "between",
    } as unknown as DocumentSuggestion;
    const fixVoice = { ...judgement, bookmarkTier: "standard", practicePrompt: true, walkSlot: "between" } as unknown as DocumentSuggestion;
    const p = props({ suggestions: [best, fixVoice, kept] });
    await render(p);
    await render({ ...p, reviewRequest: 1 });
    expect(screen()).toBe("walk-screen-praise");
    await click(live()!.querySelector("[data-testid='walk-forward']"));
    expect(screen()).toBe("walk-screen-clearer");
  });

  it("the pace game as the walk's fix keeps its tip in the chat, for Last time next Take (N347 item 3)", async () => {
    who.email = FOUNDER_EMAIL;
    const append = vi.fn(async (draft: unknown) => draft);
    chat.thread = { messages: [], loading: false, append, reload: vi.fn(async () => undefined) };
    // No moment to fix: the Take's rushed stretch is the fix, the pace game.
    // The stretch as said, hesitation and case and all, is found in the
    // smoothed paragraph all the same, on the slide the answer names.
    const stretch = "retention went up, churn went down";
    const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes("/review/tempo/take-2")
        ? json({ tempo: { reading: "rushed", topic: "that part", slide_index: 1, snippet_id: "snip-stretch", said: { before: "Three things stood out: ", stretch: "Retention went up, um, churn went down", after: "" } } })
        : new Response("{}", { status: 404 }),
    ));
    const p = props({ suggestions: [best] });
    await render(p);
    await render({ ...p, reviewRequest: 1 });
    expect(screen()).toBe("walk-screen-praise");
    await click(live()!.querySelector("[data-testid='walk-forward']"));
    expect(screen()).toBe("walk-screen-tempo");
    // The bar names the stretch's slide (N435 item 7).
    expect(live()!.querySelector("[data-walk-nav]")!.getAttribute("aria-label")).toBe("Results");
    const opening = append.mock.calls
      .map(([draft]) => (draft as { metadata: Record<string, unknown> }).metadata)
      .find((m) => m.step === "tempo:open");
    expect(opening?.fix_tip).toBe(ONE_THING_COPY.paceTip(stretch));
    // In the chat as in the walk: "And here's one moment to try another way:", the
    // stretch's clip as the speaker's, then the Sniper's line; the clip names
    // its recording, so Will's question after the walk quotes the stretch (E2).
    const steps = append.mock.calls.map(([draft]) => (draft as { metadata: Record<string, unknown> }).metadata);
    const order = ["one", "clip:tempo", "tempo:open"].map((step) => steps.findIndex((m) => m.step === step));
    expect(order.every((i, k) => i >= 0 && (k === 0 || i > order[k - 1]))).toBe(true);
    expect(steps.find((m) => m.step === "clip:tempo")?.clip).toMatchObject({ snippet_id: "snip-stretch" });
    // Its scale names its three zones, left to right (N405).
    expect([...live()!.querySelectorAll("[data-walk-scale-ends] span")].map((n) => n.textContent)).toEqual([...TEMPO_COPY.ends]);
    // Skip: the walk's answer to it, in the walk and in the chat (N405), with
    // no "Skip" of the speaker's in either (N435 item 2, N452 item 1).
    await click(live()!.querySelector("[data-testid='walk-tempo-skip']"));
    expect(live()!.querySelector("[data-walk-skip-reply]")!.textContent).toBe(ONE_THING_COPY.skipped);
    const told = append.mock.calls.map(([draft]) => draft as { body: string; metadata: Record<string, unknown> });
    expect(told.find((d) => d.metadata.step === "tempo:skipped")?.body).toBe(ONE_THING_COPY.skipped);
    expect(told.find((d) => d.metadata.step === "tempo:skip")).toBeUndefined();
  });

  it("a slow stretch as the walk's fix keeps its own tip, for Last time next Take (N459 item 2)", async () => {
    who.email = FOUNDER_EMAIL;
    const append = vi.fn(async (draft: unknown) => draft);
    chat.thread = { messages: [], loading: false, append, reload: vi.fn(async () => undefined) };
    const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes("/review/tempo/take-2")
        ? json({ tempo: { reading: "slow", topic: "that part", slide_index: 1, snippet_id: "snip-stretch", said: { before: "Three things stood out: ", stretch: "retention went up, churn went down", after: "" } } })
        : new Response("{}", { status: 404 }),
    ));
    const p = props({ suggestions: [{ ...best, oneFix: "tempo" } as DocumentSuggestion] });
    await render(p);
    await render({ ...p, reviewRequest: 1 });
    await click(live()!.querySelector("[data-testid='walk-forward']"));
    expect(screen()).toBe("walk-screen-tempo");
    const opening = append.mock.calls
      .map(([draft]) => (draft as { metadata: Record<string, unknown> }).metadata)
      .find((m) => m.step === "tempo:open");
    expect(ONE_THING_COPY.lastTime(tipSaid(String(opening?.fix_tip)))).toBe("Last time: keep “retention went up, churn went down” moving. You did.");
  });

  it("a Sniper opened, then left with ✕ before a try, is played live from a door while the Take still waits (B10, T)", async () => {
    // The server chose the Sniper; the chat keeps what the walk posts.
    type Draft = { clientId: string; role: string; kind: string; body: string; metadata: Record<string, unknown> };
    const thread = {
      messages: [] as unknown[],
      loading: false,
      append: vi.fn(async (d: Draft) => {
        thread.messages = [...thread.messages, { client_id: d.clientId, role: d.role, kind: d.kind, body: d.body, metadata: d.metadata, client_created_at: "" }];
        return d;
      }),
      reload: vi.fn(async () => undefined),
    };
    chat.thread = thread;
    const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes("/review/tempo/take-2")
        ? json({ tempo: { reading: "rushed", topic: "that part", slide_index: 1, snippet_id: "snip-stretch", said: { before: "Three things stood out: ", stretch: "retention went up, churn went down", after: "" } } })
        : new Response("{}", { status: 404 }),
    ));
    // Their best still waits here, as another moment of the Take would.
    const p = props({ suggestions: [{ ...best, oneFix: "tempo" } as DocumentSuggestion] });
    await render(p);
    await render({ ...p, reviewRequest: 1 });
    await click(live()!.querySelector("[data-testid='walk-forward']"));
    expect(screen()).toBe("walk-screen-tempo");
    // ✕ before a try: only the Sniper's opening is in the chat.
    await click(live()!.querySelector("button[aria-label='Close']"));
    const steps = () => thread.messages.map((m) => (m as { metadata: { step: string } }).metadata.step);
    expect(steps()).toContain("tempo:open");
    expect(steps().filter((s) => /^tempo:(try|skip|skipped|close)$/.test(s))).toEqual([]);
    chat.thread = { ...thread, messages: [...thread.messages] };
    await render({ ...p });
    await click(paragraph("Today I want"));
    await click(live()!.querySelector("[data-testid='walk-forward']"));
    expect(screen()).toBe("walk-screen-tempo");
    expect(live()!.querySelector("[data-testid='walk-tempo-ready']")).not.toBeNull();
    expect(live()!.querySelector("[data-testid='walk-tempo-skip']")).not.toBeNull();
  });
});
