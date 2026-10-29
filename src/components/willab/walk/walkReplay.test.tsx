// @vitest-environment jsdom
/*
STORY    As a speaker, I want a finished walk opened again to be one scroll of everything I went through, with my answers and no buttons, nothing written or recorded again, so that I can look back safely.
OUTCOME
  O1  Opened again, the whole walk is one scroll with my answers in it, and no buttons and no Next under it; nothing is written (N259).
  O2  A done exercise shows my past tries and records nothing new.
  O3  Opening an exercise or a try from the chat shows its AI clip (read, not made again) and every try, on the last answer.
  O4  A tap on my helper words brings their buttons; saving takes them away again, and so does Keep these, which leaves the words as saved (C3, N259).
  O5  A walk not yet done keeps its buttons: scrolled away from the step it stands on, they read Next, which brings that step back (B9).
PROVES   O1 -> opened again, the whole walk is one scroll: every part answered, no buttons and no Next, nothing written
         O2 -> opened again, the whole walk is one scroll ...
         O3 -> an exercise opened from its bubble in the chat shows its AI clip and every try, a try tapped in the chat opens its exercise on the last answer
         O4 -> a tap on helper words brings their buttons; saving or keeping them takes the buttons away again
         O5 -> a walk not yet done: scrolled away from the step it stands on, the dock reads Next, which brings that step back
*/
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHUNK_SHEET_COPY as COPY, WALK_COPY } from "../idealEditCopy";
import FeedbackWalk from "./FeedbackWalk";
import type { WalkJudgementSave } from "./useWalkJudging";
import { buildFeedbackReplay, walkAsItStands, walkLastStep, walkStart, walkStepAt, type FeedbackWalkItem } from "@/lib/willab/feedbackWalkModel";
import type { WalkPractiseIO } from "@/services/api/walkPractise";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// The AI clip already made for the practice: read, never made again.
const aiReads = vi.hoisted(() => [] as string[]);
vi.mock("@/services/api/aiVoice", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/api/aiVoice")>()),
  readAiVoice: async (practiceId: string) => {
    aiReads.push(practiceId);
    return { ok: true, data: { demo: "ai_voice", clip: { state: "ready", url: "blob:ai", durationMs: 3000, why: null } } };
  },
  ensureAiVoice: async () => {
    aiReads.push("ensure");
    return { ok: false };
  },
}));

const clip = { src: "data:audio/wav;base64,", startOffsetMs: 0, durationMs: 9000 };
const ITEMS: FeedbackWalkItem<string>[] = [
  { partId: "p1", start: 0, slide: 1, blockId: "b1", openCard: "praise", paragraphText: "Last quarter our growth doubled.", slideLabel: "Slide 2", praiseWords: ["A signed line."], clip },
  { partId: "p1", start: 1, slide: 1, blockId: "b1", feedbackFamily: "confident_voice", paragraphText: "Last quarter our growth doubled.", slideLabel: "Slide 2", clip, judge: "cv-1" },
  {
    partId: "p2", start: 50, slide: 1, blockId: "b2", feedbackFamily: "rewrite_clarity", paragraphText: "The old words.", slideLabel: "Slide 2", clip,
    rewrite: { quote: "The old words.", proposedText: "The new words.", item: "rw-2", decided: "keep" }, item: "rw-2",
  },
  { partId: "p2", start: 51, slide: 1, blockId: "b2", feedbackFamily: "confident_voice", paragraphText: "The old words.", slideLabel: "Slide 2", clip, judge: "cv-2" },
  {
    partId: "p3", start: 90, slide: 1, blockId: "b3", openCard: "exercise", hasExercise: true, paragraphText: "Two hires by March.", slideLabel: "Slide 2", clip,
    exercise: { video: "data:video/mp4;base64,", byCoach: true, instruction: "Land on March.", say: "Two hires by March.", item: "ex-3" },
  },
];

