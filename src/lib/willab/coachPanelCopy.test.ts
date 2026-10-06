import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { CHUNK_SHEET_COPY } from "@/components/willab/idealEditCopy";
import { COACH_PANEL_COPY, COACH_PANEL_COPY_SOURCES } from "./coachPanelCopy";
import { COACH_WALK_COPY } from "./coachWalkCopy";

/* -------------------------------------------------------------------------- */
/*  THE COACH PANEL SAYS ONLY SIGNED WORDS (LIVE LOOP: copy needs the          */
/*  founder's sign-off).                                                       */
/*                                                                            */
/*  Every string in COACH_PANEL_COPY is either (a) on the lock's signed list  */
/*  below, pasted from FOUNDER-LOCK-coach-panel-redesign-2026-10-06 ("Words   */
/*  signed (CP2 A)"), (b) the very value an existing copy module exports, or  */
/*  (c) one of the two buttons the lock's flow names. And the panel's        */
/*  components carry no literal word of their own.                           */
/* -------------------------------------------------------------------------- */

/** Pasted verbatim from the lock, "Words signed (CP2 A)", `{p}` the speaker. */
const SIGNED_CP2_A = [
  "Queue: Your speakers · {n} moments waiting",
  "A speaker: Goal: … · {n} of {m} moments waiting · All moments answered · Answered · {n} moments",
  "All speakers: Your speakers",
  "What happened (title) · The machine heard",
  "What kind of error is it? · The machine heard this · Something else · Name a new error · I don't hear an error",
  "Name the error · A few words, as you would say it to another coach · e.g. trailing off · Your exercise goes to {p} now. The library offers it to other speakers once the machine can hear this error; every coach who names it brings that closer.",
  "Choose exercise (the founder's own title, 21:39 UTC) · What will you do? · Served: {exercise} · {n} more for {error} in the library · Your own words and video · Write your praise · Write a clearer version · Write a note",
  "Swap it: All treat {error} · shown in random order · Served now · Treats: {error} · Details",
  "An exercise's details: Treats: {error} · Back to the list",
  "Your words: As {p} will see it · the pencil edits every word",
  "Your video: Say the instruction in your own words · under a minute · Optional · under a minute",
  "What did {p} do well? · What kind of fix is it?",
  "Ready for {p} · Without a video it goes to {p} only, not to the library. · In the library under “{error}”, waiting until the machine can hear it.",
  "Summary: Your answer · Change my answer",
  "A word for this Take: Optional · it opens first in {p}’s feedback · As {p} will see it · Send without a video",
  "Training corpus: Import audio, label it, then judge its moments blind · {n} imports · {n} moments to judge · {n} of {m} moments to judge · One recording · it is cut into moments you judge blind · Choose a file · Audio or video, up to 30 minutes · Imported · {n} moments",
  "Training corpus set-up: Finish the set-up · Before its moments can be judged · Set-up not finished · finish it before judging · Set up · {n} moments",
  "Library (now in admin): One error · the library offers it when the machine hears it · As a speaker will see it · the pencil edits every word · An exercise needs its video · Bring it back · Retire it · Praise lines the library offers when the machine hears this · None yet. · Exercises that treat it",
] as const;

/** The lock's flow, step 1: "Two buttons pinned above the message box, with
 *  icons: **Speakers** … and **Training corpus**." */
