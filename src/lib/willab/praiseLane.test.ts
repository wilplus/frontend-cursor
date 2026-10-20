/*
STORY    As a speaker, I want praise to compare me only to myself and never show
         a number, so that feedback is personal and in words.
OUTCOME
  O1  No praise line compares me to others ("than most/others/average"); the
      lines that compare say "you usually".
  O2  No praise line carries a digit. Never-1: feedback is in words.
PROVES   O1 -> "compares them to THEMSELVES, never to other speakers"
         O2 -> "carries no number, only words"
*/
import { describe, expect, it } from "vitest";

import {
  PRAISE_CUE_COPY,
  praiseLines,
} from "./trackedChangeWhy";

const all = Object.values(PRAISE_CUE_COPY).join(" ");

describe("praise is personal and in words", () => {

  it("compares them to THEMSELVES, never to other speakers", () => {
    // Every cue is z-scored against the speaker's own baseline upstream, so
    // "more than you usually do" is the literal measurement and "more than
    // other people" would be a claim we never made.
    expect(all).not.toMatch(/than (most|other|average)/i);
    expect(all).toMatch(/you usually|usually take|it usually/i);
  });

  it("carries no number, only words", () => {
    // What a speaker actually receives: the lines for every cue we have.
    const lines = praiseLines(Object.keys(PRAISE_CUE_COPY));
    expect(lines.length).toBe(Object.keys(PRAISE_CUE_COPY).length);
    for (const line of lines) {
      expect(line.trim().length).toBeGreaterThan(0);
      expect(line).not.toMatch(/\d/);
    }
  });
});
