// @vitest-environment jsdom
/* No pull-to-refresh while a Take lives only in the tab (founder
   2026-10-06: pulling down on the recording screen reloaded it). */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { holdNoPullToRefresh, useNoPullToRefresh } from "./useNoPullToRefresh";

let root: Root;
let host: HTMLDivElement;

const html = () => document.documentElement.style.overscrollBehavior;
const body = () => document.body.style.overscrollBehavior;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  document.documentElement.style.overscrollBehavior = "";
  document.body.style.overscrollBehavior = "";
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

function Probe({ active }: { active: boolean }) {
  useNoPullToRefresh(active);
  return null;
}

describe("useNoPullToRefresh", () => {
  it("switches the root's overscroll off while active and restores it after", () => {
    document.documentElement.style.overscrollBehavior = "auto";
    document.body.style.overscrollBehavior = "contain";
    act(() => root.render(createElement(Probe, { active: false })));
    expect(html()).toBe("auto");
    expect(body()).toBe("contain");

    act(() => root.render(createElement(Probe, { active: true })));
    expect(html()).toBe("none");
    expect(body()).toBe("none");

    // Leaving the recording state hands the page its own values back.
    act(() => root.render(createElement(Probe, { active: false })));
    expect(html()).toBe("auto");
    expect(body()).toBe("contain");
  });

  it("restores on unmount", () => {
    act(() => root.render(createElement(Probe, { active: true })));
    expect(html()).toBe("none");
    act(() => root.unmount());
    expect(html()).toBe("");
    expect(body()).toBe("");
    act(() => {
      root = createRoot(host);
    });
  });

  it("restores only when the last holder lets go", () => {
    const first = holdNoPullToRefresh();
    const second = holdNoPullToRefresh();
    first();
    first(); // a second release of the same hold is a no-op
    expect(html()).toBe("none");
    second();
    expect(html()).toBe("");
    expect(body()).toBe("");
  });
});
