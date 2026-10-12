// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  "Judgement time!", the Journal post and the judgements in the Feedback     */
/*  walk (build plan D-FW-18; walk lock flow 9-10; JP1 A, Q-B4 A, WQ4 A,       */
/*  Q-B6 A; QA1 A).                                                            */
/* -------------------------------------------------------------------------- */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHUNK_SHEET_COPY as COPY, WALK_COPY } from "../idealEditCopy";
import FeedbackWalk from "./FeedbackWalk";
import { type WalkJudgementSave } from "./useWalkJudging";
import type { WalkJournalPost } from "./WalkJudgementScreens";
import { buildFeedbackWalk, type FeedbackWalkItem } from "@/lib/willab/feedbackWalkModel";
import { WALK_ANSWER_HOLD_MS } from "@/lib/willab/walkMotion";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const clip = { src: "data:audio/wav;base64,", startOffsetMs: 0, durationMs: 9000 };
const ITEMS: FeedbackWalkItem<string>[] = [
  { partId: "p1", start: 0, slide: 1, blockId: "b1", feedbackFamily: "confident_voice", paragraphText: "One.", slideLabel: "Slide 2", clip, judge: "cv-1" },
  { partId: "p1", start: 1, slide: 1, blockId: "b1", openCard: "praise", paragraphText: "One.", slideLabel: "Slide 2", praiseWords: ["A signed line."], clip },
  {
    partId: "p2", start: 50, slide: 1, blockId: "b2", feedbackFamily: "rewrite_clarity", paragraphText: "The old words.", slideLabel: "Slide 2", clip,
    rewrite: { quote: "The old words.", proposedText: "The new words.", item: "rw-2" },
  },
  { partId: "p2", start: 51, slide: 1, blockId: "b2", feedbackFamily: "confident_voice", paragraphText: "The old words.", slideLabel: "Slide 2", clip, judge: "cv-2" },
  { partId: "p3", start: 90, slide: 1, blockId: "b3", feedbackFamily: "confident_voice", paragraphText: "Three.", slideLabel: "Slide 2", clip, judge: "cv-3" },
];
const POST: WalkJournalPost = {
  title: "Why we ask you to judge honestly",
  body: "First paragraph of the post.\n\nSecond paragraph of the post.",
};

let host: HTMLDivElement;
let root: Root;
let judged: WalkJudgementSave<string>[];
let skipped: string[][];
let ended: number;
let guests: number;
beforeEach(() => {
  vi.useFakeTimers();
  judged = [];
  skipped = [];
  ended = 0;
  guests = 0;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

function draw(over: { journal?: WalkJournalPost | null; guest?: boolean; at?: "intro" } = {}) {
  const model = buildFeedbackWalk({ items: ITEMS, coachNote: false, practiceOn: false, guest: over.guest ?? false });
  const props = {
    model,
    coachNote: null,
    firstTake: false,
    guest: over.guest,
    onGuest: () => {
      guests += 1;
    },
    onSaveHelperWords: () => undefined,
    onJudge: (save: WalkJudgementSave<string>) => judged.push(save),
    onSkipJudging: (items: string[]) => skipped.push(items),
    journal: over.journal === undefined ? POST : over.journal,
    onEnd: () => {
      ended += 1;
    },
  };
  const at = model.plan.findIndex((s) => s.key === (over.at ?? "clearer"));
  act(() => root.render(<FeedbackWalk {...props} request={null} />));
  act(() => root.render(<FeedbackWalk {...props} request={{ seq: 1, at }} />));
  return model;
}

const live = () => host.querySelector<HTMLElement>(".walk-layer:not(.walk-ghost)");
const screen = () => live()?.querySelector<HTMLElement>("[data-testid^='walk-screen-']")?.dataset.testid ?? null;
const click = (el: Element | null | undefined) => act(() => (el as HTMLElement).click());
const byTestId = (id: string) => live()?.querySelector<HTMLElement>(`[data-testid='${id}']`) ?? null;
const answerButton = (value: string) => live()!.querySelector<HTMLElement>(`[data-walk-answer='${value}']`);
const pressed = () => live()?.querySelector("[data-walk-answer][aria-pressed='true']")?.getAttribute("data-walk-answer") ?? null;
const toast = () => host.querySelector("[data-walk-toast]")?.textContent ?? null;
const navMoment = () => live()!.querySelector("[data-walk-nav]")!.getAttribute("aria-label");

/** From the clearer version ("Keep my words") to "Judgement time!". */
function toIntro() {
  expect(screen()).toBe("walk-screen-clearer");
  click(byTestId("walk-keep"));
  expect(screen()).toBe("walk-screen-intro");
}
/** "I am going to judge them honestly". */
function promise() {
  click(byTestId("walk-forward"));
  expect(screen()).toBe("walk-screen-judge");
}

describe("the judgements", () => {

  it("an answer fills black, holds 0.28 s, is handed to the host, then moves on with the toast", () => {
    draw();
    toIntro();
    promise();
    click(answerButton("yes"));
    expect(pressed()).toBe("yes");
    expect(judged).toEqual([]);
    expect(screen()).toBe("walk-screen-judge");
    expect(navMoment()).toContain(`${COPY.pagerMoment} 1 `);
    act(() => vi.advanceTimersByTime(WALK_ANSWER_HOLD_MS - 10));
    expect(judged).toEqual([]);
    expect(toast()).toBeNull();
    act(() => vi.advanceTimersByTime(10));
    expect(judged).toEqual([{ item: "cv-1", answer: "yes", earlier: null }]);
    expect(toast()).toBe("Yes ✓");
    expect(toast()).toBe(WALK_COPY.answerToast("Yes"));
    expect(navMoment()).toContain(`${COPY.pagerMoment} 2 `);
    expect(pressed()).toBeNull();
  });
});

describe("AC-9", () => {
  it("shows no digit, family, read or score on the intro, the post's screen or a judgement", () => {
    draw();
    toIntro();
    expect(live()!.textContent).not.toMatch(/\d/);
    click(byTestId("walk-journal"));
    expect(live()!.textContent).not.toMatch(/\d|score|%/i);
    click(byTestId("walk-journal-back"));
    promise();
    const html = host.innerHTML;
    expect(html).not.toMatch(/confident_voice|rewrite_clarity|great_formulation|openCard|score|%|cv-1/i);
    const shown = (live()!.textContent ?? "")
      .replace("Slide 2", "")
      .replace(`${COPY.pagerMoment} 1 ${COPY.pagerOf} 3`, "")
      .replace(/\d:\d{2}/g, "");
    expect(shown).not.toMatch(/\d/);
  });
});
