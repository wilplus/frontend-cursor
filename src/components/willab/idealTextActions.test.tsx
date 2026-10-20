// @vitest-environment jsdom
/*
STORY    As a speaker, I want the bottom of my Ideal Text page to offer
         "Record Take N+1" and a grey Close, so that the next Take is always
         one tap away.
OUTCOME
  O1  The only buttons are "Record Take 2" and "Close", even when a review
      is waiting; Close closes the page.
PROVES   O1 -> "is ● Record Take N and a grey Close, the one way out"
WHY      Founder lock 2026-10-12, sections 4 and 9; locked Ideal Text screen.
*/
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
