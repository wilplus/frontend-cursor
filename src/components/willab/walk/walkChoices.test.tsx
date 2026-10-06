// @vitest-environment jsdom
/* WalkChoices: one list of choices, shaded by position (founder lock
   2026-10-06, the coach panel redrawn: "One action per screen"). */
import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WalkChoices, { choiceClass, choiceShade, type WalkChoice } from "./WalkChoices";

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
});
const draw = (el: ReactElement) => act(() => root.render(el));
const qa = (sel: string) => [...host.querySelectorAll<HTMLElement>(sel)];

const FIVE: WalkChoice[] = ["a", "b", "c", "d", "e"].map((v) => ({ value: v, label: v.toUpperCase(), subtitle: `${v} sub` }));

describe("choiceShade / choiceClass", () => {
  it("white, then one step darker per card, the 4th and on the darkest", () => {
    expect([0, 1, 2, 3, 4, 9].map(choiceShade)).toEqual(["white", "g1", "g2", "g3", "g3", "g3"]);
    expect(choiceClass({}, 0)).toMatch(/bg-background/);
    expect(choiceClass({}, 1)).toMatch(/bg-\[#f7f7f8\]/);
    expect(choiceClass({}, 2)).toMatch(/bg-\[#efeff1\]/);
    expect(choiceClass({}, 3)).toMatch(/bg-\[#e4e4e7\]/);
  });

  it("else is light grey and noerr the darker grey, wherever they sit", () => {
    expect(choiceClass({ variant: "else" }, 0)).toMatch(/bg-muted/);
    expect(choiceClass({ variant: "noerr" }, 0)).toMatch(/bg-\[#e4e4e7\]/);
  });

  it("a selected card is white with a black edge", () => {
    expect(choiceClass({ selected: true }, 3)).toBe("bg-background border-foreground");
  });
});

describe("WalkChoices", () => {
  it("one button per card, shaded by position, in order", () => {
    draw(<WalkChoices choices={FIVE} />);
    const cards = qa("[data-walk-choice]");
    expect(cards.map((c) => c.tagName)).toEqual(["BUTTON", "BUTTON", "BUTTON", "BUTTON", "BUTTON"]);
    expect(cards[0].className).toMatch(/bg-background/);
    expect(cards[1].className).toMatch(/#f7f7f8/);
    expect(cards[2].className).toMatch(/#efeff1/);
    expect(cards[3].className).toMatch(/#e4e4e7/);
    expect(cards[4].className).toMatch(/#e4e4e7/);
  });

  it("black text: no grey inside a choice, the subtitle black too", () => {
    draw(<WalkChoices choices={FIVE} />);
    for (const card of qa("[data-walk-choice]")) {
      expect(card.innerHTML).not.toMatch(/text-muted-foreground/);
      expect(card.querySelector("small")!.className).toMatch(/text-foreground/);
      expect(card.querySelector("b")!.className).toMatch(/text-foreground/);
    }
  });

  it("tapping a card picks its value", () => {
    const onPick = vi.fn();
    draw(<WalkChoices choices={FIVE} onPick={onPick} />);
    act(() => qa("[data-walk-choice]")[2].click());
    expect(onPick).toHaveBeenCalledWith("c");
  });

  it("keyboard: every card is a native button, so Tab reaches it and Enter picks it", () => {
    const onPick = vi.fn();
    draw(<WalkChoices choices={FIVE} onPick={onPick} />);
    const card = qa("[data-walk-choice]")[1] as HTMLButtonElement;
    expect(card.type).toBe("button");
    expect(card.tabIndex).toBe(0);
    card.focus();
    expect(document.activeElement).toBe(card);
    // A native button turns Enter into a click.
    act(() => card.click());
    expect(onPick).toHaveBeenCalledWith("b");
  });

  it("the else card: light grey, its lead orange in regular weight", () => {
    draw(<WalkChoices choices={[
      { value: "x", label: "X" },
      { value: "else", label: "Name it", lead: "Lead", variant: "else" },
      { value: "noerr", label: "None", variant: "noerr" },
    ]} />);
    const [, other, none] = qa("[data-walk-choice]");
    expect(other.className).toMatch(/bg-muted/);
    const lead = other.querySelector("[data-walk-choice-lead]")!;
    expect(lead.textContent).toBe("Lead");
    expect(lead.className).toMatch(/text-primary/);
    expect(lead.className).toMatch(/font-normal/);
    expect(none.className).toMatch(/#e4e4e7/);
  });

  it("marks: a chevron by default, a check, a dot, nothing on a done card; selected is pressed", () => {
    draw(<WalkChoices choices={[
      { value: "a", label: "A", dot: true },
      { value: "b", label: "B", mark: "check" },
      { value: "c", label: "C", done: true, dim: true },
      { value: "d", label: "D", selected: true },
    ]} />);
    const [a, b, c, d] = qa("[data-walk-choice]");
    expect(a.querySelector("[data-walk-choice-dot]")).not.toBeNull();
    expect(a.querySelector("svg")).not.toBeNull();
    expect(b.querySelector("svg")!.getAttribute("class")).toMatch(/text-affirm/);
    expect(c.tagName).toBe("DIV");
    expect(c.className).toMatch(/opacity-60/);
    expect(c.querySelector("svg")).toBeNull();
    expect(d.getAttribute("aria-pressed")).toBe("true");
    expect(a.getAttribute("aria-pressed")).toBeNull();
  });

  it("says no word of its own", () => {
    draw(<WalkChoices choices={[{ value: "a", label: "A" }]} />);
    expect(host.textContent).toBe("A");
  });
});
