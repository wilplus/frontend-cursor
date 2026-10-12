// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  THE BOTTOM OF THE TEXT PAGE (build plan D-IT-8; walk prototype .foot and   */
/*  text(); lock D8; N48.3 Q8; founder 2026-10-07, Q-B10 A).                   */
/*                                                                            */
/*  The pills are the walk's: 54px, 16px semibold; the Record pill carries   */
/*  the 10px red dot, not a mic; the link is 40px / 16px muted with no icon;  */
/*  there is no top border. "● Record Take N" and the grey "Close" (lock      */
/*  2026-10-12, sections 4 and 9). The end card: the next Take only (J4).    */
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

describe("the next step (founder lock 2026-10-12, sections 4 and 9)", () => {
  it("is ● Record Take N and a grey Close, the one way out", () => {
    const onClose = vi.fn();
    render({ takeCount: 1, reviewWaiting: true, onReview: vi.fn(), onClose });
    expect(labels()).toEqual(["Record Take 2", "Close"]);
    expect(pill()!.textContent).toContain("Record Take 2");
    act(() => link()!.click());
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
