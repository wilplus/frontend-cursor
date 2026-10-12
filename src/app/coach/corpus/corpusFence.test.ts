import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/* -------------------------------------------------------------------------- */
/*  FENCE TEST — N1 and N4 for the training corpus, in code                    */
/*                                                                            */
/*  Two rules this surface cannot be allowed to drift out of:                  */
/*                                                                            */
/*  N4 — COACH ONLY. No user-reachable entry point. The workbench is a route,  */
/*    which means anyone can TYPE its URL, so the guard has to be that no      */
/*    user-lane file links to it and that the page itself refuses a non-coach. */
/*                                                                            */
/*  N1 — BLIND COACH. The labelling screen must never show a machine           */
/*    confidence read. The queue payload omits it; the danger is a future      */
/*    edit deriving one (from the star lane, from readout's power_score) and   */
/*    rendering it "just as a hint". The corpus goes circular the moment it    */
/*    does, so the service and the screen may not import those lanes at all.   */
/*                                                                            */
/*  Intent does not survive refactors; an import graph does. Same discipline   */
/*  as the Life Panel and star-verdict fences. Red here = no merge.            */
/* -------------------------------------------------------------------------- */

const SRC = join(fileURLToPath(new URL("../../../", import.meta.url)));

const SERVICE = join("services", "api", "trainingCorpus.ts");
const CLIENT = join("app", "coach", "corpus", "page.client.tsx");
const PAGE = join("app", "coach", "corpus", "page.tsx");

/** The lanes that carry a machine read of confidence. The corpus service and
 *  its screen must not import them — not for types, not for a helper. */
const MACHINE_READ_LANES = [
  "readout", // powerScore lives here
  "coachReview", // coach-review mapper must stay out of blind corpus tools
];

describe("training corpus fences", () => {

  it("N4 — the page itself refuses a non-coach who types the URL", () => {
    const client = readFileSync(join(SRC, CLIENT), "utf8");
    expect(client).toMatch(/if \(!isCoach\)/);
    // And the route requires a session server-side before it even renders.
    expect(readFileSync(join(SRC, PAGE), "utf8")).toMatch(/redirect\(/);
  });

  it("N1 — the corpus lane imports nothing that carries a machine confidence read", () => {
    for (const rel of [SERVICE, CLIENT]) {
      const src = readFileSync(join(SRC, rel), "utf8");
      for (const lane of MACHINE_READ_LANES) {
        expect(
          new RegExp(`["'][^"'\\n]*${lane}["']`).test(src),
          `${rel} imports ${lane} — the labelling screen must stay blind to the machine's read (N1)`,
        ).toBe(false);
      }
    }
  });

  it("N1 — no band or score vocabulary reaches the labelling screen", () => {
    const client = readFileSync(join(SRC, CLIENT), "utf8");
    // Comments explaining the fence are fine; rendered JSX text is not. Strip
    // block comments, then look for the words in what is left.
    const code = client
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    for (const word of [
      "band",
      "power_score",
      "powerScore",
      "confidence_score",
    ]) {
      expect(
        code.includes(word),
        `"${word}" appears in the labelling screen's code — N1 forbids surfacing the machine's read`,
      ).toBe(false);
    }
  });
});
