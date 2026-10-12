import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
  CONFIDENT_VOICE_WHY,
  PRAISE_CUE_COPY,
  praiseLines,
} from "./trackedChangeWhy";

/* -------------------------------------------------------------------------- */
/*  THE PRAISE LANE (founder 2026-08-15)                                       */
/*                                                                            */
/*  "if the delivery was impeccable, just give them the feedback in the praise */
/*  lane and in the justification of the positive feedback give them the       */
/*  playback of that phrase emphasising that it was said really well and       */
/*  explain using the vocal and verbal cues."                                  */
/*                                                                            */
/*  Three parts, and the middle one is the point. Praise without its evidence  */
/*  is flattery, and flattery from a coaching product teaches the student to   */
/*  discount every later compliment.                                          */
/* -------------------------------------------------------------------------- */

function code(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

const MODAL = code("src/components/willab/DeckChunkModal.tsx");

/** The BE's closed vocabulary (services/delivery_cues.py CUE_KEYS). */
const BE_CUE_KEYS = [
  "even_pitch",
  "full_volume",
  "kept_moving",
  "landed_ending",
  "no_hesitation",
  "opened_strong",
  "settled_pitch",
  "wide_range",
];

describe("every cue the backend can send has copy here", () => {
  it("covers the whole vocabulary", () => {
    // A cue with no sentence renders NOTHING, which on this lane means a
    // compliment with no reason — the exact failure the evidence exists to
    // prevent. So the two vocabularies have to stay in step.
    for (const key of BE_CUE_KEYS) {
      expect(PRAISE_CUE_COPY[key], `no copy for ${key}`).toBeTruthy();
    }
  });

  it("holds nothing the backend cannot send", () => {
    for (const key of Object.keys(PRAISE_CUE_COPY)) {
      expect(BE_CUE_KEYS, `${key} is not a BE cue`).toContain(key);
    }
  });

  it("says what the VOICE did, never what the words meant", () => {
    // The construct fence: these are observations about delivery. A sentence
    // about the content would be a claim the acoustic read never made.
    for (const line of Object.values(PRAISE_CUE_COPY)) {
      expect(line).toMatch(/pitch|volume|pause|paus|pace|energy|ending|voice/i);
    }
  });
});

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

describe("praiseLines", () => {
  it("returns one line per known cue, in the order given", () => {
    expect(praiseLines(["landed_ending", "full_volume"])).toEqual([
      PRAISE_CUE_COPY.landed_ending,
      PRAISE_CUE_COPY.full_volume,
    ]);
  });

  it("drops a cue it has no copy for rather than inventing one", () => {
    expect(praiseLines(["landed_ending", "vibes"])).toEqual([
      PRAISE_CUE_COPY.landed_ending,
    ]);
  });

  it("de-duplicates", () => {
    expect(praiseLines(["wide_range", "wide_range"])).toHaveLength(1);
  });

});

describe("the modal renders praise as evidence, not as a verdict", () => {

  it("is read, not rated (founder 2026-09-15)", () => {
    // The rating is gone: a black CTA on a question about your own praise
    // makes disagreeing feel like refusing. But the WRITE stays, because the
    // write is what marked the item decided — without it praise is re-offered
    // every time the paragraph opens.
    expect(MODAL).not.toMatch(/"Not useful"/);
    expect(MODAL).not.toMatch(/resolveObservedFeedback/);
    expect(MODAL).toMatch(/recordFeedbackResponse\("acknowledged"\)/);
    // Next, not Continue, since the founder lock of 2026-09-30 (D10).
    expect(MODAL).toMatch(/pagerNext/);
    expect(MODAL).not.toMatch(/pillContinue/);
    expect(MODAL).not.toMatch(/Use as flagship/);
  });

});

describe("the Confident Voice card asks, and asks honestly", () => {

  it("keeps a possible confidence read neutral", () => {
    expect(CONFIDENT_VOICE_WHY).not.toMatch(
      /incredibly|impeccable|amazing|definitely/i
    );
  });

});
