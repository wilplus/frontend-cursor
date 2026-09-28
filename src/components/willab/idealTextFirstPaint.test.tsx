// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  The Ideal Text opens with its words and its button together (founder      */
/*  2026-09-28, "A"; the locked design's J1). Pinned here:                    */
/*    1. the fast lane's "next steps seen" answer is applied the moment it    */
/*       lands, and only for the current read;                                */
/*    2. on Takes 1–3 the first paint waits for that answer, at most          */
/*       FIRST_PAINT_HOLD_MS, and never goes back to loading afterwards;      */
/*    3. outside Takes 1–3 nothing waits.                                     */
/* -------------------------------------------------------------------------- */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const merge = vi.fn();
vi.mock("@/services/api/idealText", () => ({
  mergeIdealTextEnrichment: (...args: unknown[]) => merge(...args),
}));

import {
  FIRST_PAINT_HOLD_MS,
  applyEarlyJourney,
  buttonUndecided,
  useFirstPaintHold,
} from "./idealTextFirstPaint";

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  merge.mockReset();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe("the fast lane's answer, applied at once", () => {
  type Sd = { journeyNextStepsSeen: boolean | null; title: string };
  const run = (prompt: unknown, current: boolean, merged: boolean | null) => {
    merge.mockReturnValue({ journeyNextStepsSeen: merged });
    let sd: Sd | null = { journeyNextStepsSeen: null, title: "t" };
    applyEarlyJourney<Sd>(prompt as never, {} as never, (update) => { sd = update(sd); }, () => current);
    return sd;
  };

  it("sets only the next-steps answer", () => {
    expect(run({ kind: "ready" }, true, false)).toEqual({ journeyNextStepsSeen: false, title: "t" });
  });
  it("ignores a read that is no longer current", () => {
    expect(run({ kind: "ready" }, false, false)?.journeyNextStepsSeen).toBeNull();
  });
  it("ignores a lane that didn't answer, or answered without it", () => {
    expect(run({ kind: "stale" }, true, false)?.journeyNextStepsSeen).toBeNull();
    expect(run({ kind: "ready" }, true, null)?.journeyNextStepsSeen).toBeNull();
  });
});

describe("the first paint", () => {
  let shown: string[];
  function Probe(p: { status: string; takeCount: number | null; seen: boolean | null }) {
    shown.push(useFirstPaintHold(p.status, p.takeCount, p.seen));
    return null;
  }
  const render = (status: string, takeCount: number | null, seen: boolean | null) =>
    act(() => root.render(createElement(Probe, { status, takeCount, seen })));
  beforeEach(() => { shown = []; });

  it("waits on Takes 1–3 until the answer arrives, then shows words and button together", () => {
    render("ready", 1, null);
    expect(shown.at(-1)).toBe("loading");
    render("ready", 1, false);
    expect(shown.at(-1)).toBe("ready");
  });

  it("stops waiting after the bounded hold", async () => {
    vi.useFakeTimers();
    render("ready", 2, null);
    expect(shown.at(-1)).toBe("loading");
    await act(async () => { vi.advanceTimersByTime(FIRST_PAINT_HOLD_MS); });
    expect(shown.at(-1)).toBe("ready");
  });

  it("never goes back to loading once shown", () => {
    render("ready", 1, true);
    render("ready", 1, null);
    expect(shown.at(-1)).toBe("ready");
  });

  it("doesn't wait outside Takes 1–3", () => {
    render("ready", 5, null);
    expect(shown.at(-1)).toBe("ready");
    expect(buttonUndecided(null, null)).toBe(false);
  });

  it("passes every other status through", () => {
    render("error", 1, null);
    expect(shown.at(-1)).toBe("error");
  });
});
