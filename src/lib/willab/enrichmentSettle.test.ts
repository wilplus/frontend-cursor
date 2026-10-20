/*
STORY    As a speaker, I want a feedback placeholder to close when there is nothing to report, so that I don't wait forever on an empty slot.
OUTCOME
  O1  An empty feedback answer counts as "nothing more coming".
  O2  The page keeps asking for late marks until its ninety seconds are up,
      not for a handful of asks (founder 2026-10-20, WIL-76).
PROVES   O1 -> is false with nothing to report, so an honest empty lane closes
         O2 -> keeps asking to the ceiling, and stops there
*/
import { describe, expect, it } from "vitest";
import {
  SETTLE_CEILING_MS,
  feedbackStillComing,
  nextSettleDelayMs,
} from "./enrichmentSettle";

describe("feedbackStillComing — the question the reserved slot is asking", () => {

  it("is false with nothing to report, so an honest empty lane closes", () => {
    // 24c/24d: coverage is a target on selection, never a floor on output.
    // A Take with no marks must not hold a slot open forever.
    expect(feedbackStillComing({})).toBe(false);
  });

  it("keeps asking to the ceiling, and stops there", () => {
    // The ninth ask, half a minute in: the bake behind a busy worker has
    // not landed yet, and the page used to stop here.
    expect(nextSettleDelayMs(8, 32_000)).not.toBeNull();
    expect(nextSettleDelayMs(14, 80_000)).not.toBeNull();
    expect(nextSettleDelayMs(14, SETTLE_CEILING_MS)).toBeNull();
  });
});