const LOCK_FLOW_NAMES = ["Speakers", "Training corpus"] as const;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Each signed fragment as a pattern: a placeholder is any number or name. */
const FRAGMENTS: RegExp[] = SIGNED_CP2_A.flatMap((line) => {
  const parts = line.split(" · ");
  // The first fragment may carry the screen's name ("Queue: "); keep both.
  const first = parts[0];
  const colon = first.indexOf(": ");
  if (colon > 0) parts.push(first.slice(colon + 2));
  return parts;
}).map((fragment) => {
  const pattern = escape(fragment.replace(/\s*\((the )?title\)|\s*\(the founder's own title.*\)/, ""))
    .replace(/\\\{n\\\}|\\\{m\\\}/g, "\\d+")
    .replace(/\\\{[a-z]+\\\}/g, ".+");
  return new RegExp(`^${pattern}$`);
});

/** A rendered string is signed when every " · " piece is a signed fragment;
 *  a count of one may read in the singular ("1 moment waiting"). */
function isSigned(text: string): boolean {
  return text.split(" · ").every((piece) => {
    const plural = piece.replace(/^(.*\b1 )moment\b/, "$1moments").replace(/^1 moment\b/, "1 moments");
    return FRAGMENTS.some((re) => re.test(piece) || re.test(plural));
  });
}

/** Every value an existing copy module exports, by identity. */
function exportedValues(value: unknown): unknown[] {
  if (value && typeof value === "object") return [value, ...Object.values(value).flatMap(exportedValues)];
  return [value];
}
const EXISTING = new Set<unknown>([...exportedValues(COACH_WALK_COPY), ...exportedValues(CHUNK_SHEET_COPY)]);

describe("COACH_PANEL_COPY", () => {
  it("reuses existing words by reference, never by retyping", () => {
    for (const key of COACH_PANEL_COPY_SOURCES.reused) {
      if (key === "take") continue; // composed below
      const value = COACH_PANEL_COPY[key as keyof typeof COACH_PANEL_COPY];
      expect(EXISTING.has(value), key).toBe(true);
    }
  });

  it("composes 'Take N' from the signed coach-card word (L6)", () => {
    expect(COACH_PANEL_COPY.take(2)).toBe(`${CHUNK_SHEET_COPY.historyTake} 2`);
    expect(COACH_PANEL_COPY.take(null)).toBe(CHUNK_SHEET_COPY.historyTake);
  });

  it("every new word is on the lock's signed list", () => {
    const samples: Record<string, string[]> = {
      yourSpeakers: [COACH_PANEL_COPY.yourSpeakers],
      momentsWaiting: [COACH_PANEL_COPY.momentsWaiting(1), COACH_PANEL_COPY.momentsWaiting(4)],
      takeWaiting: [COACH_PANEL_COPY.takeWaiting(2, 4)],
      allMomentsAnswered: [COACH_PANEL_COPY.allMomentsAnswered],
      answered: [COACH_PANEL_COPY.answered],
      answeredMoments: [COACH_PANEL_COPY.answeredMoments(1), COACH_PANEL_COPY.answeredMoments(3)],
      whatHappened: [COACH_PANEL_COPY.whatHappened],
      machineHeard: [COACH_PANEL_COPY.machineHeard],
    };
    expect(Object.keys(samples).sort()).toEqual([...COACH_PANEL_COPY_SOURCES.signed].sort());
    for (const [key, texts] of Object.entries(samples)) {
      for (const text of texts) expect(isSigned(text), `${key}: ${text}`).toBe(true);
    }
  });

  it("the pinned buttons are the lock's own names", () => {
    expect([COACH_PANEL_COPY.speakers, COACH_PANEL_COPY.trainingCorpus]).toEqual([...LOCK_FLOW_NAMES]);
    expect([...COACH_PANEL_COPY_SOURCES.named].sort()).toEqual(["speakers", "trainingCorpus"]);
  });

  it("the checker itself refuses an unsigned word", () => {
    expect(isSigned("3 speakers to judge")).toBe(false);
    expect(isSigned("Your score")).toBe(false);
    expect(isSigned("Your speakers")).toBe(true);
    expect(isSigned("2 of 4 moments waiting")).toBe(true);
  });

  it("no signed word carries a percentage or a score (AC-9)", () => {
    const all = JSON.stringify(SIGNED_CP2_A) + JSON.stringify(COACH_PANEL_COPY);
    expect(all).not.toMatch(/%|\bscore\b/i);
  });
});

/* ── the panel's components carry no literal word ─────────────────────── */

const DIR = "src/components/willab/coachpanel";
const FILES = readdirSync(DIR).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f));
const SPOKEN_ATTRS = new Set(["aria-label", "title", "placeholder", "alt", "label", "aria-description"]);

function literalText(node: ts.Node): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) return [node.head.text, ...node.templateSpans.map((s) => s.literal.text)].join(" ");
  return null;
}

function spoken(file: string): string[] {
  const text = readFileSync(join(DIR, file), "utf8");
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node) && node.text.trim()) out.push(node.text.trim());
    if (ts.isJsxExpression(node) && node.expression && ts.isJsxElement(node.parent)) {
      const t = literalText(node.expression);
      if (t !== null) out.push(t);
    }
    if (ts.isJsxAttribute(node) && SPOKEN_ATTRS.has(node.name.getText(source)) && node.initializer) {
      const init = node.initializer;
      const t = ts.isStringLiteral(init)
        ? init.text
        : ts.isJsxExpression(init) && init.expression
          ? literalText(init.expression)
          : null;
      if (t !== null) out.push(t);
    }
    if (ts.isPropertyAssignment(node) && ["label", "title", "subtitle", "lead", "message"].includes(node.name.getText(source))) {
      const t = literalText(node.initializer);
      if (t !== null) out.push(t);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return out.filter((t) => /[A-Za-z]/.test(t));
}

describe("the coach panel's components", () => {
  it("exist", () => {
    expect(FILES.length).toBeGreaterThan(0);
  });

  it.each(FILES)("%s says no word of its own", (file) => {
    expect(spoken(file)).toEqual([]);
  });
});
