// @vitest-environment jsdom
/* The Feedback walk's production controller (build plan D-FW-14): the coach's
   note, the praise and the helper words, moving as the lock says, and a
   guest's pick asking to sign up. */
import { readFileSync } from "node:fs";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHUNK_SHEET_COPY as COPY } from "../idealEditCopy";
import { GuestGateContext } from "../GuestSignUpDialog";
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
  it("draws nothing until it is asked to open", () => {
    draw(null);
    expect(live()).toBeNull();
    expect(host.querySelector("[data-feedback-walk]")!.getAttribute("data-walk-step")).toBe("page");
  });

  it("opens on the coach's note, rising over the page, with a still top bar", () => {
    draw(null);
    draw({ seq: 1, at: 1 });
    expect(screen()).toBe("walk-screen-coachnote");
    expect(live()!.className).toContain("walk-m-open");
    expect(live()!.querySelector(".walk-ovtop")).not.toBeNull();
    expect(live()!.querySelector("[data-coach-video]")).not.toBeNull();
    expect(live()!.querySelector("[data-walk-message]")!.textContent).toBe(NOTE.text);
    expect(live()!.querySelector("[data-walk-nav]")!.getAttribute("aria-label")).toBe(`${COPY.historyTake} 2`);
  });

  it("walks coach's note → praise → helper words → the next praise → the end card", () => {
    const props = draw(null);
    draw({ seq: 1, at: 1 });
    forward();
    expect(screen()).toBe("walk-screen-praise");
    expect(live()!.className).toContain("walk-m-next");
    expect(live()!.querySelector("[data-walk-player]")).not.toBeNull();
    expect(live()!.querySelector("[data-walk-message]")!.textContent).toBe(ITEMS[0].praiseWords![0]);
    expect(live()!.querySelector("[data-walk-nav]")!.getAttribute("aria-label")).toBe(
      `Slide 2 · ${COPY.pagerMoment} 1 ${COPY.pagerOf} 2`,
    );
    forward();
    expect(screen()).toBe("walk-screen-helpers");
    expect(live()!.querySelector("h2")!.textContent).toBe(COPY.titleEmphasis);
    expect(words().map((w) => w.textContent)).toEqual(ITEMS[0].paragraphText.split(" "));
    click(live()!.querySelector("[data-testid='walk-skip']"));
    expect(screen()).toBe("walk-screen-praise");
    expect(live()!.querySelector("[data-walk-message]")!.textContent).toBe(COPY.praiseTentative);
    forward();
    forward(); // the helper words' pill is off until a word is picked
    expect(screen()).toBe("walk-screen-helpers");
    click(live()!.querySelector("[data-testid='walk-skip']"));
    expect(live()).toBeNull();
    expect(props.onEnd).toHaveBeenCalledTimes(1);
  });

  it("saves the picked helper words as one phrase, then moves on", () => {
    const props = draw(null);
    draw({ seq: 1, at: 3 });
    expect(screen()).toBe("walk-screen-helpers");
    click(words()[3]); // "growth"
    click(words()[4]); // "doubled,"
    expect(words()[3].getAttribute("aria-pressed")).toBe("true");
    forward();
    expect(props.onSaveHelperWords).toHaveBeenCalledWith({
      partId: "p1",
      span: { text: "growth doubled,", start: 17, end: 32 },
      paragraphText: ITEMS[0].paragraphText,
    });
    expect(screen()).toBe("walk-screen-praise");
  });

  it("a guest's pick opens sign-up and writes nothing (N32.5)", () => {
    const onGuest = vi.fn();
    const props = draw(null, { guest: true, onGuest });
    draw({ seq: 1, at: 3 }, { guest: true, onGuest });
    click(words()[0]);
    expect(onGuest).toHaveBeenCalledTimes(1);
    expect(words()[0].getAttribute("aria-pressed")).toBe("false");
    expect(props.onSaveHelperWords).not.toHaveBeenCalled();
  });

  it("asks the page's guest gate, as the Feedback sheet does, and writes nothing", () => {
    const block = vi.fn(() => true);
    const props = draw(null, { block });
    draw({ seq: 1, at: 3 }, { block });
    click(words()[0]);
    expect(block).toHaveBeenCalled();
    expect(words()[0].getAttribute("aria-pressed")).toBe("false");
    expect(props.onSaveHelperWords).not.toHaveBeenCalled();
  });

  it("✕ sinks the overlay back to the page", () => {
    const onClose = vi.fn();
    draw(null, { onClose });
    draw({ seq: 1, at: 2 }, { onClose });
    click(live()!.querySelector("button[aria-label='Close']"));
    expect(live()).toBeNull();
    expect(host.querySelector(".walk-ghost")!.className).toContain("walk-m-close");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows no read, family or score anywhere in the DOM (AC-9)", () => {
    draw(null);
    draw({ seq: 1, at: 2 });
    const html = host.innerHTML;
    expect(html).not.toMatch(/great_formulation|confident_voice|rewrite_clarity|openCard|tier|score|%/i);
  });
});

describe("reduce motion", () => {
  const css = readFileSync("src/app/globals.css", "utf8");
  const reduce = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce) {\n  .walk-stage"));

  it("every walk layer sits in the stage the reduce-motion rule makes instant", () => {
    draw(null);
    draw({ seq: 1, at: 1 });
    expect(live()!.closest(".walk-stage")).not.toBeNull();
    expect(reduce).toMatch(/\.walk-stage \*[\s\S]*animation-duration: 0\.01s !important/);
    expect(reduce).toMatch(/\.walk-ghost \{\s*display: none !important;/);
  });

  it("opens in 0.38 s and sinks in 0.28 s without it", () => {
    expect(css).toMatch(/\.walk-m-open > \.walk-ov \{\s*animation: walk-sheet-up 0\.38s/);
    expect(css).toMatch(/\.walk-ghost\.walk-m-close > \.walk-ov \{\s*animation: walk-sheet-down 0\.28s/);
  });
});
