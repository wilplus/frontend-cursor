// @vitest-environment jsdom
/* The Feedback walk's primitives (founder lock 2026-10-06, "UI and UX,
   everywhere in the app"; build plan P1). */
import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHUNK_SHEET_COPY as COPY, WALK_COPY } from "../idealEditCopy";
import WalkMessage, { WalkNewWords } from "./WalkMessage";
import WalkJudgement from "./WalkJudgement";
import WalkFooter from "./WalkFooter";
import WalkOptions, { toggleWalkOption } from "./WalkOptions";
import WalkOverlay, { walkNavText } from "./WalkOverlay";
import WalkStage from "./WalkStage";
import WalkToast from "./WalkToast";
import WalkWordPicker from "./WalkWordPicker";
import RecordingStrip from "./RecordingStrip";
import WalkPlayer from "./WalkPlayer";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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
  vi.useRealTimers();
});
const draw = (el: ReactElement) => act(() => root.render(el));
const q = <T extends Element = HTMLElement>(sel: string) => host.querySelector<T>(sel);
const qa = <T extends Element = HTMLElement>(sel: string) => [...host.querySelectorAll<T>(sel)];

describe("WalkMessage", () => {
  it("is plain text with a grey picture and no sender label", () => {
    draw(<WalkMessage>Keep that pause.</WalkMessage>);
    const msg = q("[data-walk-message]")!;
    expect(msg.textContent).toBe("Keep that pause.");
    expect(msg.textContent).not.toMatch(/Your coach|What you said|WillpowerLab/);
    const avatar = q("[data-walk-avatar]")!;
    expect(avatar.getAttribute("aria-hidden")).toBe("true");
    expect(avatar.className).toMatch(/bg-foreground\/15/);
    expect(avatar.getAttribute("aria-label")).toBeNull();
  });

  it("every message has the same grey silhouette and never a photo", () => {
    draw(
      <>
        <WalkMessage>Hi</WalkMessage>
        <WalkMessage>Again</WalkMessage>
      </>,
    );
    const avatars = qa("[data-walk-avatar]");
    expect(avatars).toHaveLength(2);
    for (const avatar of avatars) {
      expect(avatar.getAttribute("aria-hidden")).toBe("true");
      expect(avatar.querySelector("svg")).not.toBeNull();
      expect(avatar.style.backgroundImage).toBe("");
      expect(avatar.getAttribute("style")).toBeNull();
    }
    expect(avatars[0].outerHTML).toBe(avatars[1].outerHTML);
  });

  it("only the new words are orange", () => {
    draw(
      <WalkMessage>
        <WalkNewWords>
          <em>The</em> window closes
        </WalkNewWords>
      </WalkMessage>,
    );
    expect(q("[data-walk-new-words]")!.className).toMatch(/\[&_em\]:text-primary/);
    expect(q("[data-walk-message]")!.className).not.toMatch(/text-primary/);
  });
});

describe("WalkJudgement", () => {
  it("asks the one question with Yes, In-between, No, then two smaller answers", () => {
    draw(createElement(WalkJudgement, { onAnswer: () => {} }));
    expect(host.textContent).toContain(COPY.confidenceQuestion);
    const main = qa("[data-size='main']").map((b) => b.textContent);
    const small = qa("[data-size='small']").map((b) => b.textContent);
    expect(main).toEqual(["Yes", "In-between", "No"]);
    expect(small).toEqual(["Not sure", "Audio unclear"]);
  });

  it("renders the two small answers smaller than the three main ones", () => {
    draw(createElement(WalkJudgement, { onAnswer: () => {} }));
    for (const b of qa("[data-size='main']")) {
      expect(b.className).toMatch(/text-\[16px\]/);
      expect(b.className).toMatch(/font-semibold/);
    }
    for (const b of qa("[data-size='small']")) {
      expect(b.className).toMatch(/text-\[14px\]/);
      expect(b.className).toMatch(/font-medium/);
      expect(b.className).toMatch(/text-muted-foreground/);
      expect(b.className).not.toMatch(/text-\[16px\]/);
    }
  });

  it("a chosen answer fills black, holds, then answers once", () => {
    vi.useFakeTimers();
    const onAnswer = vi.fn();
    draw(createElement(WalkJudgement, { onAnswer }));
    const yes = q<HTMLButtonElement>("[data-walk-answer='yes']")!;
    act(() => yes.click());
    expect(yes.className).toMatch(/bg-foreground/);
    expect(yes.getAttribute("aria-pressed")).toBe("true");
    act(() => q<HTMLButtonElement>("[data-walk-answer='no']")!.click());
    act(() => vi.advanceTimersByTime(279));
    expect(onAnswer).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith("yes");
  });

  it("an answer already given is drawn filled", () => {
    draw(createElement(WalkJudgement, { value: "audio_unclear", onAnswer: () => {} }));
    expect(q("[data-walk-answer='audio_unclear']")!.getAttribute("aria-pressed")).toBe("true");
  });
});

