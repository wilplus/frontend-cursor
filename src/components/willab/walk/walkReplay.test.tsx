// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  The finished walk, played again (founder 2026-10-08, Q-IT643b A): the      */
/*  same screens with the answers as given; a tap that would write moves on   */
/*  instead; a judgement may still be changed (D-FW-9).                        */
/* -------------------------------------------------------------------------- */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FeedbackWalk from "./FeedbackWalk";
import type { WalkJudgementSave } from "./useWalkJudging";
import { buildFeedbackReplay, walkStart, type FeedbackWalkItem } from "@/lib/willab/feedbackWalkModel";
import { WALK_ANSWER_HOLD_MS } from "@/lib/willab/walkMotion";
import type { WalkPractiseIO } from "@/services/api/walkPractise";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const clip = { src: "data:audio/wav;base64,", startOffsetMs: 0, durationMs: 9000 };
const ITEMS: FeedbackWalkItem<string>[] = [
  { partId: "p1", start: 0, slide: 1, blockId: "b1", openCard: "praise", paragraphText: "Last quarter our growth doubled.", slideLabel: "Slide 2", praiseWords: ["A signed line."], clip },
  { partId: "p1", start: 1, slide: 1, blockId: "b1", feedbackFamily: "confident_voice", paragraphText: "Last quarter our growth doubled.", slideLabel: "Slide 2", clip, judge: "cv-1" },
  {
    partId: "p2", start: 50, slide: 1, blockId: "b2", feedbackFamily: "rewrite_clarity", paragraphText: "The old words.", slideLabel: "Slide 2", clip,
    rewrite: { quote: "The old words.", proposedText: "The new words.", item: "rw-2" }, item: "rw-2",
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

function draw() {
  const model = buildFeedbackReplay<string>({
    items: ITEMS,
    coachNote: true,
    practiceOn: true,
    answerOf: (item) => ({ "cv-1": "yes", "cv-2": "no" } as const)[item as "cv-1" | "cv-2"] ?? null,
    helperWordsOf: (partId) => (partId === "p1" ? "growth doubled" : null),
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
  act(() => root.render(<FeedbackWalk {...props} request={{ seq: 1, at: walkStart(model)! }} />));
}

const live = () => host.querySelector<HTMLElement>(".walk-layer:not(.walk-ghost)");
const screen = () => live()?.querySelector<HTMLElement>("[data-testid^='walk-screen-']")?.dataset.testid ?? null;
const click = (el: Element | null | undefined) => act(() => (el as HTMLElement).click());
const byTestId = (id: string) => live()?.querySelector<HTMLElement>(`[data-testid='${id}']`) ?? null;
const pressed = () => live()?.querySelector("[data-walk-answer][aria-pressed='true']")?.getAttribute("data-walk-answer") ?? null;
const picked = () =>
  [...(live()?.querySelectorAll<HTMLButtonElement>("[data-walk-word-picker] button[aria-pressed='true']") ?? [])].map(
    (b) => b.textContent,
  );

describe("the finished walk, played again", () => {
  it("opens on the coach's note and plays every screen with the answers as given, writing nothing", () => {
    draw();
    expect(screen()).toBe("walk-screen-coachnote");
    click(byTestId("walk-forward"));
    expect(screen()).toBe("walk-screen-praise");
    click(byTestId("walk-forward"));
    expect(screen()).toBe("walk-screen-helpers");
    expect(picked()).toEqual(["growth", "doubled."]);
    // A tap on a word changes nothing; "Use these helper words" moves on.
    click(live()!.querySelector("[data-walk-word-picker] button"));
    expect(picked()).toEqual(["growth", "doubled."]);
    click(byTestId("walk-forward"));
    expect(screen()).toBe("walk-screen-clearer");
    click(byTestId("walk-forward")); // "Accept and practise": no write, no recording
    expect(screen()).toBe("walk-screen-exVideo");
    click(byTestId("walk-forward")); // "Practise": no recording
    expect(screen()).toBe("walk-screen-intro");
    click(byTestId("walk-forward"));
    expect(screen()).toBe("walk-screen-judge");
    expect(pressed()).toBe("yes");
    expect(calls).toEqual([]);
  });

  it("a judgement may still be changed, saved beside the first (D-FW-9); the same answer sends nothing", () => {
    draw();
    for (const id of ["walk-forward", "walk-forward", "walk-forward", "walk-keep", "walk-skip", "walk-forward"]) {
      click(byTestId(id));
    }
    expect(screen()).toBe("walk-screen-judge");
    expect(pressed()).toBe("yes");
    click(live()!.querySelector("[data-walk-answer='yes']"));
    act(() => vi.advanceTimersByTime(WALK_ANSWER_HOLD_MS));
    expect(pressed()).toBe("no");
    click(live()!.querySelector("[data-walk-answer='in_between']"));
    act(() => vi.advanceTimersByTime(WALK_ANSWER_HOLD_MS));
    expect(judged).toEqual([
      { item: "cv-1", answer: "yes", earlier: "yes" },
      { item: "cv-2", answer: "in_between", earlier: "no" },
    ]);
    expect(ended).toBe(1);
    expect(calls).toEqual([]);
  });

  it("Skip on \"Judgement time!\" settles nothing: every judgement was answered", () => {
    draw();
    for (const id of ["walk-forward", "walk-forward", "walk-skip", "walk-keep", "walk-skip"]) click(byTestId(id));
    expect(screen()).toBe("walk-screen-intro");
    click(byTestId("walk-skip"));
    expect(calls).toEqual([]);
    expect(ended).toBe(1);
  });
});
