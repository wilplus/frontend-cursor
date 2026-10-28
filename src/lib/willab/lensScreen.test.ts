/*
STORY    As a speaker, I want my text to appear as soon as there is nothing to walk through, and not while a walk might still open, so that I'm neither stuck nor interrupted.
OUTCOME
  O1  When feedback has settled (or the page failed) with nothing to walk, the text shows.
  O2  While feedback, a coach review, a walk or helper words may still open, the waiting screen stays.
  O3  A step I tapped in the chat opens only once the Take's moments are in and the page knows what waits, never the text in its place (founder 2026-10-21).
PROVES   O1 -> comes down when the feedback settles with nothing to walk
         O2 -> stays while the marks may still land or a walk is opening
         O3 -> a step asked for waits for the moments, then goes through the door
*/
import { describe, expect, it } from "vitest";

import { lensIdle, lensStillLoading, walkDoorReady } from "./lensScreen";

/* The lens screen (founder 2026-10-14): the text appears as soon as the page
 * knows there is nothing to walk, and never while a walk may still open. */

const ready = {
  status: "ready",
  feedbackPending: false,
  reviewWaiting: false,
  walkRequested: false,
  opensItself: false,
};

describe("the lens screen", () => {
  it("comes down when the feedback settles with nothing to walk", () => {
    expect(lensIdle(ready)).toBe(true);
    // A page that could not load has no walk to wait for either.
    expect(lensIdle({ ...ready, status: "error" })).toBe(true);
  });

  it("stays while the marks may still land or a walk is opening", () => {
    expect(lensIdle({ ...ready, status: "loading" })).toBe(false);
    expect(lensIdle({ ...ready, feedbackPending: true })).toBe(false);
    expect(lensIdle({ ...ready, reviewWaiting: true })).toBe(false);
    expect(lensIdle({ ...ready, walkRequested: true })).toBe(false);
    expect(lensIdle({ ...ready, opensItself: true })).toBe(false);
    // The deck not up yet: the page cannot say, so the text waits (founder
    // 2026-10-20: never the text before the walk after a Take).
    expect(lensIdle({ ...ready, reviewWaiting: null })).toBe(false);
  });

  it("the watchdog waits while the page loads, its marks may land or its deck is not up", () => {
    expect(lensStillLoading(ready)).toBe(false);
    expect(lensStillLoading({ ...ready, status: "loading" })).toBe(true);
    expect(lensStillLoading({ ...ready, feedbackPending: true })).toBe(true);
    expect(lensStillLoading({ ...ready, reviewWaiting: null })).toBe(true);
  });

  it("a step asked for waits for the moments, then goes through the door", () => {
    // The prompt lane lands before the marks: the deck may already say
    // nothing waits, but the moments the step belongs to are not in yet.
    expect(walkDoorReady({ feedbackPending: true, reviewWaiting: false })).toBe(false);
    expect(walkDoorReady({ feedbackPending: false, reviewWaiting: null })).toBe(false);
    expect(walkDoorReady({ feedbackPending: false, reviewWaiting: false })).toBe(true);
    expect(walkDoorReady({ feedbackPending: false, reviewWaiting: true })).toBe(true);
  });
});
