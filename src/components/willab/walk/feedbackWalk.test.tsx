// @vitest-environment jsdom
/*
STORY    As a speaker, I want the Feedback walk to take me through my coach's note, praise with its reason, helper words, the clearer version and a summary, in words only, as one chat that grows with each tap, so that feedback after every Take is clear and backed by what I said.
OUTCOME
  O1  The steps come in order as one chat: coach's note, praise, helper words, next praise, summary, back to my page; earlier steps stay above, my choices land as my own bubbles.
  O2  A good moment shows the praise line, then why it landed, quoting my words; the Take's highest moment opens with “This was your most confident moment.”
  O3  Reopened from the Lounge, a clip I already judged shows as answered and is not asked again.
  O4  If the summary cannot be read, the walk goes straight back to my page.
  O5  No read, feedback type or score ever appears; the clearer version shows what goes and what arrives, and Keep my words is recorded before practise opens.
  O6  A step's grey bubbles land one after another behind the typing dots, and its buttons come once they all have; each new bubble, and the typing dots before it, land at the bottom, right above the buttons, and the thread follows them until I scroll up by hand (N122).
  O7  The walk opens once with "Hi {name}, good to see you back!" (Take 1: "Hi {name}, great to meet you!"; no name: the same without it), and the Lounge keeps the same words (N120).
  O8  Other speakers asks for my Take's moments and shows each one the server sends, up to three ("Now 3 moments from other speakers."), however many tries I made; with none the step is left out (N119). My answer on one moves me on to the next, though the chat counts it at once.
  O9  On a plan, the moment where this week's level shows most opens with "This week's level: {level}. Here's where it shows:" above my clip; no other moment does (G7, backend N209).
  O10 What a step showed stays in the thread once I move on: the tempo game's tries, their comments and its closing line, then other speakers' moments with my answers, all still above the summary (B5).
PROVES   O1 -> walks coach's note → praise → helper words → the next praise → the summary → the page, as one chat that grows
         O2 -> a green moment says why it landed,
               the Take's highest moment opens with “This was your most confident moment.”
         O3 -> reopened from the Lounge, the judging shows the moment already answered
         O4 -> skips the summary when it cannot be read, straight onto the page
         O5 -> shows no read, family or score anywhere in the DOM (AC-9), draws the served words, Keep my words records the decline and ... opens the recorder
         O6 -> a step's bubbles land behind the typing dots, then its buttons (founder 2026-10-20),
               new bubbles land at the bottom and the thread follows them until the speaker scrolls up by hand (N122)
         O7 -> the walk opens once with the hello and the speaker's first name (N120)
         O8 -> other speakers: the Take's three moments, whatever the tries (N119); an answer moves on to the next,
               with nobody to judge, the step leaves nothing in the thread
         O9 -> on a plan, the level's moment says where this week's level shows, above the clip (G7, N209)
         O10 -> the tempo game and other speakers stay in the thread as the walk moves on to the summary (B5)
WHY      Never-rule 1 (no scores to speakers); Feedback walk is a locked screen; founder 2026-10-23 (N120, "add the name at the start"; N122, "the 3 dots loading should be at the bottom"; N119, "3 clips (high, middle, low willfidence) from 3 different speakers"); founder 2026-10-28 ("I click next and it's gone ... should be in the walk, so that there is a continuity").
*/
import { HELPER_WORDS_MAX } from "@/lib/willab/phraseTokens";
import { WALK_ANSWER_HOLD_MS } from "@/lib/willab/walkMotion";
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
/** The tempo step's microphone, open and silent: a try reads as slow. */
vi.mock("@/lib/willab/pace/paceMic", () => ({
  startPaceMic: vi.fn(async () => ({ meter: {}, voiceLike: () => 0, stop: () => undefined })),
}));
import { TEMPO_COPY, TEMPO_STAND_IN } from "@/lib/willab/tempoStep";
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
import { shownStep } from "@/lib/willab/walkThread";
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
/** The newest part of the thread: the step the walk stands on. */
const now = () => live()?.querySelector<HTMLElement>("[data-walk-part][data-testid^='walk-screen-']") ?? null;
const screen = () => now()?.dataset.testid ?? null;
const marks = () => [...(live()?.querySelectorAll("[data-walk-mark]") ?? [])].map((n) => n.textContent);
const said = () => [...(live()?.querySelectorAll("[data-walk-said]") ?? [])].map((n) => n.textContent);
const click = (el: Element | null | undefined) => act(() => (el as HTMLElement).click());
const forward = () => click(live()?.querySelector("[data-testid='walk-forward']"));
const words = () => [...(live()?.querySelectorAll<HTMLButtonElement>("[data-walk-word-picker] button") ?? [])];

