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
});
