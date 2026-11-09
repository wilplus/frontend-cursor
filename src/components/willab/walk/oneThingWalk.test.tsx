// @vitest-environment jsdom
/*
STORY    As a speaker, I want the walk after each Take to show me my best moment and why it worked, then one thing to improve with the tool it needs, so that I leave every Take with one clear thing to carry into the next.
OUTCOME
  O1  The walk goes in order: "Hi {name}.", my best with "This was your most confident moment." and why it worked, then "And now, one thing to improve:" and one fix; the Clearer version says "Say it straight:" and the sentence, with "Try it" and "Keep mine"; no helper-word picker, no second moment and no summary in the walk.
  O2  After the fix my helper words come on their own: "These are your helper words. …" and the words, saved as my paragraph's helper words without a pick; the Clearer version's sentence is saved from the practice it was opened on, whole, even past eight words (N323 item 2), without the sentence's punctuation at either end, as after "Keep mine" (backend N440); with no fix, my best moment's own words are my helper words, saved the same way (backend N374); a Clearer practice still opening when the helper words' short wait runs out gives my best's words, drawn and saved once, whatever it answers later (N374, C3). With the Sniper as the fix, Skip moves the walk on at once, after a try too; its line and scale stay in their one bubble above the tries; ✕ after a try keeps the game for Will and says nothing; opened again, its walk shows the helper words its stretch gave, the bar on the stretch's slide. The Sniper the server chose waits on its stretch with the typing dots at most as long as the fix waits on its clip (N373), then the walk goes on without it; with no stretch there is no "And now, one thing to improve:", in the walk or the chat: my best, my best's helper words and "Lesson done.", the bar on my best's slide.
  O3  The walk ends on "Lesson done." with Close, which ends the review and takes me back to the chat, also when I open it again before the Take is finished; no "Record Take N" in the walk.
  O5  While I record nothing appears in the thread, only the recording bar; my try is then my clip with the words I was asked to say: the Clearer version's sentence after "Try it", my own after "Keep mine"; the chat writes the same words (locked prototype X4gDmGfHH7ivuoRZ9ufiy9, record()).
  O4  From Take 2 I judge one moment of another speaker right after my try, of the level the Take's turn names: the intro line, the clip and the question in one bubble, each landing on its own behind the dots, the card I chose holding 0.28 s before my answer as my own reply with a tick ("Audio unclear", no card, at once), then "Got it.", and the walk moving on once they have landed; after it the bar names my fix's slide again for the helper words and "Lesson done."; on Take 1 I judge no one.
  O6  My best's clip and the AI clip's fix show my own words above the player, as the prototype draws them; my best played again inside the fix shows none.
  O7  Skip on the fix gets the walk's answer: "Okay, we'll skip this one.", then it goes on (backend N405); while I record, the trash is the Skip, and my taps add no bubble of mine (backend N435 items 2 and 3).
  O10 The fix lands one bubble at a time, the dots before each grey one, after the line that opens it; its buttons come once all have landed; after Skip the walk's answer, then my helper words, then "Lesson done." land the same way (backend N440).
  O9  With practice off there is nothing to try: Next on the fix posts nothing and the walk says nothing about skipping; a try that could not be checked keeps "Try it" with Skip while a try is left (backend N440).
  O11 When the fix the server chose comes without its Clearer version and its voice shows a problem too, the walk gives that same moment's AI clip after my best: "Say this one like your confident moment:" (backend N548; was the closest exercise, N536).
  O8  The thread shows no slide names, the bar does; after "Keep mine" the walk says "Your words it is." and my helper words leave out the hesitations my sentence opens with; the Sniper opens with "You rushed here. Let it breathe." in the scale's bubble and the bar names its slide (backend N435).
PROVES   O1 -> walks hello, their best and why it worked, then one thing to improve, with no picker, no second moment and no summary
         O2 -> the helper words come on their own and are saved without a pick,
               the Clearer version's sentence is saved from its practice,
               a Clearer version past eight words is saved whole as my helper words (N323 item 2),
               a Clearer practice still opening when the helper words' wait runs out gives my best's words, drawn and saved once, whatever it answers later (N374, C3),
               with no fix, my best's own words are my helper words, saved without a pick (N374)
               the Sniper as the fix: Skip after a try moves the walk on at once, as the prototype's skip() does,
               the Sniper's walk opened again shows the helper words its stretch gave (C3, B10),
               the Sniper the server chose waits on its stretch with the dots no longer than the fix waits on its clip, then the walk goes on without it (N373),
               a Sniper the server chose with no stretch promises no fix: their best, their helper words, Lesson done, their best's slide in the bar (C2, T, N374)
         O3 -> Lesson done and Close end the review, back to the chat,
               opened again before the Take is finished, with nothing of the walk waiting, Lesson done still has Close
         O7 -> the helper words come on their own and are saved without a pick,
               the Clearer version's sentence is saved from its practice
         O8 -> the helper words come on their own and are saved without a pick,
               the Sniper opens with one line in the scale's bubble, its slide in the bar
         O5 -> a try is my clip with the words I was asked to say, and nothing shows in the thread while I record
         O4 -> from Take 2, one moment of another speaker, of the Take's level, answered as my own reply,
               other speakers' moment lands one bubble at a time, its answer and Got it. after the chosen card holds, then on,
               Audio unclear holds no card: its answer and Got it. come at once, then on (J5, the prototype's judge()),
               then the bar names the fix's slide again for the helper words and Lesson done,
               Take 1 judges no one
         O6 -> my best's clip and the AI clip's fix show my own words, my best played again shows none
         O10 -> the AI clip's fix lands one bubble at a time after its opening line, then its buttons; after Skip the answer, the helper words and Lesson done land in turn,
                the Sniper's try lands after a short beat, then Will's line after the dots, under the scale, which never lands again (B7, N440)
         O11 -> the fix the server chose without its Clearer version is its own AI clip when its voice shows a problem too
         O9 -> with practice off, Next on the fix posts nothing and says nothing about skipping,
               a try that could not be checked keeps Try it with Skip
WHY      Founder 2026-10-31 (backend N309: "apply to it the one thing walk but only the walk only untill the moment that lesson done; message to close the walk NOT to record next take"; "ok, this finally good"); 2026-11-02 ("please implement"; backend N323: "you can allow helper words to be longer than 8 words"); 2026-11-03 (backend N374: a walk with no fix left no helper words; "go with the recommendations"); 2026-11-03 ("so it really matches the design and the prototype": the clips' words, prototype X4gDmGfHH7ivuoRZ9ufiy9); 2026-11-03 (backend N435, on the prototype beside the app: "remove the skip - cause trash acts like a skip", "rest is fien do it"); 2026-11-03 (backend N440, the walk's run-through: "fix 1 to 9 and 11").
*/
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHUNK_SHEET_COPY as COPY, ONE_THING_COPY, WALK_COPY } from "../idealEditCopy";
vi.mock("@/services/api/otherSpeakers", () => ({
  fetchOtherClips: vi.fn(async () => []),
  fetchOtherAnswers: vi.fn(async () => []),
  answerOtherClip: vi.fn(),
}));
import { fetchOtherClips } from "@/services/api/otherSpeakers";
/** The Sniper's microphone, open and silent: a try reads as slow, never lands. */
vi.mock("@/lib/willab/pace/paceMic", () => ({
  startPaceMic: vi.fn(async () => ({ meter: {}, voiceLike: () => 0, stop: () => undefined })),
}));
import { TEMPO_COPY, TEMPO_STAND_IN } from "@/lib/willab/tempoStep";
vi.mock("@/hooks/useDualCaptureMic", async () => {
  const React = await import("react");
  type State = { status: "idle" } | { status: "recording"; partialText: string } | { status: "stopped"; finalText: string; audioBlob: Blob; durationSec: number };
  return {
    useDualCaptureMic: () => {
      const [state, setState] = React.useState<State>({ status: "idle" });
      return {
        state,
        start: async () => setState({ status: "recording", partialText: "" }),
        stop: async () => setState({ status: "stopped", finalText: "", audioBlob: new Blob(["x".repeat(2000)]), durationSec: 4 }),
        cancel: () => setState({ status: "idle" }),
        getAudioStartedAt: () => null,
        getPausedMs: () => 0,
      };
    },
  };
});
import { WALK_ANSWER_HOLD_MS } from "@/lib/willab/walkMotion";
import FeedbackWalk, { type FeedbackWalkHelperWords, type FeedbackWalkRequest } from "./FeedbackWalk";
import { AI_CLIP_WAIT_MS } from "./WalkAiVoice";
import { buildFeedbackReplay, buildFeedbackWalk, walkAsItStands, type FeedbackWalkItem } from "@/lib/willab/feedbackWalkModel";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** A practise whose practice opens and whose try lands. */
let answer: "praise" | "again" = "praise";
const OPENS = {
  open: async () => "pr-1",
  upload: async () => ({ attemptId: "a1", attempt: 1, audio: null }),
  check: async () => ({ check: { next: answer, key: answer === "praise" ? "cue:landed_ending" : "effort" }, attemptWords: null }),
} as never;

