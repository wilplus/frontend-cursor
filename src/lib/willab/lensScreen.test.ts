/*
STORY    As a speaker, I want my text to appear as soon as there is nothing to walk through, and not while a walk might still open, so that I'm neither stuck nor interrupted.
OUTCOME
  O1  When feedback has settled (or the page failed) with nothing to walk, the text shows.
  O2  While feedback, a coach review, a walk or helper words may still open, the waiting screen stays.
PROVES   O1 -> comes down when the feedback settles with nothing to walk
         O2 -> stays while the marks may still land or a walk is opening
*/
import { describe, expect, it } from "vitest";

import { lensIdle } from "./lensScreen";

/* The lens screen (founder 2026-10-14): the text appears as soon as the page
 * knows there is nothing to walk, and never while a walk may still open. */

const ready = {
  status: "ready",
  feedbackPending: false,
  reviewWaiting: false,
  walkRequested: false,
  opensHelpers: false,
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
    expect(lensIdle({ ...ready, opensHelpers: true })).toBe(false);
  });
});
