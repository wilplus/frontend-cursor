// @vitest-environment jsdom
/*
STORY    As a speaker, I want an absent closing summary to disappear cleanly,
         so that the Feedback Walk does not suggest that anything is loading.
OUTCOME  O1 A summary with no fetch source renders no idle typing loader and
         advances the walk.
PROVES   O1 -> "omits the loader when the summary step has no fetch source"
WHY      Founder-approved Feedback Walk loading correction, 2026-11-17.
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WalkSummary from "./WalkSummary";

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("Walk summary loading", () => {
  it("omits the loader when the summary step has no fetch source", async () => {
    const onNext = vi.fn();
    await act(async () => {
      root.render(createElement(WalkSummary, {
        takeIndex: 2,
        fetchText: null,
        onBack: vi.fn(),
        backDisabled: false,
        onNext,
        onClose: vi.fn(),
      }));
    });

    expect(host.querySelector("[data-walk-loading]")).toBeNull();
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
