// @vitest-environment jsdom
/*
STORY    As a speaker, I want to replay a finished walk with my answers shown and nothing written or recorded again, so that I can look back safely.
OUTCOME
  O1  The same screens play with my answers; only a change to my helper words is saved.
  O2  A done exercise plays my past tries and records nothing new.
  O3  Opening an exercise or a try from the chat shows its AI clip (read, not made again) and every try, on the last answer.
PROVES   O1 -> opens on the coach's note and plays the same screens answered; helper words stay editable, nothing else writes
         O1 -> opened on a later step, a tap on an earlier part's helper words stands the walk there; their buttons save them and bring it back
         O2 -> opens on the coach's note and plays the same screens answered ...
         O3 -> an exercise opened from its bubble in the chat shows its AI clip and every try, a try tapped in the chat opens its exercise on the last answer
*/
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHUNK_SHEET_COPY as COPY, WALK_COPY } from "../idealEditCopy";
import FeedbackWalk from "./FeedbackWalk";
import type { WalkJudgementSave } from "./useWalkJudging";
import { buildFeedbackReplay, walkLastStep, walkStart, walkStepAt, type FeedbackWalkItem } from "@/lib/willab/feedbackWalkModel";
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
  } = {},
) {
  const model = buildFeedbackReplay<string>({
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
const picked = () =>
  [...(live()?.querySelectorAll<HTMLButtonElement>("[data-walk-word-picker] button[aria-pressed='true']") ?? [])].map(
    (b) => b.textContent,
  );

describe("the finished walk, played again", () => {
  it("opens on the coach's note and plays the same screens answered; helper words stay editable, nothing else writes", () => {
    draw();
    expect(screen()).toBe("walk-screen-coachnote");
    click(byTestId("walk-forward"));
    expect(screen()).toBe("walk-screen-praise");
    click(byTestId("walk-forward"));
    expect(screen()).toBe("walk-screen-helpers");
    expect(picked()).toEqual(["growth", "doubled."]);
    // The words saved are drawn chosen and still editable (lock 2026-10-12,
    // section 2.3): "Keep these" moves on; a new pick hands the host the words.
    expect(byTestId("walk-skip")!.textContent).toBe(WALK_COPY.keepThese);
    // Words already given: the pill edits them (founder, signed 2026-10-21).
    expect(byTestId("walk-forward")!.textContent).toBe(WALK_COPY.editHelperWords);
    click(live()!.querySelectorAll("[data-walk-word-picker] button")[2]); // "our", next to the phrase
    expect(picked()).toEqual(["our", "growth", "doubled."]);
    click(byTestId("walk-forward"));
    expect(calls).toEqual(["helpers"]);
    // The clearer version answered and practised: "✓ Practised" over Next,
    // the one ✓ line (founder 2026-10-21); no write and no recording.
    expect(screen()).toBe("walk-screen-clearer");
    expect(live()!.textContent).toContain(WALK_COPY.answeredPractised);
    expect(byTestId("walk-keep")).toBeNull();
    click(byTestId("walk-forward"));
    expect(screen()).toBe("walk-screen-exVideo");
    // The exercise already done shows its whole thread at once (founder
    // 2026-10-16): each "Practise N" with its own voice and the answer it
    // got, the recorder passed over, nothing recorded and nothing asked.
    // Next alone under it: a walk played again never practises.
    const voices = () => [...now()!.querySelectorAll("[data-walk-player][data-walk-me] audio")].map((a) => a.getAttribute("src"));
    expect(voices()).toEqual([clip.src, "blob:try-1", "blob:try-2"]);
    expect(now()!.textContent).toContain(WALK_COPY.practiseN(1));
    expect(now()!.textContent).toContain(WALK_COPY.practiseN(2));
    expect(byTestId("walk-stop")).toBeNull();
    expect(byTestId("walk-practise")).toBeNull();
    click(byTestId("walk-forward"));
    expect(["walk-screen-practise", "walk-screen-encourage", "walk-screen-improved"]).not.toContain(screen());
    expect(calls).toEqual(["helpers"]);
  });

  it("opened on a step already answered, the whole walk is in the thread: that step stands with its own buttons, Next moves on to the next part and nothing leaves (founder 2026-10-21)", () => {
    draw({ at: (m) => walkStepAt(m, { step: "helpers", part: "p1" })!, head: (m) => walkLastStep(m)! });
    const parts = () => live()!.querySelectorAll("[data-walk-part]").length;
    // The helper words stand: their own buttons in the dock, the words as
    // saved and still editable (F3).
    expect(screen()).toBe("walk-screen-helpers");
    expect(live()!.querySelector("[data-walk-now] [data-testid='walk-screen-helpers']")).not.toBeNull();
    expect(byTestId("walk-forward")!.textContent).toBe(WALK_COPY.editHelperWords);
    expect(byTestId("walk-skip")!.textContent).toBe(WALK_COPY.keepThese);
    expect(picked()).toEqual(["growth", "doubled."]);
    // The step is in view, so its own buttons are the dock: not the Next
    // that brings it back (B9), which had stood in for them whenever the
    // thread's bar named a later part (fixed 2026-10-27).
    expect(live()!.querySelector("[data-walk-dock]")!.hasAttribute("hidden")).toBe(false);
    expect(byTestId("walk-to-newest")).toBeNull();
    // Every part is there to scroll: the coach's word and the praise above,
    // the clearer version as given and the exercise with its tries below.
    const all = parts();
    expect(all).toBeGreaterThanOrEqual(5);
    expect(live()!.textContent).toContain("The new words.");
    expect(live()!.textContent).toContain(WALK_COPY.practiseN(2));
    expect(calls).toEqual([]);
    // Keep these: the walk moves on to the next part; nothing leaves the
    // thread, and the clearer version now has the buttons.
    click(byTestId("walk-skip"));
    expect(screen()).toBe("walk-screen-clearer");
    expect(parts()).toBe(all);
    expect(byTestId("walk-forward")!.textContent).toBe(COPY.pagerNext);
    click(byTestId("walk-forward"));
    // The exercise, one part with every try: it stands on its last answer.
    expect(screen()).toBe("walk-screen-improved");
    expect(live()!.querySelector("[data-walk-now]")!.textContent).toContain(WALK_COPY.practiseN(2));
    expect(parts()).toBe(all);
    expect(calls).toEqual([]);
  });

  it("opened on a later step, a tap on an earlier part's helper words stands the walk there; their buttons save them and bring it back (C3, B10)", () => {
    draw({ at: (m) => walkStepAt(m, { step: "clearer", part: "p2" })!, head: (m) => walkLastStep(m)! });
    expect(screen()).toBe("walk-screen-clearer");
    // The founder's report, 2026-10-28: the earlier picker took no tap.
    click(live()!.querySelectorAll("[data-walk-word-picker] button")[2]); // "our", next to the phrase
    expect(screen()).toBe("walk-screen-helpers");
    expect(picked()).toEqual(["our", "growth", "doubled."]);
    expect(byTestId("walk-forward")!.textContent).toBe(WALK_COPY.editHelperWords);
    click(byTestId("walk-forward"));
    expect(calls).toEqual(["helpers"]);
    expect(screen()).toBe("walk-screen-clearer");
  });

  it("scrolled away from the step the walk stands on, the dock reads Next, which brings that step back (B9)", () => {
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
      draw({ at: (m) => walkStepAt(m, { step: "helpers", part: "p1" })!, head: (m) => walkLastStep(m)! });
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
