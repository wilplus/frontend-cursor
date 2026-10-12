import { describe, expect, it } from "vitest";

import {
  PRAISE_CUE_COPY,
} from "./trackedChangeWhy";

describe("nothing here surfaces a number (AC-9)", () => {

  it("compares them to THEMSELVES, never to other speakers", () => {
    // Every cue is z-scored against the speaker's own baseline upstream, so
    // "more than you usually do" is the literal measurement and "more than
    // other people" would be a claim we never made.
    const all = Object.values(PRAISE_CUE_COPY).join(" ");
    expect(all).not.toMatch(/than (most|other|average)/i);
    expect(all).toMatch(/you usually|usually take|it usually/i);
  });
});
