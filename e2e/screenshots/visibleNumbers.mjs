/* -------------------------------------------------------------------------- */
/*  AC-9 on a rendered page: no visible number other than a count or a        */
/*  position.                                                                 */
/*                                                                            */
/*  The product never surfaces a score, a ratio or a classifier output to a   */
/*  speaker or a coach (CLAUDE.md, FENCES, AC-9). A screenshot cannot say      */
/*  that by itself, so the screenshot harness (capture.mjs) scans the text    */
/*  of every speaker and coach screen it draws and fails on any digit that    */
/*  is not one of the forms a count or a position takes:                      */
/*                                                                            */
/*    Take 2 · Slide 1 of 3 · 3 Takes · 2 of 5 · 0:12 · 12 words · 1:02:33    */
/*                                                                            */
/*  plus a document's version and date ("Version 3.3", "2026-10-07"), which   */
/*  the consent screens show by the founder's lock, and a year on its own     */
/*  (the footer's "WillpowerLab 2026"). A percentage is never                 */
/*  allowed, in any form. An area may widen the list for one screen with the  */
/*  manifest entry's `allow` — each widening is a decision to name in the PR. */
/*                                                                            */
/*  Pure; tested from scripts/visibleNumbers.test.ts.                          */
/* -------------------------------------------------------------------------- */

/** The nouns a bare count may precede ("3 Takes", "12 words", "2 min"). */
const COUNT_NOUNS = [
  "takes?", "slides?", "moments?", "words?", "paragraphs?", "speakers?",
  "projects?", "exercises?", "videos?", "recordings?", "answers?", "questions?",
  "steps?", "minutes?", "seconds?", "hours?", "days?", "weeks?", "min", "sec", "s",
].join("|");

/** Every form a number may take on a speaker or coach screen. */
export const ALLOWED_NUMBER_FORMS = [
  // a time, first, so "moment 0:02" is read as a time and not as a position: "0:12", "12:34", "1:02:33"
  new RegExp(String.raw`\b\d{1,2}:\d{2}(:\d{2})?\b`, "g"),
  // positions: "Take 2", "Take 2 of 3", "Slide 1 of 3", "Paragraph 4", "Step 2"
  new RegExp(String.raw`\b(Take|Slide|Paragraph|Step|Moment|Page)\s\d+(\sof\s\d+)?\b`, "gi"),
  // a bare position: "2 of 5" — never "8/10", which reads as a score
  new RegExp(String.raw`\b\d+\sof\s\d+\b`, "gi"),
  // a count: "3 Takes", "12 words", "2 min"
  new RegExp(String.raw`\b\d+\s?(${COUNT_NOUNS})\b`, "gi"),
  // a document's date and version (the consent screens, by their lock), and a
  // year on its own (the site footer's "WillpowerLab 2026")
  new RegExp(String.raw`\b(19|20)\d{2}(-\d{2}-\d{2})?\b`, "g"),
  new RegExp(String.raw`\b(Version|v)\s?\d+(\.\d+)*\b`, "gi"),
];

/** A percentage, in any form, is never a count or a position. */
const PERCENT = /\d[\d.,]*\s?(%|percent\b)/gi;

/**
 * Every number on the page that AC-9 forbids, each with the words around it.
 *
 * @param {string} text   the page's visible text (innerText)
 * @param {RegExp[]} allow  extra forms one screen may show (from its manifest entry)
 * @returns {{ match: string, context: string }[]}  empty when the screen is clean
 */
export function forbiddenNumbers(text, allow = []) {
  const flat = text.replace(/\s+/g, " ");
  const found = [];
  // Percentages first, whole, so nothing below reports them twice.
  let masked = flat.replace(PERCENT, (hit, _unit, index) => {
    found.push(at(flat, { 0: hit, index }));
    return " ".repeat(hit.length);
  });
  // Blank out every allowed form, keeping offsets, then look for what is left.
  for (const form of [...ALLOWED_NUMBER_FORMS, ...allow]) {
    masked = masked.replace(withGlobal(form), (hit) => " ".repeat(hit.length));
  }
  for (const m of masked.matchAll(/\d[\d.,]*/g)) found.push(at(flat, m));
  return found;
}

function withGlobal(re) {
  return re.global ? re : new RegExp(re.source, `${re.flags}g`);
}

function at(text, m) {
  const start = Math.max(0, m.index - 30);
  const end = Math.min(text.length, m.index + m[0].length + 30);
  return { match: m[0], context: text.slice(start, end).trim() };
}
