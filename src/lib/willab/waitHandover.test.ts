/*
STORY    As a speaker, I want the wait after my Take to stay on screen until the walk is there, so that "done" never opens onto more loading.
OUTCOME
  O1  The wait stays over the lens's loading frame and lifts the moment a step of the walk is on screen.
  O2  With nothing to walk, the wait lifts when the lens gives way to the text; it never hides a screen that is not the lens.
PROVES   O1 -> stays over the loading lens and lifts onto the walk
         O2 -> lifts when the lens goes, when no lens comes, and at the cap
WHY      Founder 2026-10-21: "when it says it's done it opens the walk automatically but then it still loads the walk - so it is not done!"
*/
import { describe, expect, it } from "vitest";
import { LENS_APPEAR_MS, WAIT_COVER_CAP_MS, waitLifts } from "./waitHandover";

describe("the wait lifts onto the walk, not before it", () => {
  const at = (over: Partial<Parameters<typeof waitLifts>[0]>) =>
    waitLifts({ stepOnScreen: false, lensSeen: true, lensOn: true, elapsedMs: 1_000, ...over });

  it("stays over the loading lens and lifts onto the walk", () => {
    expect(at({})).toBe(false);
    expect(at({ elapsedMs: 60_000 })).toBe(false);
    expect(at({ stepOnScreen: true })).toBe(true);
  });

  it("lifts when the lens goes, when no lens comes, and at the cap", () => {
    expect(at({ lensOn: false })).toBe(true);
    expect(at({ lensSeen: false, lensOn: false })).toBe(false);
    expect(at({ lensSeen: false, lensOn: false, elapsedMs: LENS_APPEAR_MS + 1 })).toBe(true);
    expect(at({ elapsedMs: WAIT_COVER_CAP_MS + 1 })).toBe(true);
  });
});
