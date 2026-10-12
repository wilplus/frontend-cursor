// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  THE BOTTOM OF THE TEXT PAGE (build plan D-IT-8; walk prototype .foot and   */
/*  text(); lock D8; N48.3 Q8; founder 2026-10-07, Q-B10 A).                   */
/*                                                                            */
/*  The pills are the walk's: 54px, 16px semibold; the Record pill carries   */
/*  the 10px red dot, not a mic; the link is 40px / 16px muted with no icon;  */
/*  there is no top border. While a moment waits: "Review feedback" is the   */
/*  pill and "Record Take N" the link (J1). After the walk: "● Record Take   */
/*  N" with a "Review feedback" link where the page has the data. The end    */
/*  card: the next Take only (J4). "See next steps" is gone (Q-B10 A).        */
/* -------------------------------------------------------------------------- */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import IdealTextActions from "./IdealTextActions";

let root: Root;
let host: HTMLDivElement;

const BASE = { onNewTake: () => undefined };

function render(props: Record<string, unknown>) {
  act(() => {
    root.render(createElement(IdealTextActions, { ...BASE, ...props } as never));
  });
}

const buttons = () => [...host.querySelectorAll("button")];
const labels = () => buttons().map((b) => b.textContent?.trim());
const pill = () => host.querySelector("[data-walk-pill]") as HTMLButtonElement | null;
const link = () => host.querySelector("[data-walk-link]") as HTMLButtonElement | null;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  act(() => {
    root = createRoot(host);
  });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("the next step (J1, J4, Q-B10 A)", () => {
  it("while a moment waits: Review feedback is the pill, Record Take N the link", () => {
    const onReview = vi.fn();
    render({ takeCount: 1, reviewWaiting: true, onReview });
    expect(labels()).toEqual(["Review feedback", "Record Take 2"]);
    expect(pill()!.textContent).toBe("Review feedback");
    expect(link()!.textContent).toBe("Record Take 2");
    act(() => pill()!.click());
    expect(onReview).toHaveBeenCalledTimes(1);
  });

  it("once nothing waits: ● Record Take N alone", () => {
    render({ takeCount: 1, reviewWaiting: false, onReview: vi.fn() });
    expect(labels()).toEqual(["Record Take 2"]);
    expect(link()).toBeNull();
  });
});
