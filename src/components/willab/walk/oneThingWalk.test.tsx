// @vitest-environment jsdom
/*
STORY    As a speaker, I want the walk after each Take to show me my best moment and why it worked, then one thing to improve with the tool it needs, so that I leave every Take with one clear thing to carry into the next.
OUTCOME
  O1  The walk goes in order: "Hi {name}.", my best with "This was your most confident moment." and why it worked, then "And now, one thing to improve:" and one fix; the Clearer version says "Say it straight:" and the sentence, with "Try it" and "Keep mine"; no helper-word picker, no second moment and no summary in the walk.
  O2  After the fix my helper words come on their own: "These are your helper words. …" and the words, saved as my paragraph's helper words without a pick; the Clearer version's sentence is saved from the practice it was opened on, whole, even past eight words (N323 item 2); with no fix, my best moment's own words are my helper words, saved the same way (backend N374).
  O3  The walk ends on "Lesson done." with Close, which ends the review and takes me back to the chat; no "Record Take N" in the walk.
  O5  While I record nothing appears in the thread, only the recording bar; my try is then my clip with the words I was asked to say: the Clearer version's sentence after "Try it", my own after "Keep mine"; the chat writes the same words (locked prototype X4gDmGfHH7ivuoRZ9ufiy9, record()).
  O4  From Take 2 I judge one moment of another speaker right after my try, of the level the Take's turn names: the intro line, the clip and the question in one bubble, my answer as my own reply with a tick, then "Got it."; on Take 1 I judge no one.
PROVES   O1 -> walks hello, their best and why it worked, then one thing to improve, with no picker, no second moment and no summary
         O2 -> the helper words come on their own and are saved without a pick,
               the Clearer version's sentence is saved from its practice,
               a Clearer version past eight words is saved whole as my helper words (N323 item 2),
               with no fix, my best's own words are my helper words, saved without a pick (N374)
         O3 -> Lesson done and Close end the review, back to the chat
         O5 -> a try is my clip with the words I was asked to say, and nothing shows in the thread while I record
         O4 -> from Take 2, one moment of another speaker, of the Take's level, answered as my own reply,
               Take 1 judges no one
WHY      Founder 2026-10-31 (backend N309: "apply to it the one thing walk but only the walk only untill the moment that lesson done; message to close the walk NOT to record next take"; "ok, this finally good"); 2026-11-02 ("please implement"; backend N323: "you can allow helper words to be longer than 8 words"); 2026-11-03 (backend N374: a walk with no fix left no helper words; "go with the recommendations").
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
      };
    },
  };
});
import { WALK_ANSWER_HOLD_MS } from "@/lib/willab/walkMotion";
import FeedbackWalk, { type FeedbackWalkHelperWords, type FeedbackWalkRequest } from "./FeedbackWalk";
import { buildFeedbackWalk, type FeedbackWalkItem } from "@/lib/willab/feedbackWalkModel";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** A practise whose practice opens: nothing is recorded or checked. */
const OPENS = { open: async () => "pr-1", upload: async () => null, check: async () => null } as never;

const CUE = "Smooth and steady, no stumbling. That sounded confident!";
const SAID = "So I think we're seeing traction.";
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
    onKeepWords: vi.fn<(item: string, label?: string) => void>(),
    onAcceptClearer: vi.fn<(item: string, label?: string) => void>(),
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
    expect(props.onKeepWords).toHaveBeenCalledWith("s-rewrite", ONE_THING_COPY.keepMine);
    expect(said()).toContain(ONE_THING_COPY.keepMine);
    // Skip on the recorder: they still leave with their own words.
    expect(screen()).toBe("walk-screen-practise");
    click(testId("walk-skip"));
    await settle();
    expect(props.onSaveHelperWords).toHaveBeenCalledTimes(1);
    expect(props.onSaveHelperWords).toHaveBeenCalledWith(expect.objectContaining({ partId: "p2", auto: true, span: expect.objectContaining({ text: SAID }) }));
    expect(text()).toContain(ONE_THING_COPY.helperWords);
    expect(live()!.querySelector("[data-walk-helper-words]")!.textContent).toBe("So I think we're seeing traction");
    expect(screen()).toBe("walk-screen-done");
  });

  it("the Clearer version's sentence is saved from its practice", async () => {
    const props = draw({ seq: 1, at: at("clearer") });
    click(testId("walk-forward"));
    expect(props.onAcceptClearer).toHaveBeenCalledWith("s-rewrite", ONE_THING_COPY.tryIt);
    await settle();
    click(testId("walk-skip"));
    await settle();
    expect(live()!.querySelector("[data-walk-helper-words]")!.textContent).toBe(CLEARER);
    expect(props.onSaveHelperWords).toHaveBeenCalledWith(
      expect.objectContaining({ partId: "p2", auto: true, practiceId: "pr-1", span: { text: CLEARER, start: null, end: null } }),
    );
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

  it("a Clearer version past eight words is saved whole as my helper words (N323 item 2)", async () => {
    const twelve = "We're already seeing real traction with three paying customers this quarter alone.";
    const items = ITEMS.map((i) => (i.rewrite ? { ...i, rewrite: { ...i.rewrite, proposedText: twelve } } : i));
    const model = buildFeedbackWalk<string>({ items, coachNote: false, practiceOn: true, guest: false, judge: false });
    const props = draw({ seq: 1, at: model.plan.findIndex((s) => s.key === "clearer") }, { model });
    click(testId("walk-forward"));
    await settle();
    click(testId("walk-skip"));
    await settle();
    expect(live()!.querySelector("[data-walk-helper-words]")!.textContent).toBe(twelve);
    expect(props.onSaveHelperWords).toHaveBeenCalledWith(
      expect.objectContaining({ partId: "p2", auto: true, practiceId: "pr-1", span: { text: twelve, start: null, end: null } }),
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
    expect(said()).toContain(`👍 ${WALK_COPY.judgeYes} ✓`);
    expect(now()!.querySelector("[data-walk-got-it]")!.textContent).toBe(ONE_THING_COPY.gotIt);
    expect(onOthers).toHaveBeenCalledWith(0, 1, null, "yes", true);
    await act(async () => {
      await new Promise((r) => setTimeout(r, WALK_ANSWER_HOLD_MS + 20));
    });
    // On to the helper words and the end.
    expect(screen()).toBe("walk-screen-done");
  });

  it("Take 1 judges no one", () => {
    const props = draw(null, { judge: false });
    expect(props.model.plan.map((s) => s.key)).not.toContain("others");
  });
});
