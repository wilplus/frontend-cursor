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
import { CHUNK_SHEET_COPY as COPY } from "@/components/willab/idealEditCopy";

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

/** One step renderer's body: from its declaration to the next sibling
 *  declaration at the component's own indentation. */
function renderer(name: string): string {
  const start = MODAL.indexOf(`function ${name}(): React.ReactNode {`);
  expect(start, `${name} is not declared`).toBeGreaterThan(-1);
  const rest = MODAL.slice(start + 1);
  const end = rest.search(/\n {2}(?:function |const )/);
  return end === -1 ? rest : rest.slice(0, end);
}

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
    // that a student cannot check by reading. Since #370 the feedback step
    // has its own renderer: reached only on its own step, drawn only with a
    // suggestion in hand, and carrying the player.
    expect(MODAL).toMatch(/step\.kind === "feedback" \? renderFeedbackStep\(\)/);
    const feedback = renderer("renderFeedbackStep");
    expect(feedback).toMatch(/^[^{]*\{\s*if \(!suggestion\) return null;/);
    expect(feedback).toMatch(/MediaPlayer/);
  });

  it("is read, not rated (founder 2026-09-15)", () => {
    // The rating is gone: a black CTA on a question about your own praise
    // makes disagreeing feel like refusing. But the WRITE stays, because the
    // write is what marked the item decided — without it praise is re-offered
    // every time the paragraph opens.
    expect(MODAL).not.toMatch(/"Not useful"/);
    expect(MODAL).not.toMatch(/resolveObservedFeedback/);
    expect(MODAL).toMatch(/recordFeedbackResponse\("acknowledged"\)/);
    expect(MODAL).toMatch(/pillContinue/);
    expect(MODAL).not.toMatch(/Use as flagship/);
  });

  it("shows no 'Suggested' block, because nothing is suggested", () => {
    // Praise has its own step now; the rewrite cards render only on theirs.
    // Each step dispatches to its own renderer, both need a suggestion in
    // hand, and the "clearer version" card lives in the suggestion renderer
    // alone — never in praise.
    expect(MODAL).toMatch(/step\.kind === "praise" \? renderPraiseStep\(\)/);
    expect(MODAL).toMatch(
      /step\.kind === "suggestion" \? renderSuggestionStep\(\)/,
    );
    const praise = renderer("renderPraiseStep");
    const rewrite = renderer("renderSuggestionStep");
    for (const body of [praise, rewrite]) {
      expect(body).toMatch(/^[^{]*\{\s*if \(!suggestion\) return null;/);
    }
    expect(praise).not.toMatch(/cardClearerVersion/);
    expect(rewrite).toMatch(/cardClearerVersion/);
  });

  it("does not stack a generic reason line on top of the praise", () => {
    // This used to be guarded — `rationale && !isPraise && !isConfidentVoice`
    // kept the machine's whyLine() away from praise. On 2026-09-15 the founder
    // removed that line from the sheet outright ("delete the text 'this makes
    // your point easier to understand'"), so praise is safe by construction:
    // there is no generic reason line left anywhere to stack.
    expect(MODAL).not.toMatch(/\{rationale\b/);
    expect(MODAL).not.toMatch(/whyLine\(suggestion\)/);
    // The coach note card went with it (§6). The coach REVIEW STATUS pill
    // stays — a different thing, and still on every screen.
    expect(MODAL).not.toMatch(/coachNote/);
    expect(MODAL).toMatch(/coachReviewStatus \? \(/);
  });
});

describe("the Confident Voice card asks, and asks honestly", () => {
  it("goes FULL SCREEN, without a gesture", () => {
    // A question arriving half below the fold gets answered by whoever
    // scrolls, which is a bias in which moments reach the album rather than a
    // layout nit.
    expect(MODAL).toMatch(/expanded \|\| isConfidentVoice/);
  });

  it("renders the five-choice immutable self-report", () => {
    // The question moved into idealEditCopy with the rest of the sheet's
    // strings (LIVE LOOP: a sign-off is one file to read), so the modal
    // references it rather than spelling it.
    expect(MODAL).toMatch(/question=\{COPY\.confidenceQuestion\}/);
    expect(COPY.confidenceQuestion).toBe("Does this sound confident to you?");
    expect(MODAL).toMatch(/ConfidenceLabelChips/);
  });

  it("asks immediately after playback, and nothing else is on the screen", () => {
    // The explanation block is gone (founder 2026-09-15, §6): listen, then
    // answer. Answering advances on its own — there is no thank-you screen
    // and no Done step behind it.
    const player = MODAL.indexOf("MediaPlayer");
    const question = MODAL.indexOf("confidenceQuestion");
    expect(player).toBeGreaterThan(-1);
    expect(question).toBeGreaterThan(player);
    expect(MODAL).not.toMatch(/CONFIDENT_VOICE_WHY|AGREE_THANKS/);
  });

  it("keeps the No copy available, unshown, and still neutral", () => {
    // The card no longer renders it, but the string is the founder's and the
    // rule it encodes outlives this layout: an answer of "no" is never argued
    // with.
    expect(MODAL).not.toContain("CONFIDENT_VOICE_NO");
    expect(CONFIDENT_VOICE_NO).toBe("Thanks for letting us know.");
    expect(CONFIDENT_VOICE_NO).not.toMatch(/confident|learn|voice/i);
  });

  it("keeps a possible confidence read neutral", () => {
    expect(CONFIDENT_VOICE_WHY).not.toMatch(
      /incredibly|impeccable|amazing|definitely/i
    );
  });

  it("writes the exact feedback identity and lets the database bind its clip", () => {
    expect(MODAL).toMatch(/saveTakeFeedbackResponse/);
    expect(MODAL).toMatch(/feedbackFamily: "confident_voice"/);
    expect(MODAL).not.toMatch(/response: value,[\s\S]{0,80}snippetId/);
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
