import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  ERROR_ID_SHAPE,
  draftProblem,
  mapSpeakingError,
  suggestErrorId,
  type SpeakingErrorDraft,
} from "./speakingErrors";

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
const PAGE = readFileSync("src/app/coach/errors/page.client.tsx", "utf8");
const ROUTE = readFileSync(
  "src/app/api/v2/coach/speaking-errors/route.ts",
  "utf8",
);

const GOOD: SpeakingErrorDraft = {
  errorId: "trailing_mumble",
  label: "Trailing mumble",
  definition: "The last words lose volume while the pace stays even.",
  asks: "Did the speaker carry the end of the sentence?",
};

describe("mapSpeakingError", () => {
  it("reads a detected row with its detector", () => {
    const entry = mapSpeakingError({
      error_id: "rushing",
      label: "Rushing",
      definition: "…",
      asks: "Did this passage give the listener room to follow it?",
      status: "detected",
      detector_ref: "insufficient_pauses,irregular_rushed_pacing",
      active: true,
    });
    expect(entry?.status).toBe("detected");
    expect(entry?.detectorRef).toBe(
      "insufficient_pauses,irregular_rushed_pacing",
    );
  });

  it("treats ANY unreadable status as observed, never as detected", () => {
    // Fail-closed in the direction that matters. Showing an observed row as
    // "routes exercises" is a lie an author would act on; showing a detected
    // row as observed is visible and recoverable.
    for (const status of [undefined, null, "", "DETECTED", "detected ", 1, {}]) {
      const entry = mapSpeakingError({
        error_id: "x", label: "X", definition: "d", asks: "a", status,
      });
      expect(entry?.status, String(status)).toBe("observed");
    }
  });

  it("drops a row missing any of the four required fields", () => {
    for (const missing of ["error_id", "label", "definition", "asks"]) {
      const raw: Record<string, unknown> = {
        error_id: "x", label: "X", definition: "d", asks: "a",
      };
      delete raw[missing];
      expect(mapSpeakingError(raw), missing).toBeNull();
    }
  });

  it("defaults active to true, because only an explicit false retires", () => {
    const base = { error_id: "x", label: "X", definition: "d", asks: "a" };
    expect(mapSpeakingError(base)?.active).toBe(true);
    expect(mapSpeakingError({ ...base, active: false })?.active).toBe(false);
  });

  it("never throws on junk", () => {
    for (const junk of [null, undefined, 1, "x", []]) {
      expect(() => mapSpeakingError(junk)).not.toThrow();
      expect(mapSpeakingError(junk)).toBeNull();
    }
  });
});

describe("the id shape is the thing that makes matching work", () => {
  it("accepts the three ids the catalogue already speaks", () => {
    for (const id of ["rushing", "word_compression", "ending_compression"]) {
      expect(ERROR_ID_SHAPE.test(id), id).toBe(true);
    }
  });

  it("refuses anything that would match nothing and say nothing", () => {
    // Matching is string overlap against an exercise's tags. A space or a
    // capital matches no exercise, raises no error, and routes nothing.
    for (const bad of [
      "Word Compression", "word compression", "word-compression",
      "", "9lives", "_leading", "x", "é_accent",
    ]) {
      expect(ERROR_ID_SHAPE.test(bad), bad).toBe(false);
    }
  });

  it("mirrors the backend regex exactly", () => {
    // Three layers carry this rule (CHECK constraint, service, here). They are
    // duplicated on purpose, so they have to stay identical.
    expect(ERROR_ID_SHAPE.source).toBe("^[a-z][a-z0-9_]{1,62}$");
  });
});

describe("draftProblem", () => {
  it("passes a complete draft", () => {
    expect(draftProblem(GOOD)).toBeNull();
  });

  it("names the id problem first, and explains the consequence", () => {
    const problem = draftProblem({ ...GOOD, errorId: "Trailing Mumble" });
    expect(problem).toMatch(/lower-case/);
    expect(problem).toMatch(/match nothing/);
  });

  it("refuses a name with no definition, citing the construct fence", () => {
    const problem = draftProblem({ ...GOOD, definition: "   " });
    expect(problem).toMatch(/construct fence/);
  });

  it("refuses a definition with no question, and asks for exactly one", () => {
    expect(draftProblem({ ...GOOD, asks: "" })).toMatch(/one thing, never two/);
  });

  it("treats whitespace-only as missing for every field", () => {
    for (const field of ["label", "definition", "asks"] as const) {
      expect(draftProblem({ ...GOOD, [field]: "  \n " }), field).not.toBeNull();
    }
  });
});

describe("suggestErrorId", () => {
  it("turns a human name into a legal id", () => {
    expect(suggestErrorId("Trailing mumble")).toBe("trailing_mumble");
    expect(suggestErrorId("Ending compression")).toBe("ending_compression");
  });

  it("produces something the shape accepts, or nothing at all", () => {
    for (const label of [
      "Trailing mumble", "  Loud   START  ", "é accent", "9 lives", "!!!",
      "a".repeat(80),
    ]) {
      const id = suggestErrorId(label);
      if (id) expect(ERROR_ID_SHAPE.test(id), `${label} → ${id}`).toBe(true);
    }
  });
});

describe("the write path can only ever say `observed`", () => {
  it("never sends a status", () => {
    // The service refuses a `detected` claim, but this module does not even
    // offer it: a name cannot make a capability exist.
    expect(CLIENT).not.toMatch(/status:\s*["']detected["']/);
    expect(CLIENT).toMatch(/error_id: draft\.errorId\.trim\(\)/);
    expect(CLIENT).not.toMatch(/JSON\.stringify\(\{[^}]*status/);
  });

  it("never sends observed_by, because the caller does not own it", () => {
    // L3: provenance is who the server saw, not who the body claimed.
    expect(CLIENT).not.toMatch(/observed_by:/);
  });

  it("has no form control for status anywhere on the screen", () => {
    expect(PAGE).not.toMatch(/detectorRef=\{|setStatus|status:\s*["']/);
  });
});

describe("L3 — a name is never evidence about a recording", () => {
  it("no clip, take, student or session reaches this surface", () => {
    // A row here is a NAME and a DEFINITION. Attaching it to a recording would
    // turn naming into a coach judgement about a specific take, which is a
    // different provenance lane entirely.
    for (const forbidden of [
      "snippet", "sessionId", "session_id", "takeId", "take_session",
      // `audioRef`/`audio_ref` rather than bare "audio": the word itself is
      // honest prose here ("code can find this in audio" describes the
      // detector's medium). What L3 forbids is a POINTER to one recording.
      "arcId", "arc_id", "studentId", "pseudonym", "audioRef", "audio_ref",
    ]) {
      expect(PAGE, `page mentions ${forbidden}`).not.toContain(forbidden);
      expect(CLIENT, `client mentions ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("the proxy talks to exactly one endpoint and reshapes nothing", () => {
    const paths = ROUTE.match(/"\/v2\/[^"]+"/g) ?? [];
    expect(new Set(paths)).toEqual(new Set(['"/v2/coach/speaking-errors"']));
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