let host: HTMLDivElement;
let root: Root;
let calls: string[];
let judged: WalkJudgementSave<string>[];
let ended: number;
beforeEach(() => {
  vi.useFakeTimers();
  calls = [];
  aiReads.length = 0;
  judged = [];
  ended = 0;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

/** A practise IO that notes every call: the replay must make none. */
const PRACTISE: WalkPractiseIO<string> = {
  open: async () => {
    calls.push("practise:open");
    return null;
  },
  upload: async () => {
    calls.push("practise:upload");
    return null;
  },
  check: async () => {
    calls.push("practise:check");
    return null;
  },
} as unknown as WalkPractiseIO<string>;

function draw(
  opts: {
    practiceId?: string;
    at?: (model: ReturnType<typeof buildFeedbackReplay<string>>) => number;
    /** The furthest part drawn: the whole walk, opened on `at` (founder 2026-10-21). */
    head?: (model: ReturnType<typeof buildFeedbackReplay<string>>) => number;
    /** The Take not done yet: the walk as it stands, with its buttons. */
    notDone?: boolean;
  } = {},
) {
  const done = buildFeedbackReplay<string>({
    items: ITEMS,
    coachNote: true,
    practiceOn: true,
    answerOf: (item) => ({ "cv-1": "yes", "cv-2": "no" } as const)[item as "cv-1" | "cv-2"] ?? null,
    helperWordsOf: (partId) => (partId === "p1" ? "growth doubled" : null),
    // The exercise was practised twice: "not yet", then praise.
    triesOf: (moment) =>
      moment.partId === "p3"
        ? { practiceId: opts.practiceId ?? null, outcomes: ["again", "praise"], audios: { 1: { url: "blob:try-1", durationMs: 4000 }, 2: { url: "blob:try-2", durationMs: 4200 } } }
        : null,
  });
  // Every moment here answered, so the walk as it stands draws them all as given.
  const model = opts.notDone ? walkAsItStands(done, done, () => false) : done;
  const props = {
    model,
    coachNote: { text: "Let the pause breathe.", videoUrl: "data:video/mp4;base64,", takeIndex: 2 },
    firstTake: false,
    practise: PRACTISE,
    onSaveHelperWords: () => calls.push("helpers"),
    onAcceptClearer: () => calls.push("accept"),
    onKeepWords: () => calls.push("keep"),
    onJudge: (save: WalkJudgementSave<string>) => judged.push(save),
    onSkipJudging: () => calls.push("skip"),
    onEnd: () => {
      ended += 1;
    },
  };
  act(() => root.render(<FeedbackWalk {...props} request={null} />));
  act(() =>
    root.render(
      <FeedbackWalk {...props} request={{ seq: 1, at: opts.at?.(model) ?? walkStart(model)!, ...(opts.head ? { head: opts.head(model) } : {}) }} />,
    ),
  );
  /** The host opens the walk again while the lens is still open (Next from
   *  a step played again to the step that waits). */
  return (at: (m: typeof model) => number) =>
    act(() => root.render(<FeedbackWalk {...props} request={{ seq: 2, at: at(model) }} />));
}

const live = () => host.querySelector<HTMLElement>(".walk-layer:not(.walk-ghost)");
/** The newest part of the walk's chat: the step it stands on. */
const now = () => live()?.querySelector<HTMLElement>("[data-walk-part][data-testid^='walk-screen-']") ?? null;
const screen = () => now()?.dataset.testid ?? null;
const click = (el: Element | null | undefined) => act(() => (el as HTMLElement).click());
const byTestId = (id: string) => live()?.querySelector<HTMLElement>(`[data-testid='${id}']`) ?? null;
const pressed = () => live()?.querySelector("[data-walk-answer][aria-pressed='true']")?.getAttribute("data-walk-answer") ?? null;
/** The dock under the thread, and whether anything shows there. */
const dock = () => live()!.querySelector<HTMLElement>("[data-walk-dock]")!;
const noButtons = () => dock().hidden && live()!.querySelector("[data-walk-dock-next]") === null;
const picked = () =>
  [...(live()?.querySelectorAll<HTMLButtonElement>("[data-walk-word-picker] button[aria-pressed='true']") ?? [])].map(
    (b) => b.textContent,
  );

describe("the finished walk, played again", () => {
  it("opened again, the whole walk is one scroll: every part answered, no buttons and no Next, nothing written", () => {
    draw({ head: (m) => walkLastStep(m)! });
    // Every part as it went: the coach's word, the praise, the helper words
    // as saved, the clearer version as given and the exercise with its tries.
    expect(live()!.textContent).toContain("Let the pause breathe.");
    expect(picked()).toEqual(["growth", "doubled."]);
    expect(live()!.textContent).toContain("The new words.");
    const voices = () => [...live()!.querySelectorAll("[data-walk-player][data-walk-me] audio")].map((a) => a.getAttribute("src"));
    expect(voices()).toEqual(expect.arrayContaining([clip.src, "blob:try-1", "blob:try-2"]));
    expect(live()!.textContent).toContain(WALK_COPY.practiseN(2));
    // A scroll (N259): nothing under the thread, nothing recorded or written.
    expect(noButtons()).toBe(true);
    expect(live()!.querySelector("[data-walk-recording-strip], [data-testid='walk-stop']")).toBeNull();
    expect(calls).toEqual([]);
  });

  it("a tap on helper words brings their buttons; saving or keeping them takes the buttons away again", () => {
    draw({ at: (m) => walkStepAt(m, { step: "clearer", part: "p2" })!, head: (m) => walkLastStep(m)! });
    expect(noButtons()).toBe(true);
    const word = () => live()!.querySelectorAll("[data-walk-word-picker] button")[2]; // "our", next to the phrase
    // A tap: the words' own buttons, and only theirs (C3).
    click(word());
    expect(picked()).toEqual(["our", "growth", "doubled."]);
    expect(dock().hidden).toBe(false);
    expect(byTestId("walk-forward")!.textContent).toBe(WALK_COPY.editHelperWords);
    expect(byTestId("walk-skip")!.textContent).toBe(WALK_COPY.keepThese);
    // Saved: the host has the words, the buttons go, the scroll stays put.
    click(byTestId("walk-forward"));
    expect(calls).toEqual(["helpers"]);
    expect(noButtons()).toBe(true);
    expect(picked()).toEqual(["our", "growth", "doubled."]);
    // Another tap, then Keep these: the words go back as saved, nothing written.
    click(word());
    expect(picked()).toEqual(["growth", "doubled."]);
    click(byTestId("walk-skip"));
    expect(picked()).toEqual(["our", "growth", "doubled."]);
    expect(noButtons()).toBe(true);
    expect(calls).toEqual(["helpers"]);
  });

  it("a walk not yet done: scrolled away from the step it stands on, the dock reads Next, which brings that step back", () => {
    // The thread holds more than it shows: 1000 tall, 400 in view. The
    // standing part sits at 20..120 of the thread; everything else at 500.
    const isBody = (el: Element) => el.hasAttribute("data-walk-thread-body");
    const body = () => live()!.querySelector<HTMLElement>("[data-walk-thread-body]")!;
    const tall = vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(function (this: HTMLElement) {
      return isBody(this) ? 1000 : 0;
    });
    const seen = vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(function (this: HTMLElement) {
      return isBody(this) ? 400 : 0;
    });
    const high = vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
      return isBody(this) ? 400 : 100;
    });
    const rect = vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      const scrolled = isBody(this) ? 0 : (this.closest("[data-walk-thread-body]") as HTMLElement | null)?.scrollTop ?? 0;
      const top = isBody(this) ? 0 : this.closest("[data-walk-now]") ? 20 - scrolled : 500 - scrolled;
      return { top, bottom: top + 100, left: 0, right: 0, width: 0, height: 100, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
    });
    const tops: number[] = [];
    const was = Element.prototype.scrollTo;
    Element.prototype.scrollTo = function (this: Element, to?: ScrollToOptions | number) {
      const top = typeof to === "object" ? (to.top ?? 0) : 0;
      tops.push(top);
      (this as HTMLElement).scrollTop = top;
    } as typeof Element.prototype.scrollTo;
    const scrolledTo = (top: number) => {
      body().scrollTop = top;
      act(() => body().dispatchEvent(new Event("scroll", { bubbles: true })));
    };
    try {
      draw({ at: (m) => walkStepAt(m, { step: "helpers", part: "p1" })!, head: (m) => walkLastStep(m)!, notDone: true });
      // Opened with its name at the top: its own buttons are the dock.
      expect(screen()).toBe("walk-screen-helpers");
      expect(live()!.querySelector("[data-walk-dock]")!.hasAttribute("hidden")).toBe(false);
      expect(byTestId("walk-to-newest")).toBeNull();
      // Scrolled past it: the dock reads Next.
      scrolledTo(500);
      expect(live()!.querySelector("[data-walk-dock]")!.hasAttribute("hidden")).toBe(true);
      expect(byTestId("walk-to-newest")!.textContent).toBe(COPY.pagerNext);
      // Next brings the step back, its name at the top, and its buttons return.
      tops.length = 0;
      click(byTestId("walk-to-newest"));
      expect(tops.at(-1)).toBe(12);
      scrolledTo(12);
      expect(live()!.querySelector("[data-walk-dock]")!.hasAttribute("hidden")).toBe(false);
      expect(byTestId("walk-to-newest")).toBeNull();
      expect(byTestId("walk-forward")!.textContent).toBe(WALK_COPY.editHelperWords);
    } finally {
      Element.prototype.scrollTo = was;
      rect.mockRestore();
      high.mockRestore();
      tall.mockRestore();
      seen.mockRestore();
    }
  });

  it("a new opening while the lens stays open keeps the thread above it: nothing disappears (founder 2026-10-20)", () => {
    const reopen = draw();
    expect(screen()).toBe("walk-screen-coachnote");
    reopen((model) => walkStepAt(model, { step: "helpers", moment: null, part: "p1" })!);
    expect(screen()).toBe("walk-screen-helpers");
    // The coach's note the speaker just read stays above, as it was drawn;
    // the step that is live now is the new opening's, not the copy's.
    const kept = live()!.querySelector("[data-walk-kept]");
    expect(kept?.textContent).toContain("Let the pause breathe.");
    expect(kept?.querySelector("[data-testid]")).toBeNull();
  });

  it("an exercise opened from its bubble in the chat shows its AI clip and every try, as from its paragraph", async () => {
    draw({ practiceId: "pr-3", at: (model) => walkStepAt(model, { step: "exVideo", moment: null, part: "p3" })! });
    await act(async () => {});
    expect(screen()).toBe("walk-screen-improved");
    expect(aiReads).toEqual(["pr-3"]);
    expect(live()!.querySelector("[data-walk-ai-voice]")).not.toBeNull();
    expect(live()!.textContent).toContain(WALK_COPY.practiseN(1));
    expect(live()!.textContent).toContain(WALK_COPY.practiseN(2));
  });

  it("a try tapped in the chat opens its exercise on the last answer, the whole thread on screen", () => {
    const model = buildFeedbackReplay<string>({
      items: ITEMS,
      coachNote: false,
      practiceOn: true,
      answerOf: () => null,
      helperWordsOf: () => null,
      triesOf: (moment) => (moment.partId === "p3" ? { practiceId: null, outcomes: ["again"], audios: {} } : null),
    });
    const at = walkStepAt(model, { step: "exVideo", moment: null, part: "p3" });
    expect(at).not.toBeNull();
    expect(model.plan[at!].key).toBe("encourage");
  });
});
