/* -------------------------------------------------------------------------- */
/*  THE F1 LOOP CONTRACT — the frontend half                                   */
/*                                                                            */
/*  FOUNDER, 2026-09-22, before releasing five parallel agent sessions onto    */
/*  the provenance audit: "how can we do it so that the two things             */
/*  collaborate and step by step sort of talk to each other and check if       */
/*  nothing got broken?"                                                       */
/*                                                                            */
/*  This file is that mechanism on this side of the wire, and it is            */
/*  deliberately a TEST and not a document. Five parallel sessions will not    */
/*  read a document. They will run the gate, because the gate is what stops    */
/*  their pull request merging.                                                */
/*                                                                            */
/*  EVERY LINE IS ONE OF TWO THINGS:                                           */
/*                                                                            */
/*    green  — true today, and a change that breaks it turns this file red;    */
/*    .fails — false today because the audit found a real defect, tagged       */
/*             with its finding id.                                            */
/*                                                                            */
/*  `it.fails` IS THE WHOLE TRICK. Vitest fails the suite when such a test     */
/*  starts PASSING. So the workstream that closes a finding is mechanically    */
/*  forced to come here and flip its line, and cannot quietly close a finding  */
/*  the contract still believes is open. Neither side has to remember the      */
/*  other exists: one writes the fix, the gate notices.                        */
/*                                                                            */
/*  Its twin is `tests/test_f1_loop_contract.py` in `backend-cursor`, and the  */
/*  ledger both of them write to is `docs/PIPELINE_WORK_LEDGER.md` there.      */
/*                                                                            */
/*  WHY THE SOURCE SCANS LIVE HERE rather than in a lint rule: AC-9 is a       */
/*  property of what a speaker can SEE, and the only place that is decidable   */
/*  is the component tree. A rule that reads the tree is the executable        */
/*  mechanism finding FE-1 says does not exist.                                */
/* -------------------------------------------------------------------------- */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  ANALYSIS_CEILING,
  DOCUMENT_CEILING,
  nextWaitPercent,
  waitPercent,
} from "./waitProgress";
import { isUntouched } from "./deckChunks";
import { judgedStatus } from "./chunkSteps";

const SRC = join(process.cwd(), "src");

/** Every .tsx a speaker can reach: the component tree minus the surfaces
 *  only a coach, an admin or a developer opens. */
function speakerFacingFiles(): string[] {
  const skip = /(^|\/)(coach|admin|dev|cms|api)(\/|$)/;
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (!skip.test(full.replace(SRC, ""))) walk(full);
        continue;
      }
      if (!full.endsWith(".tsx")) continue;
      if (/\.test\.tsx$/.test(full)) continue;
      if (/Coach|Admin|Dev/.test(entry)) continue;
      out.push(full);
    }
  };
  walk(SRC);
  return out;
}

// ══════════════════════════════════════════════════════════════════════════
//  1. THE WAIT NEVER LIES
// ══════════════════════════════════════════════════════════════════════════