const CUE = "Smooth and steady, no stumbling. That sounded confident!";
const SAID = "So, um, I think we're seeing traction.";
const CLEARER = "We're already seeing real traction.";
const ITEMS: FeedbackWalkItem<string>[] = [
  {
    partId: "p1", start: 0, slide: 0, blockId: "b1", tiered: true, green: true, walkSlot: "strongest", highest: true, openCard: "praise",
    paragraphText: "Ledgerly matches every transaction the moment it lands.", slideLabel: "Slide 1",
    praiseWords: [CUE], praiseLead: [CUE],
    clip: { src: "data:audio/wav;base64,", startOffsetMs: 0, durationMs: 4000 },
  },
  {
    partId: "p2", start: 100, slide: 1, blockId: "b2", tiered: true, practicePrompt: true, hasRewrite: true, walkSlot: "between",
    paragraphText: `${SAID} More next quarter.`, slideLabel: "Slide 2",
    rewrite: { quote: SAID, proposedText: CLEARER, item: "s-rewrite" }, item: "s-rewrite",
    clip: { src: "data:audio/wav;base64,", startOffsetMs: 0, durationMs: 4000 },
  },
];

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  answer = "praise";
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

type Over = Partial<Parameters<typeof FeedbackWalk<string>>[0]> & { judge?: boolean };
function draw(request: FeedbackWalkRequest | null, over: Over = {}) {
  const { judge = false, ...rest } = over;
  const props = {
    model: buildFeedbackWalk<string>({ items: ITEMS, coachNote: false, practiceOn: true, guest: false, judge }),
    request,
    coachNote: null,
    firstTake: false,
    firstName: "Maya",
    practise: OPENS,
    onSaveHelperWords: vi.fn<(save: FeedbackWalkHelperWords) => void>(),
    onEnd: vi.fn<() => void>(),
    onClose: vi.fn<() => void>(),
    onLessonDone: vi.fn<() => void>(),
    onKeepWords: vi.fn<(item: string, label?: string | null) => void>(),
    onAcceptClearer: vi.fn<(item: string, label?: string | null) => void>(),
    ...rest,
  };
  act(() => root.render(<FeedbackWalk<string> {...props} />));
  return props;
}
/** Where `key` stands in the walk's plan. */
const at = (key: string, judge = false) =>
  buildFeedbackWalk<string>({ items: ITEMS, coachNote: false, practiceOn: true, guest: false, judge }).plan.findIndex((s) => s.key === key);
const live = () => host.querySelector<HTMLElement>(".walk-layer:not(.walk-ghost)");
const now = () => live()?.querySelector<HTMLElement>("[data-walk-part][data-testid^='walk-screen-']") ?? null;
const screen = () => now()?.dataset.testid ?? null;
const text = () => live()?.textContent ?? "";
const said = () => [...(live()?.querySelectorAll("[data-walk-said]") ?? [])].map((n) => n.textContent);
const click = (el: Element | null | undefined) => act(() => (el as HTMLElement).click());
const testId = (id: string) => live()?.querySelector<HTMLElement>(`[data-testid='${id}']`) ?? null;
const settle = () => act(async () => {});
/** Stop the try; it lands, then Next. The recorder has no Skip: its trash is
 *  the way out (founder 2026-11-03). */
