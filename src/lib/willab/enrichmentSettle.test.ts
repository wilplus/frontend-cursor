/*
STORY    As a speaker, I want a feedback placeholder to close when there is nothing to report, so that I don't wait forever on an empty slot.
OUTCOME
  O1  An empty feedback answer counts as "nothing more coming".
PROVES   O1 -> is false with nothing to report, so an honest empty lane closes
*/
import { describe, expect, it } from "vitest";
import {
  feedbackStillComing,
} from "./enrichmentSettle";

describe("feedbackStillComing — the question the reserved slot is asking", () => {

  it("is false with nothing to report, so an honest empty lane closes", () => {
    // 24c/24d: coverage is a target on selection, never a floor on output.
    // A Take with no marks must not hold a slot open forever.
    expect(feedbackStillComing({})).toBe(false);
  });
});