describe("the wait screen tells the truth about itself", () => {
  const CAP = 120_000;

  it("never shows a full bar before the text exists", () => {
    /* FOUNDER 2026-09-22: "100% means instant switch to the ideal text". The
       top point is reserved for settlement, so a speaker never sees a
       finished bar and then waits behind it. */
    for (const elapsed of [0, 1_000, CAP, CAP * 10, Number.POSITIVE_INFINITY]) {
      expect(
        waitPercent({
          previous: null,
          held: 100,
          reported: 100,
          phase: "document",
          phaseElapsedMs: elapsed,
          capMs: CAP,
        }),
      ).toBeLessThanOrEqual(DOCUMENT_CEILING);
    }
  });

  it("keeps moving through a phase the backend says nothing about", () => {
    // "the loading is still stale after the processing is done".
    const early = waitPercent({
      previous: null, held: 100, phase: "document",
      phaseElapsedMs: 2_000, capMs: CAP,
    })!;
    const later = waitPercent({
      previous: null, held: 100, phase: "document",
      phaseElapsedMs: 40_000, capMs: CAP,
    })!;
    expect(later).toBeGreaterThan(early);
    expect(early).toBeGreaterThanOrEqual(ANALYSIS_CEILING);
  });

  it("never falls, in either phase or across the handover", () => {
    // A bar that falls reads as the work being lost and started again.
    expect(
      waitPercent({
        previous: 97, held: 10, phase: "document",
        phaseElapsedMs: 0, capMs: CAP,
      }),
    ).toBe(97);
    expect(nextWaitPercent(62, null)).toBe(62);
    expect(nextWaitPercent(62, 40)).toBe(62);
  });

  it("says nothing before the first report rather than guessing", () => {
    expect(
      waitPercent({
        previous: null, held: null, phase: "analysis",
        phaseElapsedMs: 9_000, capMs: CAP,
      }),
    ).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════
//  2. A PARAGRAPH'S STATE IS THE ONE THE SPEAKER PUT IT IN
// ══════════════════════════════════════════════════════════════════════════

describe("the four states of a paragraph", () => {
  const base = {
    locked: false,
    decided: false,
    rootPhrase: null,
    iteration: 0,
  };

  it("an untouched paragraph is the one nothing has happened to", () => {
    expect(isUntouched(base)).toBe(true);
  });

  it("anything the speaker did makes it reviewed", () => {
    /* Founder 2026-09-21, on what counts: an answer of any kind, a rooting
       phrase, a lock cycle — and an edit. */
    expect(isUntouched({ ...base, decided: true })).toBe(false);
    expect(isUntouched({ ...base, rootPhrase: "steady now" })).toBe(false);
    expect(isUntouched({ ...base, locked: true })).toBe(false);
    expect(isUntouched({ ...base, iteration: 1 })).toBe(false);
    expect(isUntouched({ ...base, edited: true })).toBe(false);
  });

  it("every answer decides the item one way or the other", () => {
    // The page and the lock gate must agree; a bookmark the speaker
    // answered may never come back looking open.
    expect(judgedStatus("yes")).toBe("approved");
    // Every other answer is still an ANSWER: the item is decided, and the
    // bookmark must not come back looking open. `judgedStatus` narrows the
    // five owner states to that one question, which is why its input type
    // is "yes" | "other" rather than the vocabulary itself.
    expect(judgedStatus("other")).toBe("dismissed");
  });
});

// ══════════════════════════════════════════════════════════════════════════
//  3. NO NUMBER REACHES A SPEAKER (AC-9)
// ══════════════════════════════════════════════════════════════════════════

/** A rendered measurement: a number followed by a unit, inside JSX. */
const MEASUREMENT = /\$\{[^}]*\}\s*(Hz|dB|wpm|ms)\b|\btoFixed\s*\(/;

describe("AC-9 — the read is qualitative", () => {
  it.fails(
    "no surface a speaker can open renders a measured number",
    () => {
      /* FE-1 (audit, kept major): "No executable mechanism prevents a
         render and the backend's own test pins the payload."

         Reproduces. `SpeechDataPanel`, `SlideTake` and `LibraryOverlay` all
         format pitch in Hz, pace in words per minute and volume in dB and
         render them into the component tree. Whether a given speaker can
         reach each one today is a question of flags and props — which is
         exactly FE-1's point: nothing in the code decides it.

         THIS TEST IS THAT MECHANISM. Owner: the workstream that closes
         FE-1. When it does, remove `.fails` here; the list below is then
         the thing that stops the next one coming back. */
      const offenders = speakerFacingFiles().filter((file) =>
        MEASUREMENT.test(readFileSync(file, "utf8")),
      );
      expect(offenders.map((f) => f.replace(SRC, "src"))).toEqual([]);
    },
  );

  it("the waiting screen's own labels name work, not judgement", () => {
    const banned = ["score", "ratio", "percentile", "classifier",
                    "charisma", "verdict"];
    const wait = readFileSync(
      join(SRC, "components/willab/ProcessingWait.tsx"), "utf8");
    const labels = [...wait.matchAll(/"([A-Z][^"]{4,60})"/g)].map((m) => m[1]);
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) {
      for (const word of banned) {
        expect(label.toLowerCase()).not.toContain(word);
      }
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════
//  4. THE PAGE ASKS THE SERVER, IT DOES NOT DECIDE FOR IT
// ══════════════════════════════════════════════════════════════════════════

describe("the page never invents what the server did not say", () => {
  it("reserves a bookmark's place only while the server says it is coming", async () => {
    /* The reserved slot is honest in both directions: it holds the mark's
       footprint while work is genuinely outstanding, and it releases when
       the server has answered — an empty lane is a real outcome. */
    const { feedbackStillComing } = await import("./enrichmentSettle");
    expect(feedbackStillComing({ document_layers: { retryable: true } }))
      .toBe(true);
    expect(feedbackStillComing({ document_layers: {}, feedback: {} }))
      .toBe(false);
    // A section that puts nothing on the page never holds the slot open.
    expect(feedbackStillComing({ learning: { retryable: true } })).toBe(false);
  });
});
