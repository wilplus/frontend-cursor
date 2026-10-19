// @vitest-environment jsdom
/* The Feedback walk's production controller (build plan D-FW-14): the coach's
   note, the praise and the helper words, moving as the lock says, and a
   guest's pick asking to sign up. */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHUNK_SHEET_COPY as COPY, WALK_COPY, WALK_LINE_BANK } from "../idealEditCopy";
import { GuestGateContext } from "../GuestSignUpDialog";
vi.mock("@/services/api/otherSpeakers", () => ({
  fetchOtherClips: vi.fn(async () => []),
  fetchOtherAnswers: vi.fn(async () => []),
  answerOtherClip: vi.fn(),
}));
import { fetchOtherAnswers, fetchOtherClips } from "@/services/api/otherSpeakers";
/** The microphone, standing still: the recorder is reached, nothing records. */
vi.mock("@/hooks/useDualCaptureMic", () => ({
  useDualCaptureMic: () => ({
    state: { status: "idle" },
    start: async () => undefined,
    stop: async () => undefined,
    cancel: () => undefined,
    getAudioStartedAt: () => null,
  }),
}));
/** A practise with nothing behind it: the screens open, no call is made. */
const QUIET_PRACTISE = { open: async () => null, upload: async () => null, check: async () => null } as never;
import FeedbackWalk, { type FeedbackWalkHelperWords, type FeedbackWalkRequest } from "./FeedbackWalk";
import { buildFeedbackWalk, type FeedbackWalkItem } from "@/lib/willab/feedbackWalkModel";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ITEMS: FeedbackWalkItem[] = [
  {
    partId: "p1", start: 0, slide: 1, blockId: "b1", openCard: "praise",
    paragraphText: "Last quarter our growth doubled, and it came from two markets.",
    slideLabel: "Slide 2", praiseWords: ["You opened with the number and let it sit."],
    clip: { src: "data:audio/wav;base64,", startOffsetMs: 0, durationMs: 9000 },
  },
  {
    partId: "p2", start: 80, slide: 1, blockId: "b2", feedbackFamily: "great_formulation",
    paragraphText: "Two hires by March keep that lead.",
    slideLabel: "Slide 2", praiseWords: [COPY.praiseTentative],
  },
];
const NOTE = { text: "Let the pause after doubled breathe.", videoUrl: "data:video/mp4;base64,", takeIndex: 2 };

