// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  "Judgement time!", the Journal post and the judgements in the Feedback     */
/*  walk (build plan D-FW-18; walk lock flow 9-10; JP1 A, Q-B4 A, WQ4 A,       */
/*  Q-B6 A; QA1 A).                                                            */
/* -------------------------------------------------------------------------- */
import { readFileSync } from "node:fs";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHUNK_SHEET_COPY as COPY, WALK_COPY } from "../idealEditCopy";
import FeedbackWalk from "./FeedbackWalk";
import { toastRides, type WalkJudgementSave } from "./useWalkJudging";
import type { WalkJournalPost } from "./WalkJudgementScreens";
import { buildFeedbackWalk, type FeedbackWalkItem } from "@/lib/willab/feedbackWalkModel";
import { WALK_ANSWER_HOLD_MS } from "@/lib/willab/walkMotion";
import type { WalkStep } from "@/lib/willab/walkPlan";

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
const hold = () => act(() => vi.advanceTimersByTime(WALK_ANSWER_HOLD_MS));
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

describe('"Judgement time!"', () => {
  it("comes after the practising, cross-fading in, with the signed words", () => {
    draw();
    toIntro();
    expect(live()!.dataset.walkMove).toBe("fade");
    expect(live()!.className).toContain("walk-m-fade");
    const text = live()!.textContent ?? "";
    expect(text).toContain(WALK_COPY.judgementTitle);
    expect(text).toContain(WALK_COPY.judgementHonesty);
    expect(byTestId("walk-forward")!.textContent).toBe(WALK_COPY.judgementPromise);
    expect(byTestId("walk-skip")!.textContent).toBe(WALK_COPY.skip);
    expect(byTestId("walk-journal")!.textContent).toBe(WALK_COPY.judgementJournalLink);
  });

  it("the grey link opens the Journal post inside the overlay; ‹ and Back return to the intro", () => {
    draw();
    toIntro();
    click(byTestId("walk-journal"));
    expect(screen()).toBe("walk-screen-journal");
    expect(host.querySelectorAll("[data-walk-stage]")).toHaveLength(1);
    expect(live()!.querySelector("[data-walk-eyebrow]")!.textContent).toBe(WALK_COPY.journalEyebrow);
    expect(live()!.querySelector("[data-walk-journal-title]")!.textContent).toBe(POST.title);
    expect([...live()!.querySelectorAll("p")].map((p) => p.textContent)).toEqual([
      "First paragraph of the post.",
      "Second paragraph of the post.",
    ]);
    // No ✕ on the post: it goes back to the intro, nowhere else.
    expect(live()!.querySelector("button[aria-label='Close']")).toBeNull();
    click(byTestId("walk-journal-back"));
    expect(byTestId("walk-journal-back")).toBeNull();
    expect(screen()).toBe("walk-screen-intro");
    click(byTestId("walk-journal"));
    expect(byTestId("walk-journal-back")!.textContent).toBe(COPY.linkBack);
    click(live()!.querySelector(`button[aria-label='${COPY.pagerBack}']`));
    expect(screen()).toBe("walk-screen-intro");
    expect(ended).toBe(0);
  });

  it("with no post to open there is no link, never a broken screen", () => {
    draw({ journal: null });
    toIntro();
    expect(byTestId("walk-journal")).toBeNull();
    expect(live()!.textContent).not.toContain(WALK_COPY.judgementJournalLink);
  });
});

