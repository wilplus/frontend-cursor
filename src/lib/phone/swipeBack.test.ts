/*
STORY    As a speaker in the iPhone app, I want the edge swipe to close the
         screen on top, and never to slide away a Take I am recording or a
         walk step (backend N681 item 2).
OUTCOME
  O1  The swipe goes back only with a closing screen on top and no Take at
      risk; a Take at risk, or a screen that steps on Back, turns it off.
  O2  The app is told only when that changes.
PROVES   O1, O2 -> "turns the swipe on and off with the screen on top and the Take"
*/
import { describe, expect, it, vi } from "vitest";

const plugin = vi.hoisted(() => ({ setSwipeBack: vi.fn(async () => undefined) }));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => true, isPluginAvailable: () => true },
  registerPlugin: () => plugin,
}));

import { noteSwipeBack, swipeBackAllowed } from "./swipeBack";

describe("the iPhone's edge swipe back", () => {
  it("turns the swipe on and off with the screen on top and the Take", () => {
    expect(swipeBackAllowed({ topClosesOnBack: true, takeAtRisk: false })).toBe(true);
    expect(swipeBackAllowed({ topClosesOnBack: true, takeAtRisk: true })).toBe(false);
    expect(swipeBackAllowed({ topClosesOnBack: false, takeAtRisk: false })).toBe(false);

    noteSwipeBack({ topClosesOnBack: true });
    noteSwipeBack({ topClosesOnBack: true }); // unchanged: not sent again
    noteSwipeBack({ takeAtRisk: true });
    noteSwipeBack({ takeAtRisk: false });
    expect(plugin.setSwipeBack.mock.calls).toEqual([
      [{ enabled: true }],
      [{ enabled: false }],
      [{ enabled: true }],
    ]);
  });
});