describe("WalkFooter", () => {
  it("one black pill, grey links under it", () => {
    const next = vi.fn();
    const skip = vi.fn();
    draw(createElement(WalkFooter, {
      pill: { label: COPY.pillAcceptPractise, onClick: next },
      links: [{ label: COPY.linkKeepMyWords, onClick: skip }],
    }));
    const buttons = qa<HTMLButtonElement>("[data-walk-footer] button");
    expect(buttons.map((b) => b.textContent)).toEqual([COPY.pillAcceptPractise, COPY.linkKeepMyWords]);
    expect(qa("[data-walk-pill]")).toHaveLength(1);
    expect(q("[data-walk-pill]")!.className).toMatch(/bg-foreground/);
    expect(q("[data-walk-pill]")!.className).toMatch(/rounded-full/);
    expect(q("[data-walk-link]")!.className).toMatch(/text-muted-foreground/);
    expect(q("[data-walk-link]")!.className).not.toMatch(/bg-foreground/);
    expect(q("[data-walk-footer]")!.className).toMatch(/flex-col/);
    act(() => buttons[0].click());
    act(() => buttons[1].click());
    expect(next).toHaveBeenCalledTimes(1);
    expect(skip).toHaveBeenCalledTimes(1);
  });

  it("a disabled pill does nothing", () => {
    const next = vi.fn();
    draw(createElement(WalkFooter, { pill: { label: COPY.pillEmphasise, onClick: next, disabled: true } }));
    act(() => q<HTMLButtonElement>("[data-walk-pill]")!.click());
    expect(next).not.toHaveBeenCalled();
  });
});

const OPTIONS = [
  { value: "general", label: WALK_COPY.shareGeneral },
  { value: "mine", label: WALK_COPY.shareMine },
  { value: "none", label: WALK_COPY.shareNone, exclusive: true },
];

describe("WalkOptions", () => {
  it("several may be ticked; None stands alone", () => {
    expect(toggleWalkOption([], "general", OPTIONS)).toEqual(["general"]);
    expect(toggleWalkOption(["general"], "mine", OPTIONS)).toEqual(["general", "mine"]);
    expect(toggleWalkOption(["general", "mine"], "none", OPTIONS)).toEqual(["none"]);
    expect(toggleWalkOption(["none"], "mine", OPTIONS)).toEqual(["mine"]);
    expect(toggleWalkOption(["mine"], "mine", OPTIONS)).toEqual([]);
  });

  it("taps tick and untick through onChange, as checkboxes", () => {
    let selected: string[] = ["general", "mine"];
    const render = () =>
      draw(createElement(WalkOptions, { options: OPTIONS, selected, onChange: (n: string[]) => { selected = n; } }));
    render();
    const boxes = qa<HTMLButtonElement>("[role='checkbox']");
    expect(boxes.map((b) => b.getAttribute("aria-checked"))).toEqual(["true", "true", "false"]);
    act(() => boxes[2].click());
    expect(selected).toEqual(["none"]);
    render();
    expect(qa("[role='checkbox']").map((b) => b.getAttribute("aria-checked"))).toEqual(["false", "false", "true"]);
  });

  it("a ticked option shows its fields", () => {
    const opts = [{ value: "mine", label: WALK_COPY.shareMine, fields: createElement("input", { "data-f": "1" }) }];
    draw(createElement(WalkOptions, { options: opts, selected: [], onChange: () => {} }));
    expect(q("[data-f]")).toBeNull();
    draw(createElement(WalkOptions, { options: opts, selected: ["mine"], onChange: () => {} }));
    expect(q("[data-f]")).not.toBeNull();
  });
});

describe("WalkWordPicker", () => {
  it("one tap adds one word next to the others, up to four (QA4 A, Q-B5 A)", () => {
    const seen: unknown[] = [];
    const words = ["Two", "hires", "by", "March", "keep", "that"];
    draw(createElement(WalkWordPicker, { words, selection: { from: 1, to: 4 }, onChange: (n: unknown) => seen.push(n) }));
    const buttons = qa("button");
    (buttons[5] as HTMLButtonElement).click();
    (buttons[0] as HTMLButtonElement).click();
    (buttons[2] as HTMLButtonElement).click();
    expect(seen).toEqual([]);
    expect(buttons[5].getAttribute("aria-disabled")).toBe("true");
    (buttons[4] as HTMLButtonElement).click();
    expect(seen).toEqual([{ from: 1, to: 3 }]);
  });

  it("says how many of the four with the signed words", () => {
    draw(createElement(WalkWordPicker, { words: ["Two", "hires"], selection: { from: 1, to: 1 }, onChange: () => {} }));
    expect(host.textContent).toContain(COPY.cardTapWords);
    expect(host.textContent).toContain(COPY.emphasisCount(1));
  });
});

