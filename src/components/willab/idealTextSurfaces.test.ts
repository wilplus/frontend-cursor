import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (name: string) =>
  readFileSync(join(process.cwd(), "src", "components", "willab", name), "utf8");

describe("Ideal Text core-first screen contract", () => {
  for (const file of ["IdealTextOverlay.tsx", "IdealTextReadout.tsx"]) {
    it(`${file} paints core before requesting enrichment`, () => {
      const code = source(file);
      expect(code).toContain("fetchIdealTextCore");
      expect(code).toContain("fetchIdealTextEnrichment");
      // The PROPERTY, not one spelling of it: the core is on screen before
      // any enrichment request is made. Since 2026-09-22 a first open asks
      // in two lanes at once, so the call is inside a `Promise.all` and the
      // `await` no longer sits against the function name.
      expect(code.indexOf("applySingle(r, true)")).toBeLessThan(
        code.indexOf("fetchIdealTextEnrichment("),
      );
      expect(code).toContain("mergeIdealTextEnrichment");
    });
  }

  it("the processing settle probe uses the strict core read", () => {
    const code = source("useDocumentSettle.ts");
    expect(code).toContain("fetchIdealTextCore");
    expect(code).not.toContain("fetchIdealText(");
  });
});


describe("the loop never waits for a coach", () => {
  /** Source with comments stripped: this screen explains at length why the
   *  dead end was one, and a fence that asserts absence must read code. */
  const code = (name: string) =>
    source(name)
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/\/\/[^\n]*/g, " ");

  it("offers a way to record while the ideal text is unapproved", () => {
    // Tapping Record on a project whose ideal text is not yet approved landed
    // here, and it rendered one sentence and NOTHING else. The user had asked
    // to record and could not, until a human acted — the live-loop fence, not
    // a rough edge.
    const screen = code("IdealTextPendingCoach.tsx");
    expect(screen).toContain("still shaping your ideal text");
    expect(screen).toContain("onReadAloud(null)");
    expect(screen).toContain("Record the next take");
    // And the overlay actually mounts it on that branch.
    expect(code("IdealTextOverlay.tsx")).toContain(
      "<IdealTextPendingCoach onReadAloud={onReadAloud} />",
    );
  });

  it("uses the SAME callback the ready state uses, not a second lane", () => {
    // onReadAloud is what IdealTextActions calls on the ready screen, so a
    // take started from the pending screen goes through the identical
    // submission path. A separate entry point here could drift from it.
    expect(code("IdealTextOverlay.tsx")).toContain(
      "onNewTake={() => onReadAloud(sd.version)}",
    );
    expect(code("IdealTextPendingCoach.tsx")).toContain(
      "onClick={() => onReadAloud(null)}",
    );
  });

  it("does not touch the pending document or surface coach state", () => {
    const screen = code("IdealTextPendingCoach.tsx");
    // L1: the coach's unapproved document is not read, rebuilt or edited here.
    expect(screen).not.toContain("setDraft");
    expect(screen).not.toContain("onLockIn");
    // BLIND COACH: the screen takes ONE prop and it is the way out. It cannot
    // surface a verdict, a guess or a review state because it is never handed
    // one. (Asserting the word "approved" is absent would be wrong — the
    // signed-off sentence itself says "the moment it's approved".)
    expect(screen).not.toContain("reviewStatus");
    expect(screen).toMatch(/\}: \{\s*onReadAloud\?: \(version: number \| null\) => void;\s*\}/);
  });
});

