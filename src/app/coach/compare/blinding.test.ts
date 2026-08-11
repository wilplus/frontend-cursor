import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/* -------------------------------------------------------------------------- */
/*  THE BLINDING (founder 2026-08-11) — the A/B tool's whole instrument.        */
/*                                                                            */
/*  A rater who can tell which take is later stops rating the delivery and     */
/*  starts rating a story about improvement. A corpus collected that way       */
/*  anchors power_score's delivery term to RECENCY, and — this is the part     */
/*  that makes it worth a test rather than a comment — you cannot tell from    */
/*  the rows afterwards. It looks like a clean corpus.                        */
/*                                                                            */
/*  The backend enforces the payload; these assertions hold the surface's end  */
/*  of it, and they are mostly about words and absences rather than behaviour, */
/*  because that is where this particular defect would appear.                */
/* -------------------------------------------------------------------------- */

const UI_RAW = readFileSync("src/app/coach/compare/page.client.tsx", "utf8");
/** The file with its COMMENTS STRIPPED. Three fences today have been tripped
 *  by their own explanatory prose — a header that records which word was
 *  retired matches a rule about that word. What must hold is a property of
 *  what RENDERS, and the record of why is worth keeping, so the scan drops
 *  the commentary and keeps the code. */
const UI = UI_RAW.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const API = readFileSync("src/services/api/abPairs.ts", "utf8");
const PAIRS_ROUTE = readFileSync(
  "src/app/api/v2/coach/arcs/[arcId]/ab-pairs/route.ts",
  "utf8"
);
const VERDICT_ROUTE = readFileSync(
  "src/app/api/v2/coach/arcs/[arcId]/ab-verdict/route.ts",
  "utf8"
);

describe("the blinded A/B comparison (founder 2026-08-11)", () => {
  it("the side type has no field that identifies a take", () => {
    // Written to MATCH the backend's payload, so a future field that leaks
    // take identity has to be added here deliberately rather than arriving
    // by accident with a wider mapper.
    const side = API.slice(
      API.indexOf("export interface AbSide"),
      API.indexOf("export interface AbPair")
    );
    for (const leak of ["sessionId", "session_id", "takeIndex", "take_index",
                        "createdAt", "created_at"]) {
      expect(side).not.toContain(leak);
    }
    expect(side).toContain("transcript");
    expect(side).toContain("audioRef");
  });

  it("the sides are called A and B — never take 1 and take 2", () => {
    expect(UI).toMatch(/label="A"/);
    expect(UI).toMatch(/label="B"/);
    expect(UI).not.toMatch(/[Tt]ake 1|[Tt]ake 2|takeIndex|take_index/);
  });

  it("TOO CLOSE TO CALL is an answer, not a skip", () => {
    // A rater with no way to say "these are the same" invents a preference,
    // and an invented preference is indistinguishable from a real one in the
    // data. It rides the same judge() path as the other two — a "skip" that
    // recorded nothing would silently drop the most informative pairs.
    expect(UI).toMatch(/Too close to call/);
    expect(UI).toMatch(/judge\("tie"\)/);
    expect(UI).not.toMatch(/onClick=\{\(\) => setAt\(/);
  });

  it("the queue counts what is LEFT, never a position in a sequence", () => {
    // "3 of 30" is a cue about where in the arc you are, and this queue is
    // deliberately not chronological.
    expect(UI).toMatch(/left to judge/);
    expect(UI).not.toMatch(/\{at \+ 1\} of/);
  });

  it("no machine reading is shown to the rater", () => {
    // The coach IS the instrument here. Showing them a score would
    // contaminate the measurement it exists to anchor.
    expect(UI).not.toMatch(/power_score|powerScore|confidence|score/i);
    // …and the file's own prose may explain WHY without tripping it: the
    // scan above reads code, not comments.
    expect(UI_RAW).toMatch(/power_score/);
  });

  it("both routes relay through the shared proxy and add nothing", () => {
    for (const route of [PAIRS_ROUTE, VERDICT_ROUTE]) {
      expect(route).toMatch(/callBackend\(/);
      expect(route).not.toMatch(/await fetch\(/);
    }
    // The verdict body is relayed verbatim: the BE resolves the blinded side
    // to a real session, so "which take did I just pick" exists nowhere on
    // this side of the wire.
    expect(VERDICT_ROUTE).toMatch(/body \|\| "\{\}"/);
    expect(VERDICT_ROUTE).not.toMatch(/JSON\.parse/);
  });

  it("the screen is coach-gated, like the corpus workbench", () => {
    expect(UI).toMatch(/if \(!isCoach\)/);
    expect(UI).toMatch(/Nothing here\./);
  });
});
