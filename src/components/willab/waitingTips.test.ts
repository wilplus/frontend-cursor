import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { WAITING_TIPS, pickWaitingTip } from "./waitingTips";

describe("waitingTips", () => {
  it("always returns one of the approved tips", () => {
    for (let i = 0; i < 50; i++) {
      expect(WAITING_TIPS).toContain(pickWaitingTip());
    }
  });

  it("can return more than one distinct tip across sessions", () => {
    // One tip per waiting session, but not the SAME one every session.
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(pickWaitingTip());
    expect(seen.size).toBeGreaterThan(1);
  });

  it("carries no em-dashes (product copy rule)", () => {
    for (const tip of WAITING_TIPS) expect(tip).not.toContain("—");
  });

  it("keeps every tip short enough to read during a wait", () => {
    for (const tip of WAITING_TIPS) expect(tip.length).toBeLessThan(200);
  });
});

/* -------------------------------------------------------------------------- */
/*  ONE WAITING SCREEN, AND NOTHING ON IT (founder 2026-08-12: "that surface   */
/*  is not necessary; it is the old button surfacing — please clear it so that */
/*  there is only one waiting screen without anything like that").             */
/*                                                                            */
/*  This screen keeps growing things back. It has already been a second        */
/*  "Working on your text" variant (deleted), and then a "Record the next      */
/*  take" button (deleted here). Both were added to route around the SAME      */
/*  underlying defect — the stale mic that bounced every re-entry into         */
/*  lab_recording back onto the waiting screen. That is fixed at the source    */
/*  now, so an extra door beside the working one is just the old surface       */
/*  showing through.                                                          */
/* -------------------------------------------------------------------------- */

/** Source with comments stripped — the file explains at length which
 *  treatments were retired, and scanning raw text would fail on the record of
 *  the decision rather than on a breach of it. */
function code(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

describe("the waiting screen carries nothing but the wait", () => {
  const READOUT = code("src/components/willab/IdealTextReadout.tsx");
  /** The `analysisPending` early return — assertions about "the waiting
   *  screen" must not accidentally pass on the normal readout below it,
   *  which legitimately carries the record affordance. */
  const BLOCK = READOUT.slice(
    READOUT.indexOf("if (analysisPending) {"),
    READOUT.indexOf("if (analysisPending) {") +
      READOUT.slice(READOUT.indexOf("if (analysisPending) {")).indexOf("\n  }\n")
  );

  it("shows ProcessingWait and no second affordance", () => {
    expect(BLOCK).toMatch(/<ProcessingWait\b/);
    expect(BLOCK).not.toMatch(/Record the next take/);
    expect(BLOCK).not.toMatch(/onReRead/);
    expect(BLOCK).not.toMatch(/<Mic/);
  });

  it("keeps the way OUT — the block is on the text, not on leaving", () => {
    // SPEC-lockin-loop §1: while the document assembles the old text is
    // inaccessible, "no browse-with-banner". Closing was never part of that.
    expect(BLOCK).toMatch(/OverlayCloseButton/);
  });

  it("the record affordance still exists on the READOUT itself", () => {
    // Removing it from the wait must not remove it from the screen that is
    // supposed to have it — otherwise the next take has no door at all. The
    // readout does not own the label: it hands `onReRead` to IdealTextActions
    // (which carries the founder's "Record the next take"), and falls back to
    // its own small mic when there is no master-document payload.
    expect(READOUT).toMatch(/onNewTake=\{onReRead\}/);
    expect(code("src/components/willab/IdealTextActions.tsx"))
      .toMatch(/Record the next take/);
  });
});