describe("WalkOverlay", () => {
  it("is a full-screen dialog with the slide and moment bar and no backdrop", () => {
    const nav = { label: "Slide 2", index: 0, total: 4, onBack: () => {}, onNext: () => {}, backDisabled: true };
    draw(createElement(WalkOverlay, { nav, onClose: () => {}, title: COPY.titlePraise }, "body"));
    const ov = q(".walk-ov")!;
    expect(ov.getAttribute("role")).toBe("dialog");
    expect(ov.className).toMatch(/h-full w-full/);
    expect(ov.className).toMatch(/bg-background/);
    expect(q(".walk-ovtop")!.textContent).toContain("Slide 2 · moment 1 of 4");
    expect(walkNavText({ ...nav, position: "Take 2" })).toBe("Take 2");
    expect(q<HTMLButtonElement>(`[aria-label='${COPY.pagerBack}']`)!.disabled).toBe(true);
    // The top bar is the only child the motion leaves still.
    expect(ov.firstElementChild!.classList.contains("walk-ovtop")).toBe(true);
  });
});

describe("WalkStage", () => {
  type S = { key: string; moment?: number; overlay?: boolean };
  const render = (s: S) => createElement(WalkOverlay, { testId: `s-${s.key}-${s.moment ?? ""}` }, s.key);

  it("opens, moves next, keeps the leaving copy briefly, then closes", () => {
    vi.useFakeTimers();
    const stage = (screen: S, dir?: "back") => draw(createElement(WalkStage<S>, { screen, dir, render }));
    stage({ key: "page", overlay: false });
    expect(q("[data-walk-move]")).toBeNull();
    stage({ key: "praise", moment: 0 });
    expect(q("[data-walk-move]")!.getAttribute("data-walk-move")).toBe("open");
    expect(q(".walk-m-open")).not.toBeNull();
    stage({ key: "praise", moment: 2 });
    expect(q("[data-walk-move]")!.getAttribute("data-walk-move")).toBe("next");
    const ghost = q("[data-walk-ghost]")!;
    expect(ghost.className).toMatch(/walk-m-swap walk-m-next/);
    expect(ghost.getAttribute("aria-hidden")).toBe("true");
    expect(ghost.querySelector("[data-testid='s-praise-0']")).not.toBeNull();
    act(() => vi.advanceTimersByTime(360));
    expect(q("[data-walk-ghost]")).toBeNull();
    stage({ key: "praise", moment: 0 }, "back");
    expect(q("[data-walk-move]")!.getAttribute("data-walk-move")).toBe("back");
    stage({ key: "page", overlay: false });
    expect(q("[data-walk-move]")).toBeNull();
    expect(q("[data-walk-ghost]")!.className).toMatch(/walk-m-close/);
  });

  it("a redraw of the same screen does not move", () => {
    const stage = (screen: S) => draw(createElement(WalkStage<S>, { screen, render }));
    stage({ key: "page", overlay: false });
    stage({ key: "helpers", moment: 1 });
    const layer = q("[data-walk-move]");
    stage({ key: "helpers", moment: 1 });
    expect(q("[data-walk-move]")).toBe(layer);
    expect(q("[data-walk-ghost]")).toBeNull();
  });
});

describe("WalkToast", () => {
  it("is a status that goes after its time", () => {
    vi.useFakeTimers();
    const done = vi.fn();
    draw(createElement(WalkToast, { message: WALK_COPY.answerToast("Yes"), onDone: done }));
    expect(q("[role='status']")!.textContent).toBe("Yes ✓");
    act(() => vi.advanceTimersByTime(1600));
    expect(done).toHaveBeenCalledTimes(1);
  });
});

describe("RecordingStrip", () => {
  it("is the Take's own bar: dot, clock, numberless bar, stop", () => {
    const stop = vi.fn();
    draw(createElement(RecordingStrip, { elapsed: 5, stopLabel: COPY.pillStop, onStop: stop }));
    const strip = q("[data-walk-recording-strip]")!;
    expect(strip.className).toMatch(/flex items-center gap-3 rounded-2xl bg-muted/);
    expect(strip.textContent).toBe(`0:05${COPY.pillStop}`);
    act(() => q<HTMLButtonElement>("button")!.click());
    expect(stop).toHaveBeenCalledTimes(1);
  });
});

describe("WalkPlayer", () => {
  it("is a plain white box; the speaker's words only when given", () => {
    draw(createElement(WalkPlayer, { seed: "m", src: null, label: "moment" }));
    expect(q("[data-walk-player]")!.className).toMatch(/border-border bg-background/);
    expect(q("[data-walk-player]")!.textContent).not.toMatch(/[A-Za-z]{3}/);
    draw(createElement(WalkPlayer, { seed: "m", src: null, label: "moment", words: "Two hires" }));
    expect(q("[data-walk-player]")!.textContent).toContain("Two hires");
  });

  it("plays in ink, not orange (orange marks only new words)", () => {
    draw(createElement(WalkPlayer, { seed: "m", src: null, label: "moment" }));
    expect(host.innerHTML).not.toMatch(/bg-primary/);
  });
});