describe("FeedbackWalk", () => {

  const bubble = () => [...now()!.querySelectorAll("[data-walk-message] > div > span")].map((n) => n.textContent);
  const nav = () => live()!.querySelector("[data-walk-nav]")!;
  const nextArrow = () => nav().querySelector<HTMLButtonElement>(`button[aria-label='${COPY.pagerNext}']`)!;
  const backArrow = () => nav().querySelector<HTMLButtonElement>(`button[aria-label='${COPY.pagerBack}']`)!;

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

  it("the Take's highest moment opens with “This was your most confident moment.” (founder, signed 2026-10-20)", () => {
    const items: FeedbackWalkItem[] = [{ ...ITEMS[0], highest: true }];
    draw(
      { seq: 1, at: 1 },
      { model: buildFeedbackWalk({ items, coachNote: false, practiceOn: true, guest: false }), coachNote: null },
    );
    expect(screen()).toBe("walk-screen-praise");
    expect(bubble()[0]).toBe(COPY.titleMostConfident);
    expect(bubble()[1]).toBe(COPY.titlePraise);
  });

  it("walks coach's note → praise → helper words → the next praise → the summary → the page, as one chat that grows", async () => {
    const props = draw(null, { summary: async () => "A closing word.", takeIndex: 2 });
    draw({ seq: 1, at: 1 }, { summary: async () => "A closing word.", takeIndex: 2 });
    // The coach's bubble: "Your coach:" (founder 2026-10-20, the colon),
    // the video inside it, the words.
    expect(screen()).toBe("walk-screen-coachnote");
    expect(now()!.querySelector("[data-walk-message][data-walk-coach]")).not.toBeNull();
    expect(now()!.querySelector("[data-walk-message] [data-coach-video]")).not.toBeNull();
    expect(bubble()).toEqual([COPY.titleCoachLine, NOTE.text]);
    forward();
    expect(screen()).toBe("walk-screen-praise");
    // Nothing slides (founder 2026-10-20): the coach's note stays above, in
    // the same thread, and each step opens with its name.
    expect(live()!.className).not.toContain("walk-m-next");
    expect(live()!.querySelector("[data-walk-message][data-walk-coach]")).not.toBeNull();
    expect(marks()).toEqual([COPY.titleCoach, "Slide 2"]);
    // No title: the step's name is the bubble's first line; the clip is the
    // orange bubble (lock 2026-10-12, section 2.2).
    expect(now()!.querySelector("h2")).toBeNull();
    expect(now()!.querySelector("[data-walk-player][data-walk-me]")).not.toBeNull();
    expect(bubble()).toEqual([COPY.titlePraise, ITEMS[0].praiseWords![0]]);
    expect(nav().getAttribute("aria-label")).toBe("Slide 2");
    // ‹ scrolls back up the thread; › is off at the newest step. The pill
    // alone moves the walk on.
    expect(backArrow().disabled).toBe(false);
    expect(nextArrow().disabled).toBe(true);
    forward();
    expect(screen()).toBe("walk-screen-helpers");
    expect(nav().getAttribute("aria-label")).toBe(`Slide 2 · ${WALK_COPY.navHelperWords}`);
    expect(bubble()).toEqual([COPY.titleEmphasis, WALK_COPY.helpersSubtitle]);
    expect(words().map((w) => w.textContent)).toEqual(ITEMS[0].paragraphText.split(" "));
    click(live()!.querySelector("[data-testid='walk-skip']"));
    // The speaker's choice lands as their own bubble under the step.
    expect(said()).toEqual([WALK_COPY.skip]);
    expect(screen()).toBe("walk-screen-praise");
    expect(bubble()).toEqual([COPY.titlePraise, COPY.praiseTentative]);
    // The answered picker stays in the thread, still editable (C3, B10): a
    // tap stands the walk on it, and its buttons bring the walk back.
    click(words()[0]);
    expect(screen()).toBe("walk-screen-helpers");
    expect(words()[0].getAttribute("aria-pressed")).toBe("true");
    click(live()!.querySelector("[data-testid='walk-skip']"));
    expect(screen()).toBe("walk-screen-praise");
    forward();
    forward(); // the helper words' pill is off until a word is picked
    expect(screen()).toBe("walk-screen-helpers");
    // The picker counts the words against the cap, in place of "Tap the
    // words" (founder 2026-10-21, C3).
    const count = () => [...live()!.querySelectorAll("[data-walk-word-count]")].pop()!.textContent;
    expect(count()).toBe(WALK_COPY.wordsOfMax(0, HELPER_WORDS_MAX));
    const last = words().length - 1;
    click(words()[last - 1]);
    click(words()[last]);
    expect(count()).toBe(WALK_COPY.wordsOfMax(2, HELPER_WORDS_MAX));
    forward();
    // The speaker's bubble says the words without the sentence's full stop
    // (founder 2026-10-21, B7).
    expect(said().pop()).toBe("that lead");
    expect(screen()).toBe("walk-screen-others"); // nobody to judge: it moves on
    await act(async () => {});
    expect(screen()).toBe("walk-screen-summary");
    await act(async () => {});
    expect(nav().getAttribute("aria-label")).toBe(`${COPY.historyTake} 2`);
    expect(bubble()).toEqual(["A closing word."]);
    expect(marks()).toEqual([
      COPY.titleCoach,
      "Slide 2",
      `Slide 2 · ${WALK_COPY.navHelperWords}`,
      "Slide 2",
      `Slide 2 · ${WALK_COPY.navHelperWords}`,
      `${COPY.historyTake} 2`,
    ]);
    forward();
    expect(live()).toBeNull();
    expect(props.onEnd).toHaveBeenCalledTimes(1);
  });

  it("reopened from the Lounge, the judging shows the moment already answered: the answer as the speaker's bubble, Next alone", async () => {
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
    // The answer given is the speaker's own orange bubble under the moment;
    // nothing is asked again (founder 2026-10-20).
    expect(said()).toEqual([`👍 ${WALK_COPY.judgeYes}`]);
    expect(live()!.querySelector("[data-walk-answer='yes']")).toBeNull();
    // "✓ Practised" is the one ✓ line; a judging answered reads Next alone
    // (founder 2026-10-21).
    expect(live()!.querySelector("[data-walk-dock]")!.textContent).toBe(COPY.pagerNext);
    expect(fetchOtherClips).not.toHaveBeenCalled();
    expect(onOthers).not.toHaveBeenCalled(); // the chat already holds it
    forward();
    await act(async () => {});
    expect(live()).toBeNull();
    expect(props.onEnd).toHaveBeenCalledTimes(1);
  });

  it("other speakers: the Take's three moments, whatever the tries (N119); an answer moves on to the next", async () => {
    const clip = (id: string) => ({ id, src: "data:audio/wav;base64,", startOffsetMs: 0, durationMs: 4000, community: null });
    vi.mocked(fetchOtherClips).mockClear();
    vi.mocked(fetchOtherClips).mockResolvedValueOnce([clip("c1"), clip("c2"), clip("c3")]);
    const props = draw(null, { summary: async () => null, takeId: "take-7" });
    const others = props.model.plan.findIndex((s) => s.key === "others");
    expect(props.model.plan.slice(0, others).some((s) => s.key === "processing")).toBe(false); // no try made
    draw({ seq: 1, at: others }, { summary: async () => null, takeId: "take-7" });
    await act(async () => {});
    expect(fetchOtherClips).toHaveBeenCalledWith("take-7");
    expect(screen()).toBe("walk-screen-others");
    expect(now()!.textContent).toContain(WALK_COPY.othersMany(3));
    expect(marks().pop()).toBe(`${WALK_COPY.othersTitle} · 1 ${COPY.pagerOf} 3`);
    // The answer is the chat's at once, so the count grows while the step is
    // open; the server holds it too. The step goes on to the second moment,
    // never back to its start (2026-10-27: it stood on the typing dots).
    vi.mocked(fetchOtherAnswers).mockResolvedValueOnce([{ ...clip("c1"), answer: "yes" }]);
    click(live()!.querySelector("[data-walk-answer='yes']"));
    draw({ seq: 1, at: others }, { summary: async () => null, takeId: "take-7", othersJudged: 1 });
    await act(async () => {
      await new Promise((r) => setTimeout(r, WALK_ANSWER_HOLD_MS + 20));
    });
    expect(live()!.querySelector("[data-walk-loading]")).toBeNull();
    expect(marks().pop()).toBe(`${WALK_COPY.othersTitle} · 2 ${COPY.pagerOf} 3`);
    expect(said()).toEqual([`👍 ${WALK_COPY.judgeYes}`]);
  });

  it("the tempo game and other speakers stay in the thread as the walk moves on to the summary (B5)", async () => {
    const clip = (id: string) => ({ id, src: "data:audio/wav;base64,", startOffsetMs: 0, durationMs: 4000, community: null });
    vi.mocked(fetchOtherClips).mockResolvedValueOnce([clip("c1"), clip("c2")]);
    const over = {
      model: buildFeedbackWalk({ items: ITEMS, coachNote: true, practiceOn: true, guest: false, interventions: ["tempo"] }),
      tempo: TEMPO_STAND_IN,
      summary: async () => "You slowed it right down.",
      takeId: "take-7",
    } satisfies Over;
    draw(null, over);
    draw({ seq: 1, at: over.model.plan.findIndex((s) => s.key === "tempo") }, over);
    const thread = () => live()!.querySelector("[data-walk-thread-body]")!.textContent ?? "";
    const dock = (sel: string) => live()!.querySelector<HTMLElement>(`[data-walk-dock] ${sel}`);
    // Three tries, none landing: the closing line comes by itself, then Next.
    for (const go of ["walk-tempo-ready", "walk-practise", "walk-practise"]) {
      click(dock(`[data-testid='${go}']`));
      await act(async () => {});
      click(dock("[data-walk-recording-strip] button"));
    }
    expect(screen()).toBe("walk-screen-tempo");
    forward();
    await act(async () => {});
    expect(screen()).toBe("walk-screen-others");
    for (let i = 0; i < 2; i += 1) {
      click(live()!.querySelector("[data-walk-answer='yes']"));
      await act(async () => {
        await new Promise((r) => setTimeout(r, WALK_ANSWER_HOLD_MS + 20));
      });
    }
    await act(async () => {});
    expect(screen()).toBe("walk-screen-summary");
    // Everything the game and the judging showed is still above the summary.
    for (const line of [TEMPO_COPY.room, TEMPO_COPY.tryLabel(1), TEMPO_COPY.tryLabel(3), TEMPO_COPY.comment.slow, TEMPO_COPY.close.slow]) {
      expect(thread()).toContain(line);
    }
    expect(thread()).toContain(WALK_COPY.othersMany(2));
    expect(marks()).toEqual(expect.arrayContaining([`${WALK_COPY.othersTitle} · 2 ${COPY.pagerOf} 2`]));
    expect(said().filter((s) => s === `👍 ${WALK_COPY.judgeYes}`)).toHaveLength(2);
    expect(thread()).toContain("You slowed it right down.");
  });

  it("with nobody to judge, the step leaves nothing in the thread", async () => {
    vi.mocked(fetchOtherClips).mockResolvedValueOnce([]);
    const over = { summary: async () => "You slowed it right down." };
    const props = draw(null, over);
    draw({ seq: 1, at: props.model.plan.findIndex((s) => s.key === "others") }, over);
    await act(async () => {});
    await act(async () => {});
    expect(screen()).toBe("walk-screen-summary");
    expect(live()!.querySelector("[data-walk-loading]")).toBeNull();
    expect(live()!.textContent).not.toContain(WALK_COPY.othersTitle);
  });

  it("skips the summary when it cannot be read, straight onto the page", async () => {
    const props = draw(null, { summary: async () => null });
    draw({ seq: 1, at: 6 }, { summary: async () => null }); // the others' step
    await act(async () => {});
    await act(async () => {});
    expect(live()).toBeNull();
    expect(props.onEnd).toHaveBeenCalledTimes(1);
  });

  it("a step's bubbles land behind the typing dots, then its buttons (founder 2026-10-20)", () => {
    // A browser that welcomes motion.
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }));
    vi.useFakeTimers();
    // The clock runs on in small steps, each bubble scheduling the next.
    const wait = (ms: number) => {
      for (let t = 0; t < ms; t += 50) act(() => vi.advanceTimersByTime(50));
    };
    try {
      draw(null);
      draw({ seq: 1, at: 1 });
      // The coach's word: the dots first, no button yet.
      expect(live()!.querySelector("[data-walk-typing]")).not.toBeNull();
      expect(now()!.querySelector("[data-walk-message]")!.closest("[hidden]")).not.toBeNull();
      expect(live()!.querySelector("[data-testid='walk-forward']")).toBeNull();
      wait(600);
      expect(live()!.querySelector("[data-walk-typing]")).toBeNull();
      expect(now()!.querySelector("[data-walk-message]")!.closest("[hidden]")).toBeNull();
      forward();
      // The praise: the speaker's clip, then the dots, then the grey bubble;
      // Next once everything has landed.
      expect(screen()).toBe("walk-screen-praise");
      expect(live()!.querySelector("[data-testid='walk-forward']")).toBeNull();
      wait(250);
      expect(live()!.querySelector("[data-walk-typing]")).not.toBeNull();
      wait(1500);
      expect(live()!.querySelector("[data-walk-typing]")).toBeNull();
      expect(live()!.querySelector("[data-testid='walk-forward']")).not.toBeNull();
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });

  it("new bubbles land at the bottom and the thread follows them until the speaker scrolls up by hand (N122)", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }));
    vi.useFakeTimers();
    const wait = (ms: number) => {
      for (let t = 0; t < ms; t += 50) act(() => vi.advanceTimersByTime(50));
    };
    // The thread holds more than it shows: 1000 tall, 400 in view.
    const isBody = (el: HTMLElement) => el.hasAttribute("data-walk-thread-body");
    const tall = vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(function (this: HTMLElement) {
      return isBody(this) ? 1000 : 0;
    });
    const seen = vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(function (this: HTMLElement) {
      return isBody(this) ? 400 : 0;
    });
    const tops: number[] = [];
    const was = Element.prototype.scrollTo;
    Element.prototype.scrollTo = function (this: Element, to?: ScrollToOptions | number) {
      const top = typeof to === "object" ? (to.top ?? 0) : 0;
      tops.push(top);
      (this as HTMLElement).scrollTop = top;
    } as typeof Element.prototype.scrollTo;
    try {
      draw(null);
      draw({ seq: 1, at: 1 });
      wait(600);
      // The coach's word landed at the bottom, the thread followed it there,
      // and no room under it pushes the step's name up to the top.
      expect(tops.at(-1)).toBe(600);
      expect(live()!.querySelector<HTMLElement>("[data-walk-room]")!.style.height).toBe("0px");
      forward();
      wait(100);
      // Scrolled up by hand: the praise's bubbles land without pulling the thread down.
      act(() => {
        live()!.querySelector("[data-walk-thread-body]")!.dispatchEvent(new WheelEvent("wheel", { deltaY: -120, bubbles: true }));
      });
      tops.length = 0;
      wait(1800);
      expect(tops).toEqual([]);
    } finally {
      Element.prototype.scrollTo = was;
      tall.mockRestore();
      seen.mockRestore();
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });

  it("the walk opens once with the hello and the speaker's first name (N120)", () => {
    const hello = () => [...live()!.querySelectorAll("[data-walk-hello]")].map((n) => n.textContent);
    const onShown = vi.fn();
    draw({ seq: 1, at: 1 }, { firstName: "Artur", onShown });
    expect(hello()).toEqual(["Hi Artur, good to see you back!"]);
    // The Lounge keeps the same words, once.
    const told = () => onShown.mock.calls.filter(([s]) => (s as { key: string }).key === "hello").map((c) => c[4]);
    expect(told()).toEqual(["Hi Artur, good to see you back!"]);
    forward();
    expect(hello()).toEqual(["Hi Artur, good to see you back!"]);
    expect(told()).toHaveLength(1);
    act(() => root.unmount());
    root = createRoot(host);
    draw({ seq: 1, at: 1 }, { firstName: "Artur", firstTake: true });
    expect(hello()).toEqual(["Hi Artur, great to meet you!"]);
    act(() => root.unmount());
    root = createRoot(host);
    draw({ seq: 1, at: 1 }, { firstName: null });
    expect(hello()).toEqual(["Hi, good to see you back!"]);
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
  const msg = () => now()!.querySelector("[data-walk-message]")!;

  it("draws the served words: what goes crossed out, what arrives in orange, around the signed lines", () => {
    drawClearer(true, FIRST);
    expect(screen()).toBe("walk-screen-clearer");
    expect(live()!.querySelector("[data-walk-nav]")!.getAttribute("aria-label")).toBe("Slide 2");
    // The speaker's clip is the orange bubble, their words above the voice.
    const player = now()!.querySelector("[data-walk-player][data-walk-me]")!;
    expect([...player.querySelectorAll("s")].map((n) => n.textContent)).toEqual([
      "We think the timing matters, because the",
      "catch up with pricing",
    ]);
    const fresh = msg().querySelector("[data-walk-new-words]")!;
    expect(fresh.textContent).toBe(OFFERED);
    expect([...fresh.querySelectorAll("em")].map((n) => n.textContent)).toEqual(["The", "match our price"]);
    // No bold in any bubble, the new words too (founder 2026-10-21, B4).
    expect(fresh.className).not.toMatch(/font-semibold|font-bold/);
    // No "Clearer version" title: the bubble opens on the signed opener
    // (founder 2026-10-21, K).
    const lines = [...msg().querySelectorAll(":scope > div > span:not([data-walk-new-words])")].map((n) => n.textContent);
    expect(lines).toEqual([WALK_LINE_BANK.B13.lines[0], WALK_LINE_BANK.B14.lines[0]]);
    expect(lines).toEqual([WALK_COPY.clearerOffer, WALK_COPY.clearerAsk]);
    const buttons = [...live()!.querySelectorAll("footer button, [data-walk-footer] button")].map((b) => b.textContent);
    expect(buttons).toContain(COPY.pillAcceptPractise);
    expect(buttons).toContain(COPY.linkKeepMyWords);
  });

  it("on a plan, the level's moment says where this week's level shows, above the clip (G7, N209)", () => {
    const level = "Say it once, and it lands";
    const items = REWRITE_ITEMS.map((i) => (i.partId === "p3" ? { ...i, planLevel: level } : i));
    const model = buildFeedbackWalk({ items, coachNote: false, practiceOn: true, guest: false });
    draw({ seq: 1, at: FIRST }, { model, onAcceptClearer: vi.fn(), onKeepWords: vi.fn() } as Over);
    expect(screen()).toBe("walk-screen-clearer");
    const line = now()!.querySelector("[data-walk-level]")!;
    expect(line.textContent).toBe(`This week's level: ${level}. Here's where it shows:`);
    const player = now()!.querySelector("[data-walk-player][data-walk-me]")!;
    expect(line.compareDocumentPosition(player) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The other corrected moment says nothing about the level.
    draw({ seq: 2, at: FIRST + 2 }, { model, onAcceptClearer: vi.fn(), onKeepWords: vi.fn() } as Over);
    expect(screen()).toBe("walk-screen-clearer");
    expect(now()!.querySelector("[data-walk-level]")).toBeNull();
  });

  it("names words that undermined the speaker: B10's \"Say what you mean\" and \"Try saying it like this:\", on screen and in the chat (N85)", () => {
    const items = REWRITE_ITEMS.map((i) => (i.item === "s-rewrite" && i.rewrite ? { ...i, rewrite: { ...i.rewrite, reason: "undermining" as const } } : i));
    const model = buildFeedbackWalk({ items, coachNote: false, practiceOn: true, guest: false });
    draw(null, { model } as Over);
    draw({ seq: 1, at: FIRST }, { model } as Over);
    const lines = [...msg().querySelectorAll(":scope > div > span:not([data-walk-new-words])")].map((n) => n.textContent);
    const opening = [WALK_LINE_BANK.B10.lines[0], WALK_LINE_BANK.B13.lines[4]];
    expect(lines).toEqual([...opening, WALK_LINE_BANK.B14.lines[0]]);
    const step = model.plan[FIRST];
    const chat = shownStep(step, model.moments[step.moment!], null);
    expect(chat!.body).toBe([...opening, OFFERED].join("\n"));
  });

  it("Keep my words records the decline and, with a practise to do, opens the recorder on the speaker's own sentence with Line A", () => {
    const handlers = drawClearer(true, FIRST, { practise: QUIET_PRACTISE });
    click(live()!.querySelector("[data-testid='walk-keep']"));
    expect(handlers.onKeepWords).toHaveBeenCalledWith("s-rewrite");
    // The choice lands as the speaker's bubble, then the practise opens in
    // the same chat: Line A over the speaker's own sentence, the recorder in
    // the dock (founder 2026-10-20).
    expect(said()).toEqual([COPY.linkKeepMyWords]);
    expect(screen()).toBe("walk-screen-practise");
    expect(now()!.querySelector("[data-walk-message]")!.textContent).toContain(WALK_COPY.lineA);
    expect(now()!.querySelector("[data-walk-say]")!.textContent).toBe(SAID);
    expect(live()!.querySelector("[data-walk-dock] [data-testid='walk-stop']")).not.toBeNull();
    // ✕ on the recorder goes back to the walk, the clearer version unanswered.
    click(live()!.querySelector("button[aria-label='Close']"));
    expect(screen()).toBe("walk-screen-clearer");
    expect(said()).toEqual([]);
    expect(live()!.querySelector("[data-testid='walk-keep']")).not.toBeNull();
  });
});