let host: HTMLDivElement;
let root: Root;
let spies: {
  onSaveHelperWords: ReturnType<typeof vi.fn<(save: FeedbackWalkHelperWords) => void>>;
  onEnd: ReturnType<typeof vi.fn<() => void>>;
};
beforeEach(() => {
  spies = { onSaveHelperWords: vi.fn<(save: FeedbackWalkHelperWords) => void>(), onEnd: vi.fn<() => void>() };
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

type Over = Partial<Parameters<typeof FeedbackWalk>[0]> & { block?: () => boolean };
function draw(request: FeedbackWalkRequest | null, over: Over = {}) {
  const { block, ...rest } = over;
  const props = {
    model: buildFeedbackWalk({ items: ITEMS, coachNote: true, practiceOn: true, guest: Boolean(rest.guest) }),
    request,
    coachNote: NOTE,
    firstTake: false,
    ...spies,
    ...rest,
  };
  const walk = <FeedbackWalk {...props} />;
  act(() => root.render(block ? <GuestGateContext.Provider value={block}>{walk}</GuestGateContext.Provider> : walk));
  return props;
}
const live = () => host.querySelector<HTMLElement>(".walk-layer:not(.walk-ghost)");
const screen = () => live()?.querySelector<HTMLElement>("[data-testid^='walk-screen-']")?.dataset.testid ?? null;
const click = (el: Element | null | undefined) => act(() => (el as HTMLElement).click());
const forward = () => click(live()?.querySelector("[data-testid='walk-forward']"));
const words = () => [...(live()?.querySelectorAll<HTMLButtonElement>("[data-walk-word-picker] button") ?? [])];

describe("FeedbackWalk", () => {

  const bubble = () => [...live()!.querySelectorAll("[data-walk-message] > div > span")].map((n) => n.textContent);
  const nav = () => live()!.querySelector("[data-walk-nav]")!;
  const nextArrow = () => nav().querySelector<HTMLButtonElement>(`button[aria-label='${COPY.pagerNext}']`)!;

  it("a green moment says why it landed: the praise line alone, then the reason in its own bubble (founder 2026-10-18)", () => {
    const reason = {
      paragraphs: ["When you said “our growth doubled”", "No fillers, right on the slide."],
      quote: "our growth doubled",
    };
    const lead = "It was your confident moment.";
    const items: FeedbackWalkItem[] = [
      { ...ITEMS[0], praiseWords: [lead, "A cue line."], praiseLead: [lead], praiseReason: reason },
    ];
    draw(
      { seq: 1, at: 1 },
      { model: buildFeedbackWalk({ items, coachNote: false, practiceOn: true, guest: false }), coachNote: null },
    );
    expect(screen()).toBe("walk-screen-praise");
    expect(bubble()).toEqual([COPY.titlePraise, lead]);
    const why = live()!.querySelector("[data-walk-reason]")!;
    expect([...why.querySelectorAll("p")].map((p) => p.textContent)).toEqual(reason.paragraphs);
    expect(why.querySelector("[data-walk-quote]")!.textContent).toBe("“our growth doubled”");
  });

  it("walks coach's note → praise → helper words → the next praise → the summary → the page", async () => {
    const props = draw(null, { summary: async () => "A closing word.", takeIndex: 2 });
    draw({ seq: 1, at: 1 }, { summary: async () => "A closing word.", takeIndex: 2 });
    // The coach's bubble: "Your coach", the video inside it, the words.
    expect(screen()).toBe("walk-screen-coachnote");
    expect(live()!.querySelector("[data-walk-message][data-walk-coach]")).not.toBeNull();
    expect(live()!.querySelector("[data-walk-message] [data-coach-video]")).not.toBeNull();
    expect(bubble()).toEqual([COPY.titleCoach, NOTE.text]);
    forward();
    expect(screen()).toBe("walk-screen-praise");
    expect(live()!.className).toContain("walk-m-next");
    // No title: the step's name is the bubble's first line; the clip is the
    // orange bubble (lock 2026-10-12, section 2.2).
    expect(live()!.querySelector("h2")).toBeNull();
    expect(live()!.querySelector("[data-walk-player][data-walk-me]")).not.toBeNull();
    expect(bubble()).toEqual([COPY.titlePraise, ITEMS[0].praiseWords![0]]);
    expect(nav().getAttribute("aria-label")).toBe("Slide 2");
    // › browses on, unanswered (founder 2026-10-15); the pill answers.
    expect(nextArrow().disabled).toBe(false);
    forward();
    expect(screen()).toBe("walk-screen-helpers");
    expect(nav().getAttribute("aria-label")).toBe(`Slide 2 · ${WALK_COPY.navHelperWords}`);
    expect(bubble()).toEqual([COPY.titleEmphasis, WALK_COPY.helpersSubtitle]);
    expect(words().map((w) => w.textContent)).toEqual(ITEMS[0].paragraphText.split(" "));
    click(live()!.querySelector("[data-testid='walk-skip']"));
    expect(screen()).toBe("walk-screen-praise");
    expect(bubble()).toEqual([COPY.titlePraise, COPY.praiseTentative]);
    // ‹ reopens the answered step: › is on there now.
    click(nav().querySelector(`button[aria-label='${COPY.pagerBack}']`));
    expect(screen()).toBe("walk-screen-helpers");
    expect(nextArrow().disabled).toBe(false);
    expect(live()!.querySelector("[data-testid='walk-skip']")!.textContent).toBe(WALK_COPY.keepThese);
    click(nextArrow());
    forward();
    forward(); // the helper words' pill is off until a word is picked
    expect(screen()).toBe("walk-screen-helpers");
    click(live()!.querySelector("[data-testid='walk-skip']"));
    expect(screen()).toBe("walk-screen-others"); // nobody to judge: it moves on
    await act(async () => {});
    expect(screen()).toBe("walk-screen-summary");
    await act(async () => {});
    expect(nav().getAttribute("aria-label")).toBe(`${COPY.historyTake} 2`);
    expect(bubble()).toEqual(["A closing word."]);
    forward();
    expect(live()).toBeNull();
    expect(props.onEnd).toHaveBeenCalledTimes(1);
  });

  it("reopened from the Lounge, the judging shows the moment already answered: its card orange, ✓ Answered over Next", async () => {
    vi.mocked(fetchOtherAnswers).mockResolvedValueOnce([
      { id: "c1", src: "data:audio/wav;base64,", startOffsetMs: 0, durationMs: 5000, community: null, answer: "yes" },
    ]);
    vi.mocked(fetchOtherClips).mockClear();
    const onOthers = vi.fn();
    const props = draw(null, { summary: async () => null, othersJudged: 1, onOthers });
    const others = props.model.plan.findIndex((s) => s.key === "others");
    draw({ seq: 1, at: others }, { summary: async () => null, othersJudged: 1, onOthers });
    await act(async () => {});
    expect(screen()).toBe("walk-screen-others");
    const yes = live()!.querySelector<HTMLButtonElement>("[data-walk-answer='yes']")!;
    expect(yes.getAttribute("aria-pressed")).toBe("true");
    expect(yes.disabled).toBe(true);
    expect(yes.className).toContain("bg-primary");
    expect(live()!.textContent).toContain(WALK_COPY.answered);
    expect(nextArrow().disabled).toBe(false);
    expect(fetchOtherClips).not.toHaveBeenCalled();
    expect(onOthers).not.toHaveBeenCalled(); // the chat already holds it
    forward();
    await act(async () => {});
    expect(live()).toBeNull();
    expect(props.onEnd).toHaveBeenCalledTimes(1);
  });

  it("skips the summary when it cannot be read, straight onto the page", async () => {
    const props = draw(null, { summary: async () => null });
    draw({ seq: 1, at: 6 }, { summary: async () => null }); // the others' step
    await act(async () => {});
    await act(async () => {});
    expect(live()).toBeNull();
    expect(props.onEnd).toHaveBeenCalledTimes(1);
  });

  it("shows no read, family or score anywhere in the DOM (AC-9)", () => {
    draw(null);
    draw({ seq: 1, at: 2 });
    // The words and the data attributes; a class name is not shown to anyone.
    const html = host.innerHTML.replace(/class="[^"]*"/g, "");
    expect(html).not.toMatch(/great_formulation|confident_voice|rewrite_clarity|openCard|tier|score|%/i);
  });
});

describe("the clearer version (D-FW-15)", () => {
  const SAID = "We think the timing matters, because the window closes once the incumbents catch up with pricing.";
  const OFFERED = "The window closes once the incumbents match our price.";
  const REWRITE_ITEMS: FeedbackWalkItem[] = [
    ...ITEMS,
    {
      partId: "p3", start: 160, slide: 1, blockId: "b3", feedbackFamily: "rewrite_clarity",
      paragraphText: SAID, slideLabel: "Slide 2",
      clip: { src: "data:audio/wav;base64,", startOffsetMs: 0, durationMs: 11000 },
      rewrite: { quote: SAID, proposedText: OFFERED, item: "s-rewrite" },
      item: "s-rewrite",
    },
    {
      partId: "p4", start: 240, slide: 1, blockId: "b4", openCard: "rewrite",
      paragraphText: "So basically we need two hires.", slideLabel: "Slide 2",
      rewrite: { quote: "So basically we need two hires.", proposedText: "We need two hires.", item: "s-second" },
    },
  ];
  type Spies = { onAcceptClearer: ReturnType<typeof vi.fn>; onKeepWords: ReturnType<typeof vi.fn> };
  function drawClearer(practiceOn: boolean, at: number, extra: Over = {}): Spies {
    const handlers = { onAcceptClearer: vi.fn(), onKeepWords: vi.fn() };
    const model = buildFeedbackWalk({ items: REWRITE_ITEMS, coachNote: false, practiceOn, guest: Boolean(extra.guest) });
    draw(null, { model, ...handlers, ...extra } as Over);
    draw({ seq: 1, at }, { model, ...handlers, ...extra } as Over);
    return handlers;
  }
  // page, praise, helpers, praise, helpers, clearer (5), practise, clearer, others, summary, end
  const FIRST = 5;
  const msg = () => live()!.querySelector("[data-walk-message]")!;

  it("draws the served words: what goes crossed out, what arrives in orange, around the signed lines", () => {
    drawClearer(true, FIRST);
    expect(screen()).toBe("walk-screen-clearer");
    expect(live()!.querySelector("[data-walk-nav]")!.getAttribute("aria-label")).toBe("Slide 2");
    // The speaker's clip is the orange bubble, their words above the voice.
    const player = live()!.querySelector("[data-walk-player][data-walk-me]")!;
    expect([...player.querySelectorAll("s")].map((n) => n.textContent)).toEqual([
      "We think the timing matters, because the",
      "catch up with pricing",
    ]);
    const fresh = msg().querySelector("[data-walk-new-words]")!;
    expect(fresh.textContent).toBe(OFFERED);
    expect([...fresh.querySelectorAll("em")].map((n) => n.textContent)).toEqual(["The", "match our price"]);
    const lines = [...msg().querySelectorAll(":scope > div > span:not([data-walk-new-words])")].map((n) => n.textContent);
    expect(lines).toEqual([COPY.cardClearerVersion, WALK_LINE_BANK.B13.lines[0], WALK_LINE_BANK.B14.lines[0]]);
    expect(lines.slice(1)).toEqual([WALK_COPY.clearerOffer, WALK_COPY.clearerAsk]);
    const buttons = [...live()!.querySelectorAll("footer button, [data-walk-footer] button")].map((b) => b.textContent);
    expect(buttons).toContain(COPY.pillAcceptPractise);
    expect(buttons).toContain(COPY.linkKeepMyWords);
  });

  it("Keep my words records the decline and, with a practise to do, opens the recorder on the speaker's own sentence with Line A", () => {
    const handlers = drawClearer(true, FIRST, { practise: QUIET_PRACTISE });
    click(live()!.querySelector("[data-testid='walk-keep']"));
    expect(handlers.onKeepWords).toHaveBeenCalledWith("s-rewrite");
    expect(screen()).toBe("walk-screen-practise");
    expect(live()!.querySelector("[data-walk-where]")!.textContent).toBe(WALK_COPY.practiseWhere("Slide 2"));
    expect(live()!.querySelector("[data-walk-message]")!.textContent).toBe(WALK_COPY.lineA);
    expect(live()!.querySelector("[data-walk-say]")!.textContent).toBe(SAID);
    // ✕ on the recorder goes back to the walk, the clearer version unanswered.
    click(live()!.querySelector("button[aria-label='Close']"));
    expect(screen()).toBe("walk-screen-clearer");
    expect(live()!.querySelector("[data-testid='walk-keep']")).not.toBeNull();
  });
});
