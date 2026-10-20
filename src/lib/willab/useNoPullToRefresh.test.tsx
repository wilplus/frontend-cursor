// @vitest-environment jsdom
/*
STORY    As a speaker recording on a phone, I want pulling down not to reload the page while my Take exists only in the tab, so that I never lose a recording.
OUTCOME
  O1  Pull-to-refresh is off while recording, and the page's own settings come back after.
PROVES   O1 -> switches the root's overscroll off while active and restores it after
WHY      Founder 2026-10-06: pulling down on the recording screen reloaded it.
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useNoPullToRefresh } from "./useNoPullToRefresh";

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
});
