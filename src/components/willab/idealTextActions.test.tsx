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

describe("the look (walk prototype .foot)", () => {
  it("the pill is 54px, 16px semibold, full width, with the 10px red dot and no mic", () => {
    render({ takeCount: 1 });
    const cls = pill()!.className.split(" ");
    for (const c of ["h-[54px]", "text-[16px]", "font-semibold", "w-full", "rounded-full", "bg-foreground"]) {
      expect(cls).toContain(c);
    }
    const dot = pill()!.querySelector("span[aria-hidden]") as HTMLElement;
    expect(dot.className.split(" ")).toEqual(expect.arrayContaining(["h-2.5", "w-2.5", "rounded-full", "bg-record"]));
    expect(host.querySelector("svg")).toBeNull();
    expect(pill()!.textContent).toBe("Record Take 2");
  });

  it("the link is 40px, 16px muted, with no icon; the foot has no top border", () => {
    render({ takeCount: 1, reviewWaiting: true, onReview: vi.fn() });
    const cls = link()!.className.split(" ");
    for (const c of ["h-10", "text-[16px]", "text-muted-foreground", "w-full"]) expect(cls).toContain(c);
    expect(link()!.querySelector("svg")).toBeNull();
    const foot = host.querySelector("[data-ideal-text-actions]") as HTMLElement;
    expect(foot.className.split(" ")).toEqual(["flex", "flex-col", "gap-1"]);
    expect(foot.className).not.toMatch(/border/);
  });
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

  it("after the walk, where the page has the data: the Review feedback link under the pill", () => {
    const onReviewAgain = vi.fn();
    render({ takeCount: 2, onReviewAgain });
    expect(labels()).toEqual(["Record Take 3", "Review feedback"]);
    act(() => link()!.click());
    expect(onReviewAgain).toHaveBeenCalledTimes(1);
  });

  it("J4: the end card offers the next Take only", () => {
    render({ takeCount: 1, reviewWaiting: true, onReview: vi.fn(), onReviewAgain: vi.fn(), endCard: true });
    expect(labels()).toEqual(["Record Take 2"]);
  });

  it("names the next Take from Take 3 on, never \"Record again\" (N48.3 Q8 A)", () => {
    render({ takeCount: 3 });
    expect(labels()).toEqual(["Record Take 4"]);
    expect(host.textContent).not.toContain("Record again");
  });

  it("the record entry is disabled, never removed, when the BE closes its gate", () => {
    render({ takeCount: 1, canRecordTake: false });
    expect(pill()!.disabled).toBe(true);
    expect(host.textContent).toContain("Recording another take is not available right now.");
  });

  it("never offers See next steps, on any Take (Q-B10 A)", () => {
    for (const takeCount of [1, 2, 3, 4]) {
      render({ takeCount, reviewWaiting: false });
      expect(host.textContent).not.toContain("See next steps");
      expect(host.textContent).not.toContain("Save the ideal text");
    }
  });

  it("the next Take runs the record flow", () => {
    const onNewTake = vi.fn();
    render({ takeCount: 1, onNewTake });
    act(() => pill()!.click());
    expect(onNewTake).toHaveBeenCalledTimes(1);
  });
});