describe("the judgements", () => {
  it("one per moment still open: the voice only, the one question, the shared answers", () => {
    draw();
    toIntro();
    promise();
    expect(navMoment()).toBe(`Slide 2 · ${COPY.pagerMoment} 1 ${COPY.pagerOf} 3`);
    expect(live()!.querySelector("h2")!.textContent).toBe(COPY.titleFeedback);
    expect(live()!.querySelector("[data-walk-player]")).not.toBeNull();
    expect(live()!.textContent).toContain(COPY.confidenceQuestion);
    expect(live()!.textContent).not.toContain("The old words.");
    expect([...live()!.querySelectorAll("[data-walk-answer]")].map((b) => b.textContent)).toEqual([
      "Yes", "In-between", "No", "Not sure", "Audio unclear",
    ]);
  });

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

  it("‹ reopens a judgement with the earlier answer pressed; a change carries the earlier answer", () => {
    draw();
    toIntro();
    promise();
    // ‹ is off on the first judgement.
    expect(live()!.querySelector<HTMLButtonElement>(`button[aria-label='${COPY.pagerBack}']`)!.disabled).toBe(true);
    click(answerButton("in_between"));
    hold();
    click(live()!.querySelector(`button[aria-label='${COPY.pagerBack}']`));
    expect(navMoment()).toContain(`${COPY.pagerMoment} 1 `);
    expect(pressed()).toBe("in_between");
    click(answerButton("no"));
    hold();
    expect(judged).toEqual([
      { item: "cv-1", answer: "in_between", earlier: null },
      { item: "cv-1", answer: "no", earlier: "in_between" },
    ]);
    expect(toast()).toBe("No ✓");
  });

  it("only the Confident Voice item is judged: a rewrite's answer stays final", () => {
    draw();
    toIntro();
    promise();
    for (const value of ["yes", "no", "not_sure"]) {
      click(answerButton(value));
      hold();
    }
    expect(judged.map((j) => j.item)).toEqual(["cv-1", "cv-2", "cv-3"]);
    expect(judged.map((j) => j.item)).not.toContain("rw-2");
    // The last answer leads past the judging: the end card (sharing is off in this walk).
    expect(ended).toBe(1);
    // No toast rides onto the end card: it would sit on "Record Take N".
    expect(toast()).toBeNull();
  });

  it("the last answer takes no toast to the end card, and the one before goes with its screen", () => {
    draw();
    toIntro();
    promise();
    click(answerButton("yes"));
    hold();
    click(answerButton("no"));
    hold();
    expect(toast()).toBe("No ✓");
    // Straight on, while "No ✓" is still showing: the last answer ends the walk.
    click(answerButton("in_between"));
    hold();
    expect(ended).toBe(1);
    expect(toast()).toBeNull();
    expect(host.querySelector("[data-walk-toast]")).toBeNull();
  });
});

describe("toastRides", () => {
  it("is true onto another overlay screen, false onto the end card or off the plan", () => {
    const judgeA: WalkStep = { key: "judge", moment: 0 };
    const judgeB: WalkStep = { key: "judge", moment: 1 };
    const share: WalkStep = { key: "community" };
    const end: WalkStep = { key: "end", overlay: false };
    expect(toastRides([judgeA, judgeB, end], judgeA)).toBe(true);
    expect(toastRides([judgeA, judgeB, end], judgeB)).toBe(false);
    expect(toastRides([judgeA, judgeB, share, end], judgeB)).toBe(true);
    expect(toastRides([judgeA, end], { key: "judge", moment: 0 })).toBe(false);
    expect(toastRides([judgeA], judgeA)).toBe(false);
  });
});

describe("Skip on \"Judgement time!\" (Q-B6 A)", () => {
  it("hands every unanswered judgement to the host to settle as skipped, then goes past the judging", () => {
    draw();
    toIntro();
    click(byTestId("walk-skip"));
    expect(skipped).toEqual([["cv-1", "cv-2", "cv-3"]]);
    expect(judged).toEqual([]);
    expect(ended).toBe(1);
  });
});

describe("a guest", () => {
  it("an answer opens sign-up and writes nothing; Skip writes nothing and moves on", () => {
    draw({ guest: true, at: "intro" });
    expect(screen()).toBe("walk-screen-intro");
    promise();
    click(answerButton("yes"));
    hold();
    expect(guests).toBe(1);
    expect(judged).toEqual([]);
    expect(screen()).toBe("walk-screen-judge");
    expect(pressed()).toBeNull();
    expect(toast()).toBeNull();
  });

  it("Skip as a guest settles nothing", () => {
    draw({ guest: true, at: "intro" });
    expect(screen()).toBe("walk-screen-intro");
    click(byTestId("walk-skip"));
    expect(skipped).toEqual([]);
    expect(ended).toBe(1);
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

describe("reduce motion", () => {
  const css = readFileSync("src/app/globals.css", "utf8");
  const reduce = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce) {\n  .walk-stage"));

  it("the intro, the post and the judgements sit in the stage the reduce-motion rule makes instant", () => {
    draw();
    toIntro();
    expect(live()!.closest(".walk-stage")).not.toBeNull();
    click(byTestId("walk-journal"));
    expect(live()!.closest(".walk-stage")).not.toBeNull();
    expect(reduce).toMatch(/\.walk-stage \*[\s\S]*animation-duration: 0\.01s !important/);
    expect(reduce).toMatch(/\.walk-ghost \{\s*display: none !important;/);
  });

  it("the toast still goes when it stands still (its timer, not its animation, ends it)", () => {
    draw();
    toIntro();
    promise();
    click(answerButton("yes"));
    hold();
    expect(toast()).toBe("Yes ✓");
    act(() => vi.advanceTimersByTime(2000));
    expect(toast()).toBeNull();
  });
});
