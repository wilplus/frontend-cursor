import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* -------------------------------------------------------------------------- */
/*  THE SPEAKING ERROR LIBRARY (founder 2026-09-16)                            */
/*                                                                            */
/*  "that is our goal to have the library of the errors so we can recognise    */
/*  them and we have the exercise matching algorithm and they should go hand   */
/*  in hand."                                                                  */
/*                                                                            */
/*  One distinction carries this whole surface: `detected` routes exercises,   */
/*  `observed` is the backlog. Read it wrong in either direction and the       */
/*  failure is SILENT — exercises simply stop routing, with no exception and   */
/*  no log to notice.                                                         */
/* -------------------------------------------------------------------------- */

const CLIENT = readFileSync("src/services/api/speakingErrors.ts", "utf8");
const PAGE = readFileSync("src/app/admin/errors/SpeakingErrorsPanel.tsx", "utf8");

describe("the write path can only ever say `observed`", () => {

  it("never sends observed_by, because the caller does not own it", () => {
    // L3: provenance is who the server saw, not who the body claimed.
    expect(CLIENT).not.toMatch(/observed_by:/);
  });
});

describe("AC-9 — no number about a person is surfaced here", () => {
  it("the screen's own copy carries no score vocabulary", () => {
    // The DEFINITIONS carry thresholds, and must: a definition that does not
    // describe what the code measures is decoration. Those are read by an
    // author about a DETECTOR. Nothing on this screen says anything numeric
    // about a speaker.
    const copy = PAGE.match(/>[^<>{}]{12,}</g) ?? [];
    for (const line of copy) {
      // Word-bounded: "under\bscore\bs" is not a score, and a fence that cries
      // wolf on its own copy gets loosened rather than obeyed.
      expect(line).not.toMatch(/\bscores?\b|\brating\b|\bpercent|\bout of\b|\brank/i);
    }
  });
});
