// @vitest-environment jsdom
/* The Feedback walk's production controller (build plan D-FW-14): the coach's
   note, the praise and the helper words, moving as the lock says, and a
   guest's pick asking to sign up. */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHUNK_SHEET_COPY as COPY, WALK_COPY, WALK_LINE_BANK } from "../idealEditCopy";
import { GuestGateContext } from "../GuestSignUpDialog";
vi.mock("@/services/api/otherSpeakers", () => ({ fetchOtherClips: vi.fn(async () => []), answerOtherClip: vi.fn() }));
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

  it("walks coach's note → praise → helper words → the next praise → the end card", async () => {
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
    expect(screen()).toBe("walk-screen-others"); // nobody to judge: it moves on
    await act(async () => {});
    expect(live()).toBeNull();
    expect(props.onEnd).toHaveBeenCalledTimes(1);
  });

  it("shows no read, family or score anywhere in the DOM (AC-9)", () => {
    draw(null);
    draw({ seq: 1, at: 2 });
    const html = host.innerHTML;
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
  // page, praise, helpers, praise, helpers, clearer (5), clearer (6), end
  const FIRST = 5;
  const msg = () => live()!.querySelector("[data-walk-message]")!;

  it("draws the served words: what goes crossed out, what arrives in orange, around the signed lines", () => {
    drawClearer(true, FIRST);
    expect(screen()).toBe("walk-screen-clearer");
    expect(live()!.querySelector("h2")!.textContent).toBe(COPY.cardClearerVersion);
    const player = live()!.querySelector("[data-walk-player]")!;
    expect([...player.querySelectorAll("s")].map((n) => n.textContent)).toEqual([
      "We think the timing matters, because the",
      "catch up with pricing",
    ]);
    const fresh = msg().querySelector("[data-walk-new-words]")!;
    expect(fresh.textContent).toBe(OFFERED);
    expect([...fresh.querySelectorAll("em")].map((n) => n.textContent)).toEqual(["The", "match our price"]);
    const lines = [...msg().querySelectorAll(":scope > div > span:not([data-walk-new-words])")].map((n) => n.textContent);
    expect(lines).toEqual([WALK_LINE_BANK.B13.lines[0], WALK_LINE_BANK.B14.lines[0]]);
    expect(lines).toEqual([WALK_COPY.clearerOffer, WALK_COPY.clearerAsk]);
    const buttons = [...live()!.querySelectorAll("footer button, [data-walk-footer] button")].map((b) => b.textContent);
    expect(buttons).toContain(COPY.pillAcceptPractise);
    expect(buttons).toContain(COPY.linkKeepMyWords);
  });

  const said = () => [...msg().querySelectorAll(":scope > div > span:not([data-walk-new-words])")].map((n) => n.textContent);
});