async function landTry() {
  expect(testId("walk-skip")).toBeNull();
  click(live()!.querySelector("[data-walk-dock] button[aria-label='Stop']"));
  await settle();
  await settle();
  click(testId("walk-forward"));
  await settle();
}

describe("the One thing walk (N309)", () => {
  it("walks hello, their best and why it worked, then one thing to improve, with no picker, no second moment and no summary", () => {
    const props = draw({ seq: 1, at: at("praise") });
    expect(live()!.querySelector("[data-walk-hello]")!.textContent).toBe("Hi Maya.");
    expect(screen()).toBe("walk-screen-praise");
    expect([...now()!.querySelectorAll("[data-walk-best]")].map((n) => n.textContent)).toEqual([
      ONE_THING_COPY.best,
      "Why it worked: smooth and steady, no stumbling. That sounded confident!",
    ]);
    // Nothing to practise on their best: Next.
    expect(testId("walk-forward")!.textContent).toBe(COPY.pagerNext);
    click(testId("walk-forward"));
    expect(screen()).toBe("walk-screen-clearer");
    expect(live()!.querySelector("[data-walk-one]")!.textContent).toBe(ONE_THING_COPY.one);
    expect(now()!.textContent).toContain(ONE_THING_COPY.sayStraight);
    expect(now()!.querySelector("[data-walk-say]")!.textContent).toBe(CLEARER);
    expect(testId("walk-forward")!.textContent).toContain(ONE_THING_COPY.tryIt);
    expect(testId("walk-keep")!.textContent).toBe(ONE_THING_COPY.keepMine);
    // No picker, no second moment, no summary, no "Record Take N" anywhere.
    const keys = props.model.plan.map((s) => s.key);
    expect(keys).not.toContain("helpers");
    expect(keys).not.toContain("summary");
    expect(keys.filter((k) => k === "praise")).toHaveLength(1);
    expect(text()).not.toContain(COPY.titleEmphasis);
    expect(text()).not.toMatch(/Record Take/);
  });

  it("the helper words come on their own and are saved without a pick", async () => {
    const props = draw({ seq: 1, at: at("clearer") });
    click(testId("walk-keep"));
    // Their choice is saved, with no message of theirs in the walk or the chat (N435 item 2, N452 item 1).
    expect(props.onKeepWords).toHaveBeenCalledWith("s-rewrite", null);
    expect(said()).toEqual([]);
    expect(text()).toContain(ONE_THING_COPY.keepWords);
    expect(text()).not.toContain(WALK_COPY.keepWords);
    // While it records: the bar alone, no Skip; its trash is the Skip (N435 item 3).
    expect(screen()).toBe("walk-screen-practise");
    expect(testId("walk-skip")).toBeNull();
    click(live()!.querySelector("[data-walk-dock] button[aria-label='Delete']"));
    await settle();
    // The walk's answer to it (N405), and they still leave with their own
    // words, without the hesitations they open with (N435 item 5).
    expect(said()).toEqual([]);
    expect(live()!.querySelector("[data-walk-skip-reply]")!.textContent).toBe(ONE_THING_COPY.skipped);
    expect(props.onSaveHelperWords).toHaveBeenCalledTimes(1);
    expect(props.onSaveHelperWords).toHaveBeenCalledWith(
      expect.objectContaining({ partId: "p2", auto: true, span: expect.objectContaining({ text: "I think we're seeing traction." }) }),
    );
    expect(text()).toContain(ONE_THING_COPY.helperWords);
    expect(live()!.querySelector("[data-walk-helper-words]")!.textContent).toBe("I think we're seeing traction");
    expect(screen()).toBe("walk-screen-done");
    // No slide name in the thread: the bar has it (N435 item 1).
    expect([...live()!.querySelectorAll("[data-walk-mark]")].map((m) => m.textContent)).toEqual(["", ""]);
    expect(live()!.querySelector("[data-walk-nav]")!.getAttribute("aria-label")).toBe("Slide 2");
  });

  it("the Clearer version's sentence is saved from its practice", async () => {
    const props = draw({ seq: 1, at: at("clearer") });
    click(testId("walk-forward"));
    expect(props.onAcceptClearer).toHaveBeenCalledWith("s-rewrite", null);
    await settle();
    click(live()!.querySelector("[data-walk-dock] button[aria-label='Delete']"));
    await settle();
    // Without the sentence's punctuation at either end (B7, N440).
    const words = "We're already seeing real traction";
    expect(live()!.querySelector("[data-walk-helper-words]")!.textContent).toBe(words);
    expect(props.onSaveHelperWords).toHaveBeenCalledWith(
      expect.objectContaining({ partId: "p2", auto: true, practiceId: "pr-1", span: { text: words, start: null, end: null } }),
    );
  });

  it("a Clearer practice still opening when the helper words' wait runs out gives my best's words, drawn and saved once, whatever it answers later (N374, C3)", async () => {
    vi.useFakeTimers();
    try {
      let opened: (id: string | null) => void = () => undefined;
      const practise = { ...(OPENS as object), open: () => new Promise<string | null>((done) => (opened = done)) } as never;
      const best = "Ledgerly matches every transaction";
      const model = buildFeedbackWalk<string>({ items: [{ ...ITEMS[0], said: best }, ITEMS[1]], coachNote: false, practiceOn: true, guest: false, judge: false });
      const props = draw({ seq: 1, at: model.plan.findIndex((s) => s.key === "clearer") }, { model, practise });
      const wait = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));
      await wait(3000);
      click(testId("walk-forward"));
      await wait(50);
      // The trash (the Skip) while the practice is still being opened.
      click(live()!.querySelector("[data-walk-dock] button[aria-label='Delete']"));
      await wait(1750);
      const helper = () => live()!.querySelector("[data-walk-helper-words]")?.textContent;
      const saved = () => vi.mocked(props.onSaveHelperWords).mock.calls.map(([save]) => save);
      expect(helper()).toBe(best);
      expect(saved()).toEqual([expect.objectContaining({ partId: "p1", span: expect.objectContaining({ text: best }) })]);
      // It opens after all: the words drawn, saved and said stay their best's.
      await act(async () => opened("pr-9"));
      await wait(500);
      act(() => root.render(<FeedbackWalk<string> {...props} />));
      await wait(250);
      expect(helper()).toBe(best);
      expect(saved()).toHaveLength(1);
      expect(saved()[0].practiceId).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("a try is my clip with the words I was asked to say, and nothing shows in the thread while I record (locked prototype, record())", async () => {
    for (const [choice, words] of [["walk-forward", CLEARER], ["walk-keep", SAID]] as const) {
      const sent: unknown[] = [];
      const practise = {
        open: async () => "pr-1",
        upload: async (...args: unknown[]) => {
          sent.push(args[4]);
          return { attemptId: "a1", attempt: 1, audio: null };
        },
        check: async () => null,
      } as never;
      draw({ seq: choice === "walk-forward" ? 1 : 2, at: at("clearer") }, { practise });
      click(testId(choice));
      await settle();
      expect(screen()).toBe("walk-screen-practise");
      // Recording: the recording bar in the dock is the only sign.
      expect(live()!.querySelector("[data-walk-live-try]")).toBeNull();
      expect(now()!.textContent).not.toContain(WALK_COPY.practiseN(1));
      click(live()!.querySelector("[data-walk-dock] button[aria-label='Stop']"));
      await settle();
      const bubble = [...live()!.querySelectorAll("[data-walk-player][data-walk-me]")].at(-1)!;
      expect(bubble.querySelector("[data-walk-try-words]")!.textContent).toBe(words);
      expect(bubble.textContent).not.toContain(WALK_COPY.practiseN(1));
      // The chat writes the same words.
      expect(sent).toEqual([words]);
    }
  });

  it("Try it and Keep mine each record against their own sentence, after ✕ on the recorder too (N309 item 1, N435 item 4)", async () => {
    const opened: string[] = [];
    const uploads: string[] = [];
    /** The server's one practice per moment, as start_practice serves it:
     *  the same id every time, an open on another sentence re-pointing it
     *  while it has no try yet, and a try of a sentence it does not hold
     *  not heard (PASSAGE_MISMATCH). */
    const server = () => {
      const held = { say: null as string | null, tries: 0 };
      const practise = {
        open: async (_item: string, passage: { kind: string; say?: string }) => {
          opened.push(passage.kind);
          if (held.tries === 0) held.say = passage.kind === "rewrite" ? (passage.say ?? null) : SAID;
          return "pr-1";
        },
        upload: async (practiceId: string, _audio: Blob, _sec: number, _at?: number, words?: string | null) => {
          uploads.push(`${practiceId}: ${words}`);
          if (!words || words !== held.say) return { unheard: true };
          held.tries += 1;
          return { attemptId: "a1", attempt: held.tries, audio: null };
        },
        check: async () => null,
      } as never;
      return { held, practise };
    };
    // Try it, ✕, then Keep mine: the practice is re-pointed to their own
    // sentence before its try, and the try is heard.
    const first = server();
    draw({ seq: 1, at: at("clearer") }, { practise: first.practise });
    click(testId("walk-forward"));
    await settle();
    click(live()!.querySelector("button[aria-label='Close']"));
    expect(screen()).toBe("walk-screen-clearer");
    click(testId("walk-keep"));
    await settle();
    click(live()!.querySelector("[data-walk-dock] button[aria-label='Stop']"));
    await settle();
    expect(opened).toEqual(["rewrite", "plain"]);
    expect(uploads).toEqual([`pr-1: ${SAID}`]);
    expect(first.held).toEqual({ say: SAID, tries: 1 });
    // Keep mine, ✕, then Try it: the Clearer sentence is saved from the
    // practice, re-pointed to it.
    opened.length = 0;
    const second = server();
    const props = draw({ seq: 2, at: at("clearer") }, { practise: second.practise });
    click(testId("walk-keep"));
    await settle();
    click(live()!.querySelector("button[aria-label='Close']"));
    click(testId("walk-forward"));
    await settle();
    click(live()!.querySelector("[data-walk-dock] button[aria-label='Delete']"));
    await settle();
    expect(opened).toEqual(["plain", "rewrite"]);
    expect(second.held.say).toBe(CLEARER);
    expect(props.onSaveHelperWords).toHaveBeenCalledWith(expect.objectContaining({ partId: "p2", practiceId: "pr-1" }));
  });

  it("a Clearer version past eight words is saved whole as my helper words (N323 item 2)", async () => {
    const twelve = "We're already seeing real traction with three paying customers this quarter alone.";
    const items = ITEMS.map((i) => (i.rewrite ? { ...i, rewrite: { ...i.rewrite, proposedText: twelve } } : i));
    const model = buildFeedbackWalk<string>({ items, coachNote: false, practiceOn: true, guest: false, judge: false });
    const props = draw({ seq: 1, at: model.plan.findIndex((s) => s.key === "clearer") }, { model });
    click(testId("walk-forward"));
    await settle();
    click(live()!.querySelector("[data-walk-dock] button[aria-label='Delete']"));
    await settle();
    const saved = "We're already seeing real traction with three paying customers this quarter alone";
    expect(live()!.querySelector("[data-walk-helper-words]")!.textContent).toBe(saved);
    expect(props.onSaveHelperWords).toHaveBeenCalledWith(
      expect.objectContaining({ partId: "p2", auto: true, practiceId: "pr-1", span: { text: saved, start: null, end: null } }),
    );
  });

  it("with no fix, my best's own words are my helper words, saved without a pick (N374)", async () => {
    const best = "Ledgerly matches every transaction";
    const model = buildFeedbackWalk<string>({ items: [{ ...ITEMS[0], said: best }], coachNote: false, practiceOn: true, guest: false, judge: false });
    const props = draw({ seq: 1, at: model.plan.findIndex((s) => s.key === "praise") }, { model });
    click(testId("walk-forward"));
    await settle();
    expect(text()).toContain(ONE_THING_COPY.helperWords);
    expect(live()!.querySelector("[data-walk-helper-words]")!.textContent).toBe(best);
    expect(props.onSaveHelperWords).toHaveBeenCalledWith(expect.objectContaining({ partId: "p1", auto: true, span: expect.objectContaining({ text: best }) }));
    expect(screen()).toBe("walk-screen-done");
  });

  it("the Sniper as the fix: Skip after a try moves the walk on at once, as the prototype's skip() does", async () => {
    const model = buildFeedbackWalk<string>({ items: [ITEMS[0]], coachNote: false, practiceOn: true, guest: false, judge: false, interventions: ["tempo"] });
    const onTempo = vi.fn();
    draw({ seq: 1, at: model.plan.findIndex((s) => s.key === "tempo") }, { model, tempo: TEMPO_STAND_IN, onTempo, tempoSlide: "The cost" });
    expect(screen()).toBe("walk-screen-tempo");
    // One line, in the scale's bubble, and its slide in the bar (N435 items 6 and 7).
    expect([...now()!.querySelectorAll("[data-walk-tempo-lead]")].map((n) => n.textContent)).toEqual([ONE_THING_COPY.letItBreathe]);
    expect(now()!.querySelector("[data-walk-tempo-lead]")!.parentElement!.querySelector("[data-walk-scale-ends]")).not.toBeNull();
    expect(text()).not.toContain(TEMPO_COPY.room);
    expect(live()!.querySelector("[data-walk-nav]")!.getAttribute("aria-label")).toBe("The cost");
    // A slow stretch opens with its own one line (N452 item 2).
    draw({ seq: 2, at: model.plan.findIndex((s) => s.key === "tempo") }, { model, tempo: { ...TEMPO_STAND_IN, reading: "slow" }, onTempo: vi.fn() });
    expect([...now()!.querySelectorAll("[data-walk-tempo-lead]")].map((n) => n.textContent)).toEqual([ONE_THING_COPY.keepItMoving]);
    draw({ seq: 3, at: model.plan.findIndex((s) => s.key === "tempo") }, { model, tempo: TEMPO_STAND_IN, onTempo, tempoSlide: "The cost" });
    // One try that misses, then Skip: no Next to press, the walk goes on.
    click(testId("walk-tempo-ready"));
    await settle();
    click(live()!.querySelector("[data-walk-dock] [data-walk-recording-strip] button"));
    expect(text()).toContain(TEMPO_COPY.tryLabel(1));
    // The line and the scale stay in their one bubble, in its first place,
    // above the try (the prototype's scale() and record()).
    const leads = [...now()!.querySelectorAll("[data-walk-tempo-lead]")];
    expect(leads).toHaveLength(1);
    expect(leads[0].parentElement!.querySelector("[data-walk-scale-ends]")).not.toBeNull();
    const tried = [...now()!.querySelectorAll("[data-walk-said]")].find((n) => n.textContent?.includes(TEMPO_COPY.tryLabel(1)))!;
    expect(leads[0].compareDocumentPosition(tried) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    click(testId("walk-tempo-skip"));
    await settle();
    expect(screen()).not.toBe("walk-screen-tempo");
    // The walk's answer, no "Skip" of theirs (N435 item 2).
    expect(said()).not.toContain(TEMPO_COPY.skip);
    expect(live()!.querySelector("[data-walk-skip-reply]")!.textContent).toBe(ONE_THING_COPY.skipped);
    // What the game was is still Will's: the try, then its end, skipped.
    const ended = onTempo.mock.calls.map(([event]) => event).find((event) => event.kind === "ended");
    expect(ended?.tries).toHaveLength(1);
    expect(ended?.skipped).toBe(true);
    // ✕ after a try: the game is still Will's, as left, and the walk says
    // nothing about skipping.
    const left = vi.fn();
    act(() => root.unmount());
    root = createRoot(host);
    draw({ seq: 1, at: model.plan.findIndex((s) => s.key === "tempo") }, { model, tempo: TEMPO_STAND_IN, onTempo: left });
    click(testId("walk-tempo-ready"));
    await settle();
    click(live()!.querySelector("[data-walk-dock] [data-walk-recording-strip] button"));
    click(live()!.querySelector("button[aria-label='Close']"));
    const games = left.mock.calls.map(([event]) => event).filter((event) => event.kind === "ended");
    expect(games).toEqual([expect.objectContaining({ tries: [expect.anything()], skipped: true, left: true })]);
    expect(live()?.querySelector("[data-walk-skip-reply]") ?? null).toBeNull();
  });

  it("the Sniper the server chose waits on its stretch with the dots no longer than the fix waits on its clip, then the walk goes on without it (N373)", async () => {
    vi.useFakeTimers();
    try {
      const best = "Ledgerly matches every transaction";
      const model = buildFeedbackWalk<string>({ items: [{ ...ITEMS[0], said: best, oneFix: "tempo" }], coachNote: false, practiceOn: true, guest: false, judge: false });
      const request = { seq: 1, at: model.plan.findIndex((s) => s.key === "praise") };
      const over = { model, takeId: "take-sniper-wait", tempoAsking: true };
      draw(request, over);
      click(testId("walk-forward"));
      await settle();
      // The typing dots, the walk's one wait, and no promise of a fix yet.
      expect(screen()).toBe("walk-screen-tempo");
      expect(now()!.querySelector("[data-walk-loading]")).not.toBeNull();
      expect(live()!.querySelector("[data-walk-one]")).toBeNull();
      await act(async () => {
        vi.advanceTimersByTime(AI_CLIP_WAIT_MS + 50);
      });
      // Waited out: on to their best's helper words and "Lesson done.".
      expect(screen()).toBe("walk-screen-done");
      expect(live()!.querySelector("[data-walk-helper-words]")!.textContent).toBe(best);
      // A stretch that comes late never draws the game the walk has left.
      draw(request, { ...over, tempoAsking: false, tempo: TEMPO_STAND_IN });
      await settle();
      expect(screen()).toBe("walk-screen-done");
      expect(live()!.querySelector("[data-walk-tempo-lead]")).toBeNull();
      expect(live()!.querySelector("[data-walk-one]")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("a Sniper the server chose with no stretch promises no fix: their best, their helper words, Lesson done, their best's slide in the bar (C2, T, N374)", async () => {
    const best = "Ledgerly matches every transaction";
    const model = buildFeedbackWalk<string>({ items: [{ ...ITEMS[0], said: best, oneFix: "tempo" }], coachNote: false, practiceOn: true, guest: false, judge: false });
    const onShown = vi.fn();
    const props = draw({ seq: 1, at: model.plan.findIndex((s) => s.key === "praise") }, { model, takeId: "take-sniper-none", tempo: null, onShown });
    click(testId("walk-forward"));
    await settle();
    expect(screen()).toBe("walk-screen-done");
    expect(live()!.querySelector("[data-walk-one]")).toBeNull();
    expect(text()).not.toContain(ONE_THING_COPY.one);
    expect(onShown.mock.calls.map(([step]) => (step as { key: string }).key)).not.toContain("one");
    expect(live()!.querySelector("[data-walk-helper-words]")!.textContent).toBe(best);
    expect(props.onSaveHelperWords).toHaveBeenCalledWith(expect.objectContaining({ partId: "p1", span: expect.objectContaining({ text: best }) }));
    expect(live()!.querySelector("[data-walk-nav]")!.getAttribute("aria-label")).toBe("Slide 1");
  });

  it("the Sniper's walk opened again shows the helper words its stretch gave (C3, B10)", () => {
    const stretch = "every frame, delivery is free";
    // The Sniper the server chose, whose rows the chat's loaded page no
    // longer holds: the words, and the bar, are still the stretch's (B6).
    const model = buildFeedbackReplay<string>({
      items: [{ ...ITEMS[0], oneFix: "tempo" }], coachNote: false, practiceOn: true, answerOf: () => null,
      helperWordsOf: (partId) => (partId === "p9" ? stretch : null), interventions: [],
    });
    const words = model.plan.findIndex((s) => s.key === "words");
    expect(words).toBeGreaterThan(model.plan.findIndex((s) => s.key === "tempo"));
    draw({ seq: 1, at: words }, {
      model,
      helperWordsOf: (partId: string) => (partId === "p9" ? stretch : null),
      tempoWords: { partId: "p9", paragraphText: `And ${stretch}.`, text: stretch, span: { text: stretch, start: 4, end: 4 + stretch.length } },
      tempoSlide: "Slide 9",
    });
    expect(live()!.querySelector("[data-walk-helper-words]")!.textContent).toBe(stretch);
    expect(live()!.querySelector("[data-walk-nav]")!.getAttribute("aria-label")).toBe("Slide 9");
  });

  it("my best's clip and the AI clip's fix show my own words, my best played again shows none", async () => {
    const best = "Ledgerly matches every transaction";
    const weak = "So, um, the market is big.";
    const items: FeedbackWalkItem<string>[] = [
      { ...ITEMS[0], said: best },
      {
        partId: "p3", start: 200, slide: 2, blockId: "b3", tiered: true, practicePrompt: true, walkSlot: "weakest",
        openCard: "exercise", hasExercise: true, paragraphText: `${weak} Really big.`, slideLabel: "Slide 3", said: weak,
        clip: { src: "data:audio/wav;base64,", startOffsetMs: 0, durationMs: 4000 },
        exercise: { video: null, byCoach: false, instruction: "Pause before the number.", say: weak, item: "s-ex" },
      },
    ];
    const model = buildFeedbackWalk<string>({ items, coachNote: false, practiceOn: true, guest: false, judge: false });
    const clipWords = () => [...now()!.querySelectorAll(".bg-primary > div:first-child:not(:last-child)")].map((n) => n.textContent);
    draw({ seq: 1, at: model.plan.findIndex((s) => s.key === "praise") }, { model });
    expect(clipWords()).toEqual([best]);
    draw({ seq: 2, at: model.plan.findIndex((s) => s.key === "exVideo") }, { model });
    await settle();
    expect(screen()).toBe("walk-screen-exVideo");
    // The fix's own clip has its words; their best played again has none.
    expect(clipWords()).toEqual([weak]);
    expect(now()!.textContent).not.toContain(best);
  });

  it("the Sniper's try lands after a short beat, then Will's line after the dots, under the scale, which never lands again (B7, N440)", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }));
    vi.useFakeTimers();
    const wait = (ms: number) => {
      for (let t = 0; t < ms; t += 50) act(() => vi.advanceTimersByTime(50));
    };
    const shown = (el: Element | null | undefined) => el != null && el.closest("[hidden]") === null;
    try {
      const model = buildFeedbackWalk<string>({ items: [ITEMS[0]], coachNote: false, practiceOn: true, guest: false, judge: false, interventions: ["tempo"] });
      draw({ seq: 1, at: model.plan.findIndex((s) => s.key === "tempo") }, { model, tempo: TEMPO_STAND_IN, onTempo: vi.fn() });
      wait(2000);
      const scale = now()!.querySelector("[data-walk-tempo-lead]");
      expect(shown(scale)).toBe(true);
      click(testId("walk-tempo-ready"));
      await act(async () => {});
      click(live()!.querySelector("[data-walk-dock] [data-walk-recording-strip] button"));
      const tried = () => [...now()!.querySelectorAll("[data-walk-said]")].find((n) => n.textContent?.includes(TEMPO_COPY.tryLabel(1)));
      const line = () => [...now()!.querySelectorAll("[data-walk-message]")].find((n) => n.textContent === ONE_THING_COPY.onceMore);
      expect(shown(tried())).toBe(false);
      wait(250);
      // The speaker's own try first, alone; Will's line still behind the dots.
      expect(shown(tried())).toBe(true);
      expect(shown(line())).toBe(false);
      expect(live()!.querySelector("[data-walk-typing]")).not.toBeNull();
      wait(500);
      expect(shown(line())).toBe(true);
      // The scale's bubble stayed where it was, the same one, never hidden.
      expect(now()!.querySelector("[data-walk-tempo-lead]")).toBe(scale);
      expect(shown(scale)).toBe(true);
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });

  it("the AI clip's fix lands one bubble at a time after its opening line, then its buttons; after Skip the answer, the helper words and Lesson done land in turn", async () => {
    // A browser that welcomes motion, on a clock run by hand.
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }));
    vi.useFakeTimers();
    const wait = (ms: number) => {
      for (let t = 0; t < ms; t += 50) act(() => vi.advanceTimersByTime(50));
    };
    const shown = (selector: string) => {
      const el = live()?.querySelector(selector) ?? null;
      return el !== null && el.closest("[hidden]") === null;
    };
    try {
      const weak = "So, um, the market is big.";
      const items: FeedbackWalkItem<string>[] = [
        { ...ITEMS[0], said: "Ledgerly matches every transaction" },
        {
          partId: "p3", start: 200, slide: 2, blockId: "b3", tiered: true, practicePrompt: true, walkSlot: "weakest",
          openCard: "exercise", hasExercise: true, paragraphText: `${weak} Really big.`, slideLabel: "Slide 3", said: weak,
          clip: { src: "data:audio/wav;base64,", startOffsetMs: 0, durationMs: 4000 },
          exercise: { video: null, byCoach: false, instruction: "Pause before the number.", say: weak, item: "s-ex" },
        },
      ];
      const model = buildFeedbackWalk<string>({ items, coachNote: false, practiceOn: true, guest: false, judge: false });
      draw({ seq: 1, at: model.plan.findIndex((s) => s.key === "praise") }, { model });
      wait(2000);
      click(testId("walk-forward"));
      // At once: the dots, nothing of the fix, no buttons.
      expect(live()!.querySelector("[data-walk-typing]")).not.toBeNull();
      expect(shown("[data-walk-one]")).toBe(false);
      expect(shown("[data-walk-like]")).toBe(false);
      expect(testId("walk-practise")).toBeNull();
      // The line that opens the fix lands first; "Say this one like…" waits.
      wait(400);
      expect(shown("[data-walk-one]")).toBe(true);
      expect(shown("[data-walk-like]")).toBe(false);
      expect(testId("walk-practise")).toBeNull();
      // Then the rest, one by one, and the buttons once all have landed.
      wait(2000);
      expect(shown("[data-walk-like]")).toBe(true);
      expect(testId("walk-practise")!.textContent).toContain(ONE_THING_COPY.tryIt);
      // Skip: the walk's answer lands behind the dots, then the helper words.
      click(testId("walk-skip"));
      expect(shown("[data-walk-skip-reply]")).toBe(false);
      expect(live()!.querySelector("[data-walk-typing]")).not.toBeNull();
      wait(400);
      expect(shown("[data-walk-skip-reply]")).toBe(true);
      expect(shown("[data-walk-helper-words]")).toBe(false);
      wait(3000);
      expect(shown("[data-walk-helper-words]")).toBe(true);
      expect(shown("[data-walk-done]")).toBe(true);
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });

  it("the fix the server chose without its Clearer version is its own AI clip when its voice shows a problem too", async () => {
    // The server chose the weakest's Clearer version; the walk could not
    // draw it, and the moment's voice shows a problem too (N548).
    const items: FeedbackWalkItem<string>[] = [
      { ...ITEMS[0], oneFix: "moment" },
      { ...ITEMS[1], hasRewrite: false, rewrite: null, item: "s-moment", voiceToo: true },
    ];
    const model = buildFeedbackWalk<string>({ items, coachNote: false, practiceOn: true, guest: false, judge: false });
    draw({ seq: 1, at: model.plan.findIndex((s) => s.key === "exVideo") }, { model });
    await settle();
    expect(screen()).toBe("walk-screen-exVideo");
    const lines = [...now()!.querySelectorAll("[data-walk-like]")].map((n) => n.textContent);
    expect(lines).toEqual([ONE_THING_COPY.likeConfident]);
  });

  it("with practice off, Next on the fix posts nothing and says nothing about skipping", async () => {
    const weak = "So, um, the market is big.";
    const items: FeedbackWalkItem<string>[] = [
      ITEMS[0],
      {
        partId: "p3", start: 200, slide: 2, blockId: "b3", tiered: true, practicePrompt: true, walkSlot: "weakest",
        openCard: "exercise", hasExercise: true, paragraphText: `${weak} Really big.`, slideLabel: "Slide 3", said: weak,
        clip: { src: "data:audio/wav;base64,", startOffsetMs: 0, durationMs: 4000 },
        exercise: { video: null, byCoach: false, instruction: "Pause before the number.", say: weak, item: "s-ex" },
      },
    ];
    const model = buildFeedbackWalk<string>({ items, coachNote: false, practiceOn: false, guest: false, judge: false });
    const onAnswer = vi.fn<(step: unknown, value: string) => void>();
    draw({ seq: 1, at: model.plan.findIndex((s) => s.key === "exVideo") }, { model, onAnswer });
    await settle();
    expect(testId("walk-practise")).toBeNull();
    click(testId("walk-forward"));
    await settle();
    expect(onAnswer).not.toHaveBeenCalledWith(expect.anything(), "skip");
    expect(said()).toEqual([]);
    expect(live()!.querySelector("[data-walk-skip-reply]")).toBeNull();
  });

  it("a try that could not be checked keeps Try it with Skip", async () => {
    // Nothing is kept or checked: no answer comes back.
    const unanswered = { open: async () => "pr-1", upload: async () => null, check: async () => null } as never;
    draw({ seq: 1, at: at("clearer") }, { practise: unanswered });
    click(testId("walk-forward"));
    await settle();
    click(live()!.querySelector("[data-walk-dock] button[aria-label='Stop']"));
    await settle();
    // No answer came back: the fix's own buttons, not the outlined Practise again.
    const again = testId("walk-again")!;
    expect(again.textContent).toBe(ONE_THING_COPY.tryIt);
    expect(again.hasAttribute("data-walk-pill-outline")).toBe(false);
    expect(testId("walk-skip")!.textContent).toBe(WALK_COPY.skip);
    click(testId("walk-skip"));
    await settle();
    expect(live()!.querySelector("[data-walk-skip-reply]")!.textContent).toBe(ONE_THING_COPY.skipped);
  });

  it("Lesson done and Close end the review, back to the chat", async () => {
    const props = draw({ seq: 1, at: at("done") });
    expect(now()!.querySelector("[data-walk-done]")!.textContent).toBe(ONE_THING_COPY.lessonDone);
    expect(testId("walk-close")!.textContent).toBe(COPY.pillClose);
    click(testId("walk-close"));
    expect(props.onLessonDone).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(1);
    // Close goes back to the chat, never onto the page's end.
    expect(props.onEnd).not.toHaveBeenCalled();
  });

  it("opened again before the Take is finished, with nothing of the walk waiting, Lesson done still has Close", () => {
    // A mark the One thing walk never shows keeps the Take unfinished; every
    // step of the walk is answered. Close must still end the review, or
    // "Continue review" stays in the chat for good (founder 2026-11-06).
    const whole = buildFeedbackWalk<string>({ items: ITEMS, coachNote: false, practiceOn: true, guest: false });
    const given = buildFeedbackReplay<string>({ items: ITEMS, coachNote: false, practiceOn: true, answerOf: () => null, helperWordsOf: () => null });
    const model = walkAsItStands(given, whole, () => false);
    const props = draw({ seq: 1, at: model.plan.findIndex((s) => s.key === "done") }, { model });
    expect(now()!.querySelector("[data-walk-done]")!.textContent).toBe(ONE_THING_COPY.lessonDone);
    click(testId("walk-close"));
    expect(props.onLessonDone).toHaveBeenCalledTimes(1);
  });

  it("from Take 2, one moment of another speaker, of the Take's level, answered as my own reply", async () => {
    vi.mocked(fetchOtherClips).mockClear();
    vi.mocked(fetchOtherClips).mockResolvedValueOnce([
      { id: "c1", src: "data:audio/wav;base64,", startOffsetMs: 0, durationMs: 3000, community: null },
    ]);
    const onOthers = vi.fn();
    const over = { judge: true, takeId: "take-7", othersLevel: "middle" as const, onOthers };
    const others = at("others", true);
    const props = draw({ seq: 1, at: others }, over);
    // Right after the fix, before the helper words.
    expect(props.model.plan[others - 1].key).toBe("practise");
    expect(props.model.plan[others + 1].key).toBe("words");
    await settle();
    expect(fetchOtherClips).toHaveBeenCalledWith("take-7", "middle");
    expect(now()!.querySelector("[data-walk-judge-intro]")!.textContent).toBe(ONE_THING_COPY.judgeIntro);
    expect(now()!.textContent).toContain(COPY.confidenceQuestion);
    expect(now()!.textContent).not.toContain(WALK_COPY.othersOne);
    click(live()!.querySelector("[data-walk-answer='yes']"));
    expect(onOthers).toHaveBeenCalledWith(0, 1, null, "yes", true);
    // The chosen card holds first (J5): the answer and "Got it." after it.
    expect(said()).not.toContain(`👍 ${WALK_COPY.judgeYes} ✓`);
    await act(async () => {
      await new Promise((r) => setTimeout(r, WALK_ANSWER_HOLD_MS + 20));
    });
    expect(said()).toContain(`👍 ${WALK_COPY.judgeYes} ✓`);
    expect(live()!.querySelector("[data-walk-got-it]")!.textContent).toBe(ONE_THING_COPY.gotIt);
    // On to the helper words and the end.
    expect(screen()).toBe("walk-screen-done");
    // The bar names the fix's slide again, not "Other speakers" (prototype carry(), dots(3)).
    expect(live()!.querySelector("[data-walk-nav]")!.getAttribute("aria-label")).toBe("Slide 2");
  });

  it("Audio unclear holds no card: its answer and Got it. come at once, then on (J5, the prototype's judge())", async () => {
    vi.mocked(fetchOtherClips).mockResolvedValueOnce([
      { id: "c1", src: "data:audio/wav;base64,", startOffsetMs: 0, durationMs: 3000, community: null },
    ]);
    const onOthers = vi.fn();
    draw({ seq: 1, at: at("others", true) }, { judge: true, takeId: "take-7", othersLevel: "middle", onOthers });
    await settle();
    click(live()!.querySelector("[data-walk-answer='audio_unclear']"));
    await settle();
    expect(onOthers).toHaveBeenCalledWith(0, 1, null, "audio_unclear", true);
    expect(said()).toContain(WALK_COPY.answerToast(WALK_COPY.judgeUnclear));
    expect(screen()).toBe("walk-screen-done");
  });

  it("other speakers' moment lands one bubble at a time, its answer and Got it. after the chosen card holds, then on", async () => {
    // A browser that welcomes motion, on a clock run by hand.
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }));
    vi.useFakeTimers();
    const wait = (ms: number) => {
      for (let t = 0; t < ms; t += 50) act(() => vi.advanceTimersByTime(50));
    };
    // In the step the walk stands on (the parts above have clips too).
    const shown = (selector: string) => {
      const el = now()?.querySelector(selector) ?? null;
      return el !== null && el.closest("[hidden]") === null;
    };
    try {
      vi.mocked(fetchOtherClips).mockResolvedValueOnce([
        { id: "c1", src: "data:audio/wav;base64,", startOffsetMs: 0, durationMs: 3000, community: null },
      ]);
      draw({ seq: 1, at: at("others", true) }, { judge: true, takeId: "take-7", othersLevel: "middle" });
      await settle();
      await settle();
      // The intro behind the dots, then the clip and its question behind theirs.
      expect(shown("[data-walk-judge-intro]")).toBe(false);
      wait(600);
      expect(shown("[data-walk-judge-intro]")).toBe(true);
      expect(shown("[data-walk-player]")).toBe(false);
      wait(600);
      expect(shown("[data-walk-player]")).toBe(true);
      click(live()!.querySelector("[data-walk-answer='yes']"));
      // The card holds; then the answer, then "Got it." behind the dots,
      // and only once they have landed does the walk move on.
      wait(250);
      expect(shown("[data-walk-said]")).toBe(false);
      wait(350);
      expect(shown("[data-walk-said]")).toBe(true);
      expect(shown("[data-walk-got-it]")).toBe(false);
      expect(screen()).toBe("walk-screen-others");
      wait(500);
      expect(live()!.querySelector("[data-walk-got-it]")!.closest("[hidden]")).toBeNull();
      expect(screen()).not.toBe("walk-screen-others");
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });

  it("Take 1 judges no one", () => {
    const props = draw(null, { judge: false });
    expect(props.model.plan.map((s) => s.key)).not.toContain("others");
  });
});
