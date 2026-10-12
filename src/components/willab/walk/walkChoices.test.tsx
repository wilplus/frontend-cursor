// @vitest-environment jsdom
/* WalkChoices: one list of choices, shaded by position (founder lock
   2026-10-06, the coach panel redrawn: "One action per screen"). */
import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WalkChoices, { type WalkChoice } from "./WalkChoices";

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

describe("WalkChoices", () => {

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
