// @vitest-environment jsdom
/* The Feedback walk's primitives (founder lock 2026-10-06, "UI and UX,
   everywhere in the app"; build plan P1). */
import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WalkWordPicker from "./WalkWordPicker";

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
const qa = <T extends Element = HTMLElement>(sel: string) => [...host.querySelectorAll<T>(sel)];

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
});
