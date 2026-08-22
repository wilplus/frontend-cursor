import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
  AGREE_QUESTION,
  AGREE_THANKS,
  CONFIDENT_VOICE_NO,
  CONFIDENT_VOICE_WHY,
  PRAISE_CUE_COPY,
  PRAISE_CUE_LEAD,
  PRAISE_LEAD,
  praiseLines,
} from "./trackedChangeWhy";
import { CONFIDENCE_QUESTION } from "@/services/api/stateRatings";

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
    expect(MODAL).toMatch(/isConfidentVoice \? \([\s\S]{0,900}MediaPlayer/);
  });

  it("offers the flagship decision explicitly", () => {
    expect(MODAL).toMatch(/Use as flagship/);
    expect(MODAL).toMatch(/Not now/);
  });

  it("shows no 'Suggested' block, because nothing is suggested", () => {
    expect(MODAL).toMatch(/\{isPraise \|\| isConfidentVoice \? null : \(/);
  });

  it("does not stack the generic reason line on top of the praise", () => {
    expect(MODAL).toMatch(/rationale && !isPraise && !isConfidentVoice/);
  });
});

describe("the Confident Voice card asks, and asks honestly", () => {
  it("goes FULL SCREEN, without a gesture", () => {
    // It carries a player, an explanation and a question now. A question
    // arriving half below the fold gets answered by whoever scrolls, which is
    // a bias in which moments reach the album rather than a layout nit.
    expect(MODAL).toMatch(/expanded \|\| isConfidentVoice/);
  });

  it("renders the locked binary self-report", () => {
    expect(MODAL).toContain("Does this sound confident to you?");
    expect(MODAL).toMatch(/\["yes", "no"\]/);
    expect(MODAL).not.toMatch(/ConfidenceLabelChips/);
  });

  it("asks immediately after playback and reveals reasons afterwards", () => {
    const player = MODAL.indexOf("MediaPlayer");
    const question = MODAL.indexOf("Does this sound confident to you?");
    const explanation = MODAL.indexOf("CONFIDENT_VOICE_WHY", question);
    expect(player).toBeGreaterThan(-1);
    expect(question).toBeGreaterThan(player);
    expect(explanation).toBeGreaterThan(question);
  });

  it("acknowledges No without contradicting the speaker", () => {
    expect(MODAL).toMatch(/agreeValue === "no"/);
    expect(MODAL).toContain("CONFIDENT_VOICE_NO");
    expect(CONFIDENT_VOICE_NO).toBe("Thanks for letting us know.");
    expect(CONFIDENT_VOICE_NO).not.toMatch(/confident|learn|voice/i);
  });

  it("keeps a possible confidence read neutral", () => {
    expect(CONFIDENT_VOICE_WHY).not.toMatch(
      /incredibly|impeccable|amazing|definitely/i
    );
  });

  it("writes through the anchored owner-routing endpoint", () => {
    // This answer is personal Voice Album routing. It is deliberately kept
    // outside the blind peer-label corpus and can never become a quorum vote.
    expect(MODAL).toMatch(/saveConfidenceAgreement/);
  });

  it("cannot construct an answer nobody gave", () => {
    // buildRatingBody returns null for an inexpressible pair, and the send
    // stops there rather than posting something the BE would have to reject.
    expect(MODAL).toMatch(/buildRatingBody/);
    expect(MODAL).toMatch(/if \(!body\) return;/);
  });

  it("rolls the chip back when the write fails", () => {
    // A lit chip over a row the server never took is the same lie the style
    // apply refuses to tell.
    expect(MODAL).toMatch(/setAgreeValue\(null\);[\s\S]{0,120}setAgreeError/);
  });
});

describe("the agree copy says what it means", () => {
  it("asks about THEIR experience, not the blind rater's question", () => {
    // CONFIDENCE_QUESTION is asked of somebody told nothing. This is asked of
    // the speaker about a read they were just shown, and the wording has to
    // say so or the answer is uninterpretable.
    expect(AGREE_QUESTION).not.toBe(CONFIDENCE_QUESTION);
    expect(AGREE_QUESTION).toMatch(/you/i);
  });

  it("promises nothing about what the answer does", () => {
    // It is not a vote — it routes. Copy that implied otherwise would be a
    // promise this surface cannot keep.
    for (const line of [AGREE_QUESTION, AGREE_THANKS]) {
      expect(line).not.toMatch(/\d/);
      expect(line).not.toMatch(/vote|count|score|rating/i);
    }
  });
});
