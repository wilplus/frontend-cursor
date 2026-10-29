// @vitest-environment jsdom
/*
STORY    As a speaker, I want to name how I feel before I record, or skip it,
         and as a guest not to be asked at all.
OUTCOME
  O1  Signed in, the check offers a Skip every time it shows.
  O2  Skipping goes on to the recording set-up and keeps no feeling.
  O3  Naming a feeling keeps it and goes on, with nothing said back.
  O4  A guest is never asked: the check is passed by at once and keeps
      nothing.
  O5  On a plan without its own yes, the check is passed by at once and
      keeps nothing; with the yes, it is asked.
PROVES   O1 -> "offers a Skip when signed in"
         O2 -> "Skip goes on and keeps no feeling"
         O3 -> "naming a feeling keeps it and goes on"
         O4 -> "a guest is never asked"
         O5 -> "on a plan, only after its own yes"
WHY      Founder 2026-10-27, backend N211: a feeling is the speaker's own, and
         a check with no way past it is not asked freely. Founder 2026-10-29,
         backend N271: the set-up's look, no reply, no coach line, and no
         check for a guest; on a plan, the plan's own yes comes first (N217).
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { rememberPlan, type Plan } from "@/services/api/plan";
import FeelingsCheckIn from "./FeelingsCheckIn";
import { getLastFeeling, recordFeeling } from "./willabFeelings";

describe("How do you feel?", () => {
  let host: HTMLDivElement;
  let root: Root;
  const onReady = vi.fn();

  beforeEach(() => {
    rememberPlan(null);
    vi.useFakeTimers();
    window.localStorage.clear();
    onReady.mockReset();
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root.render(createElement(FeelingsCheckIn, { ask: true, setupSteps: 3, onReady, onCancel: vi.fn() })));
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.useRealTimers();
  });

  const button = (label: string) =>
    [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === label);

  it("offers a Skip when signed in", () => {
    expect(button("Skip")).toBeDefined();
  });

  it("Skip goes on and keeps no feeling", () => {
    act(() => button("Skip")?.click());
    expect(onReady).toHaveBeenCalledWith(true);
    expect(getLastFeeling()).toBeNull();
  });

  it("naming a feeling keeps it and goes on", () => {
    act(() => button("Calm")?.click());
    expect(getLastFeeling()).toBe("calm");
    expect(button("Skip")?.disabled).toBe(true);
    act(() => vi.advanceTimersByTime(1000));
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(host.textContent).not.toContain("Nerves mean it matters");
  });

  it("a guest is never asked", () => {
    act(() => root.unmount());
    onReady.mockReset();
    recordFeeling("calm"); // a stale one from an earlier Take
    root = createRoot(host);
    act(() => root.render(createElement(FeelingsCheckIn, { ask: false, setupSteps: 3, onReady, onCancel: vi.fn() })));
    expect(button("Skip")).toBeUndefined();
    expect(onReady).toHaveBeenCalledWith(false);
    expect(getLastFeeling()).toBeNull();
  });

  it("on a plan, only after its own yes", () => {
    const plan = { id: "p", status: "active", step: "done", first_take_done: true } as Plan;
    for (const [consent, asked] of [["unanswered", false], ["declined", false], ["granted", true]] as const) {
      act(() => root.unmount());
      onReady.mockReset();
      recordFeeling("calm"); // a stale one from an earlier Take
      rememberPlan({ ...plan, consent });
      root = createRoot(host);
      act(() => root.render(createElement(FeelingsCheckIn, { ask: true, setupSteps: 0, onReady, onCancel: vi.fn() })));
      expect(button("Skip") !== undefined).toBe(asked);
      expect(onReady).toHaveBeenCalledTimes(asked ? 0 : 1);
      if (!asked) expect(getLastFeeling()).toBeNull();
    }
    rememberPlan(null);
  });
});
