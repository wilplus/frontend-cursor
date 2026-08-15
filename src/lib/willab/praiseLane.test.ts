import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
  PRAISE_CUE_COPY,
  PRAISE_CUE_LEAD,
  PRAISE_LEAD,
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
  it("no digits in any praise string", () => {
    const all = [PRAISE_LEAD, PRAISE_CUE_LEAD, ...Object.values(PRAISE_CUE_COPY)];
    for (const line of all) expect(line).not.toMatch(/\d/);
  });

  it("no score, ratio, percent or rank vocabulary", () => {
    const all = [PRAISE_LEAD, PRAISE_CUE_LEAD, ...Object.values(PRAISE_CUE_COPY)];
    for (const line of all) {
      expect(line).not.toMatch(/score|percent|rating|rank|out of|level \w/i);
    }
  });

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

  it("is empty for no cues, and never throws on junk", () => {
    expect(praiseLines([])).toEqual([]);
    expect(() => praiseLines(["", "x"])).not.toThrow();
  });
});

describe("the modal renders praise as evidence, not as a verdict", () => {
  it("plays the recording of the moment", () => {
    // The claim is about how it SOUNDED — the one claim this product makes
    // that a student cannot check by reading.
    expect(MODAL).toMatch(/isPraise[\s\S]{0,900}MediaPlayer/);
  });

  it("offers ONE button, not Accept / Keep mine", () => {
    // "Keep mine" under a compliment asks the student to choose between it
    // and their own writing, which is not a choice anybody has.
    expect(MODAL).toMatch(/isPraise \?[\s\S]{0,700}Got it/);
  });

  it("shows no 'Suggested' block, because nothing is suggested", () => {
    expect(MODAL).toMatch(/\{isPraise \? null : \(/);
  });

  it("does not stack the generic reason line on top of the praise", () => {
    expect(MODAL).toMatch(/rationale && !isPraise/);
  });
});