describe("a chunk decision changes its own paragraph, never the document", () => {
  /* FOUNDER 2026-09-17, locked: "you open the feedback clicking on the
     bookmark, then you edit that chunk of the text the bookmark was referring
     to, and then you simply close the overlay and come back to the SAME ideal
     text, with the slide — the only change being that this bookmarked chunk is
     updated as per what was agreed. That's it!"

     Re-reading the whole document is what breaks that: the server recomposes
     on the read, and when it cannot re-prove the paragraphs' slides the deck
     comes back as the unlinked "YOUR TALK" view with no slides at all.

     THIS TEST EXISTS BECAUSE THE RULE WAS LANDED ONCE AND MISSED TWO OF ITS
     FOUR PATHS. `deckLockPart`'s edited branch and `deckSetRootPhrase` were
     fixed; `lockParagraph` (a lock with NO edit — the ordinary case) and
     `unlockParagraph` were not, so the very next lock replaced the page again.
     A per-handler assertion is the only shape that catches the one that was
     forgotten. */
  const handlers = [
    // name of the handler, and the success projection that replaces its refetch
    ["lockParagraph", "lockedParts"],
    ["unlockParagraph", "unlockedParts"],
    ["deckLockPart", "lockedParts"],
    ["deckKeepEvolving", "evolvingParts"],
    ["deckSetRootPhrase", "nextParts"],
  ] as const;

  const code = source("IdealTextOverlay.tsx");
  /** The body of one handler, up to the start of the next `const x = useCallback`. */
  function body(name: string): string {
    const head = `const ${name} = useCallback`;
    const at = code.indexOf(head);
    expect(at, `${name} not found`).toBeGreaterThan(-1);
    // Search for the NEXT handler strictly after this one's own declaration —
    // `at + 20` lands inside it for a short name and returned an empty body,
    // which passed nothing and proved nothing.
    const next = code.indexOf("= useCallback", at + head.length);
    return code.slice(at, next < 0 ? code.length : next);
  }

  for (const [name, projection] of handlers) {
    it(`${name} projects the confirmed change instead of re-reading`, () => {
      const src = body(name);
      // It projects into the rendered document...
      expect(src).toMatch(new RegExp(`setSd\\([\\s\\S]*${projection}`));
      // ...and every refetch left in it is guarded on a genuine desync.
      for (const line of src.split("\n")) {
        if (!line.includes("setRefetchNonce")) continue;
        expect(
          line.includes('"stale"') || src.includes('kind === "stale"'),
          `${name}: an unguarded refetch on success — ${line.trim()}`,
        ).toBe(true);
      }
    });
  }

  it("the success path of a lock carries NO refetch at all", () => {
    // The precise regression: `setRefetchNonce` sitting after the parts
    // projection, on the ok path, with nothing stale about it.
    for (const name of ["lockParagraph", "unlockParagraph"]) {
      const src = body(name);
      const afterProjection = src.slice(src.indexOf("setSd("));
      expect(afterProjection, name).not.toContain("setRefetchNonce");
    }
  });
});

/* ── THE PENDING BADGE IS GONE (founder 2026-09-22) ────────────────────────
 * "please remove that pending from here and from the ideal text bubble; make
 * it hidden, only when it gets verified display it in both places."
 *
 * Both surfaces used to render the state unconditionally, so the test is
 * written against the thing that would bring it back: a render of the pending
 * wording, on either. */
describe("only a reviewed text wears a badge", () => {
  const HEADING = source("IdealTextHeading.tsx");
  const CARD = source("ReportCard.tsx");

  it("neither surface renders the pending wording any more", () => {
    for (const src of [HEADING, CARD]) {
      expect(src).not.toMatch(/PENDING_SHORT|PENDING_VERIFICATION/);
    }
  });

  it("both still render the reviewed one, gated on verified", () => {
    expect(HEADING).toMatch(/status === "verified" \? \(/);
    expect(HEADING).toMatch(/\{REVIEWED\}/);
    expect(CARD).toMatch(/\{verified \? \(/);
    expect(CARD).toMatch(/\{REVIEWED\}/);
  });

  it("the card leaves no empty spacer where the pill was", () => {
    // `mt-4` used to sit on a wrapper that always rendered; an unverified card
    // would keep a 16px gap under it reserved for nothing.
    const pill = CARD.slice(CARD.indexOf("Reviewed pill only"), CARD.indexOf("CTA —"));
    expect(pill).toMatch(/\{verified \? \(\s*<div className="mt-4">/);
  });
});

