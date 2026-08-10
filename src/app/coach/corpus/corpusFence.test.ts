import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
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

/** Any quoted path naming the corpus lane — shape-agnostic on purpose, so it
 *  catches `import`, `import type`, dynamic `import()` and `require` alike. */
const CORPUS_IMPORT = /["'][^"'\n]*trainingCorpus["']/;
/** Any link or navigation to the workbench route. */
const CORPUS_LINK = /["'`][^"'`\n]*\/coach\/corpus/;

/** The lanes that carry a machine read of confidence. The corpus service and
 *  its screen must not import them — not for types, not for a helper. */
const MACHINE_READ_LANES = [
  "starVerdicts", // the machine's fired stars + their why
  "readout", // powerScore lives here
  "coachReview", // AcousticRead — the stress↔charisma needle
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry))
      out.push(full);
  }
  return out;
}

const isCorpusOwned = (rel: string) =>
  rel === SERVICE || rel.startsWith(join("app", "coach", "corpus") + sep);

/** Dev fixtures under app/dev — exempt from the link fence ONLY because the
 *  test below asserts every one of them renders nothing in production. The
 *  fence is about what a USER can reach, and a production-gated fixture is
 *  reachable by nobody. (Same bargain the Life Panel and star-verdict fences
 *  strike.) */
const isDevFixture = (rel: string) =>
  rel.startsWith(join("app", "dev") + sep);

describe("training corpus fences", () => {
  it("N4 — only the shared menu links to the workbench, and only for a coach", () => {
    const linkers: string[] = [];
    for (const file of walk(SRC)) {
      const rel = relative(SRC, file);
      if (isCorpusOwned(rel) || isDevFixture(rel)) continue;
      if (CORPUS_LINK.test(readFileSync(file, "utf8"))) linkers.push(rel);
    }
    // ONLY the two header mounts and the coach's Lab panel name the route;
    // AppMenu takes it as a prop and so never contains the path itself. A new
    // name in this list is a new way in — check it is coach-gated before
    // adding it.
    //
    // The Lab panel (SPEC-lockin-loop §5, founder 2026-08-10): the training
    // corpus is "a separate view in the same design language", reachable from
    // the Lab's head. The panel is coach-only twice over — the BE enforces
    // require_admin_or_coach on its data, and it mounts only from the coach's
    // student-detail flow — so the link adds no user-reachable way in.
    expect(linkers.sort()).toEqual(
      [
        join("components", "SiteHeader.tsx"),
        join("components", "dashboard", "DashboardHeader.tsx"),
        join("components", "willab", "CoachStarVerdictOverlay.tsx"),
      ].sort()
    );
  });

  it("N4 — every link site gates the row on isCoach", () => {
    for (const rel of [
      join("components", "SiteHeader.tsx"),
      join("components", "dashboard", "DashboardHeader.tsx"),
    ]) {
      const src = readFileSync(join(SRC, rel), "utf8");
      expect(
        /corpusHref=\{[^}]*isCoach[^}]*\}/.test(src),
        `${rel} links the corpus without gating on isCoach`
      ).toBe(true);
    }
    // AppMenu renders the row only when the host passed an href, so a
    // non-coach host cannot produce one.
    const menu = readFileSync(join(SRC, "components", "AppMenu.tsx"), "utf8");
    expect(menu).toMatch(/signedIn && corpusHref \?/);
  });

  it("N4 — every dev fixture reaching the corpus renders nothing in production", () => {
    const fixtures = walk(SRC)
      .map((f) => relative(SRC, f))
      .filter(isDevFixture)
      .filter((rel) => {
        const src = readFileSync(join(SRC, rel), "utf8");
        return CORPUS_IMPORT.test(src) || CORPUS_LINK.test(src);
      });
    // The exemption above and this gate are the same decision.
    expect(fixtures.length).toBeGreaterThan(0);
    for (const rel of fixtures) {
      expect(
        /process\.env\.NODE_ENV\s*===\s*["']production["'][\s\S]{0,40}return null/.test(
          readFileSync(join(SRC, rel), "utf8")
        ),
        `${rel} reaches the corpus but is not gated out of production`
      ).toBe(true);
    }
  });

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
          `${rel} imports ${lane} — the labelling screen must stay blind to the machine's read (N1)`
        ).toBe(false);
      }
    }
  });

  it("N1 — no band or score vocabulary reaches the labelling screen", () => {
    const client = readFileSync(join(SRC, CLIENT), "utf8");
    // Comments explaining the fence are fine; rendered JSX text is not. Strip
    // block comments, then look for the words in what is left.
    const code = client.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    for (const word of ["band", "power_score", "powerScore", "confidence_score"]) {
      expect(
        code.includes(word),
        `"${word}" appears in the labelling screen's code — N1 forbids surfacing the machine's read`
      ).toBe(false);
    }
  });

  it("N5/FE-4 — the normal user's upload path carries no stage vocabulary", () => {
    // Stages are a coach-only tick. If they ever appear on the user's record
    // or upload flow, a half-analysed take becomes a broken deliverable.
    for (const rel of [
      join("services", "api", "labRecording.ts"),
      join("services", "api", "chatQuery.ts"),
    ]) {
      const full = join(SRC, rel);
      let src: string;
      try {
        src = readFileSync(full, "utf8");
      } catch {
        continue; // renamed — the corpus fence is not the place to fail on that
      }
      expect(
        /"stages"|'stages'|\bstages:/.test(src),
        `${rel} mentions stages — the user's upload path must stay untouched (FE-4)`
      ).toBe(false);
    }
  });

  it("the paths this fence guards still exist (a rename must update the fence, not evade it)", () => {
    for (const rel of [SERVICE, CLIENT, PAGE]) {
      expect(statSync(join(SRC, rel)).isFile()).toBe(true);
    }
  });
});
