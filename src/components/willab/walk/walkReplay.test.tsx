// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  The finished walk, played again (founder 2026-10-08, Q-IT643b A; walk      */
/*  first, 2026-10-14): the same screens with the answers as given; a tap     */
/*  that would write moves on instead; an exercise already done plays its     */
/*  tries and records none.                                                   */
/* -------------------------------------------------------------------------- */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WALK_COPY } from "../idealEditCopy";
import FeedbackWalk from "./FeedbackWalk";
import type { WalkJudgementSave } from "./useWalkJudging";
import { buildFeedbackReplay, walkStart, walkStepAt, type FeedbackWalkItem } from "@/lib/willab/feedbackWalkModel";
import type { WalkPractiseIO } from "@/services/api/walkPractise";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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
    // The exercise was practised twice: "not yet", then praise.
    triesOf: (moment) =>
      moment.partId === "p3"
        ? { practiceId: null, outcomes: ["again", "praise"], audios: { 1: { url: "blob:try-1", durationMs: 4000 }, 2: { url: "blob:try-2", durationMs: 4200 } } }
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
    click(live()!.querySelectorAll("[data-walk-word-picker] button")[2]); // "our", next to the phrase
    expect(picked()).toEqual(["our", "growth", "doubled."]);
    click(byTestId("walk-forward"));
    expect(calls).toEqual(["helpers"]);
    // The clearer version answered: "✓ You kept your words" over Next, no
    // write and no recording.
    expect(screen()).toBe("walk-screen-clearer");
    expect(live()!.textContent).toContain(WALK_COPY.answeredKept);
    expect(byTestId("walk-keep")).toBeNull();
    click(byTestId("walk-forward"));
    expect(screen()).toBe("walk-screen-exVideo");
    // The exercise already done shows its whole thread at once (founder
    // 2026-10-16): each "Practise N" with its own voice and the answer it
    // got, the recorder passed over, nothing recorded and nothing asked.
    // Next alone under it: a walk played again never practises.
    const voices = () => [...live()!.querySelectorAll("[data-walk-player][data-walk-me] audio")].map((a) => a.getAttribute("src"));
    expect(voices()).toEqual([clip.src, "blob:try-1", "blob:try-2"]);
    expect(live()!.textContent).toContain(WALK_COPY.practiseN(1));
    expect(live()!.textContent).toContain(WALK_COPY.practiseN(2));
    expect(byTestId("walk-stop")).toBeNull();
    expect(byTestId("walk-practise")).toBeNull();
    click(byTestId("walk-forward"));
    expect(["walk-screen-practise", "walk-screen-encourage", "walk-screen-improved"]).not.toContain(screen());
    expect(calls).toEqual(["helpers"]);
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
