// @vitest-environment jsdom
/*
STORY    As a speaker, I want to be able to skip "How do you feel?", so that
         nobody is made to tell the app how they feel before they record.
OUTCOME
  O1  The check offers a Skip every time it shows, whether or not I have a
      plan.
  O2  Skipping goes on to the recording set-up and keeps no feeling.
  O3  Naming a feeling still keeps it and goes on.
PROVES   O1 -> "offers a Skip with no plan"
         O2 -> "Skip goes on and keeps no feeling"
         O3 -> "naming a feeling keeps it and goes on"
WHY      Founder 2026-10-27, backend N211 (the plan's consent, question 3 A):
         a feeling is the speaker's own, and a check with no way past it is
         not asked freely.
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import FeelingsCheckIn from "./FeelingsCheckIn";
import { getLastFeeling } from "./willabFeelings";

describe("How do you feel?", () => {
  let host: HTMLDivElement;
  let root: Root;
  const onReady = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    onReady.mockReset();
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root.render(createElement(FeelingsCheckIn, { onReady })));
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.useRealTimers();
  });

  const button = (label: string) =>
    [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === label);

  it("offers a Skip with no plan", () => {
    expect(button("Skip")).toBeDefined();
  });

  it("Skip goes on and keeps no feeling", () => {
    act(() => button("Skip")?.click());
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(getLastFeeling()).toBeNull();
  });

  it("naming a feeling keeps it and goes on", () => {
    act(() => button("Calm")?.click());
    expect(getLastFeeling()).toBe("calm");
    expect(button("Skip")).toBeUndefined();
    act(() => vi.advanceTimersByTime(1000));
    expect(onReady).toHaveBeenCalledTimes(1);
  });
});
