import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/* -------------------------------------------------------------------------- */
/*  THE RECORDING SCREEN (founder respec 2026-08-11, six numbered points +      */
/*  three screenshots).                                                        */
/*                                                                            */
/*  A source scan, because this screen is the hardest one in the product to     */
/*  open: it needs a live mic and a submitted setup form, so nothing could      */
/*  render it in a test — which is exactly how it drifted into a four-storey   */
/*  tower that pushed the slide off the top of a phone. (There is a harness at  */
/*  /dev/recording now; these assertions are the parts a screenshot can't       */
/*  prove, like which callback a button carries.)                              */
/*                                                                            */
/*  THE ONE THAT IS NOT COSMETIC: every slide control still calls `onAdvance`.  */
/*  Those taps are timestamped into the slide timeline the backend buckets      */
/*  words against — the F1 word→slide 1:1. A relayout that dropped one would    */
/*  look perfect and quietly stop teaching the pipeline where the slides       */
/*  changed.                                                                   */
/* -------------------------------------------------------------------------- */

const LAB = readFileSync("src/components/willab/LabOverlay.tsx", "utf8");
const STAGE = readFileSync("src/components/willab/SlideStage.tsx", "utf8");
const CSS = readFileSync("src/app/globals.css", "utf8");
const TW = readFileSync("tailwind.config.ts", "utf8");

/** The RecordingPhase body — assertions about "the recording screen" must not
 *  accidentally pass on some other phase in the same file. */
const PHASE = LAB.slice(LAB.indexOf("export function RecordingPhase"));

describe("the recording screen (founder respec 2026-08-11)", () => {
  it("§1 — the record signal is a TOKEN PAIR, in both themes, wired to Tailwind", () => {
    expect(CSS).toMatch(/--record:\s*[\d.]+ [\d.]+% [\d.]+%;/);
    expect(CSS).toMatch(/--record-foreground:/);
    // Two definitions: :root and .dark. A signal defined once goes invisible
    // on the theme nobody checked.
    expect(CSS.match(/--record:/g)?.length).toBe(2);
    expect(TW).toMatch(/record:\s*\{[\s\S]*?hsl\(var\(--record\)\)/);
    expect(TW).toMatch(/hsl\(var\(--record-foreground\)\)/);
  });

  it("§1 — the live-capture UI stops borrowing --destructive", () => {
    // destructive means ERROR. Recording is not one, and neither is running
    // past your target ("the red is only a nudge").
    expect(PHASE).toMatch(/bg-record/);
    expect(PHASE).toMatch(/text-record-foreground/);
    const strip = PHASE.slice(PHASE.indexOf("const strip"), PHASE.indexOf("if (!hasDeck)"));
    expect(strip).not.toMatch(/destructive/);
  });

  it("§2 — the column is capped and the dock is pinned above the safe area", () => {
    expect(PHASE).toMatch(/mx-auto flex w-full max-w-md flex-1 flex-col/);
    expect(PHASE).toMatch(/pb-\[env\(safe-area-inset-bottom\)\]/);
    // The slide takes the space that is going spare — that is what keeps the
    // dock at the bottom instead of floating under a short slide.
    expect(PHASE).toMatch(/<div className="flex flex-1 flex-col">\s*<SlideStage/);
  });

  it("§3 — Next is a 56px full-width pill; Back is a 56px circle beside it", () => {
    expect(PHASE).toMatch(/h-14 flex-1[^"]*rounded-full bg-primary/);
    expect(PHASE).toMatch(/h-14 w-14 shrink-0[^"]*rounded-full border/);
    expect(PHASE).toMatch(/<ChevronRight/);
    expect(PHASE).toMatch(/<ChevronLeft/);
    // The old pair: two equal-weight pills under the slide, both with labels.
    expect(STAGE).not.toMatch(/ChevronLeft|ChevronRight/);
    expect(STAGE).not.toMatch(/flex-1 items-center justify-center gap-2 rounded-full bg-muted/);
  });

  it("§4 — the recording strip is ONE row, and the tower is gone", () => {
    const strip = PHASE.slice(PHASE.indexOf("const strip"), PHASE.indexOf("if (!hasDeck)"));
    expect(strip).toMatch(/flex items-center gap-3 rounded-2xl bg-muted/);
    // dot → clock → bar → finish, in that order, inside the one row.
    const order = ["animate-pulse", "tabular-nums", "flex-1 overflow-hidden", "Finish take"];
    let at = -1;
    for (const token of order) {
      const next = strip.indexOf(token, at + 1);
      expect(next).toBeGreaterThan(at);
      at = next;
    }
    expect(strip).toMatch(/h-10 shrink-0/); // the 40px finish control
    expect(PHASE).not.toMatch(/h-20 w-20/); // …not the old 80px one
    expect(PHASE).not.toMatch(/>Recording</); // the word the dot replaced
    expect(PHASE).not.toMatch(/text-\[40px\]/); // the old clock
  });

  it("§4 — the progress bar still carries no number (AC-9)", () => {
    const strip = PHASE.slice(PHASE.indexOf("const strip"), PHASE.indexOf("if (!hasDeck)"));
    expect(strip).toMatch(/aria-hidden/);
    expect(strip).not.toMatch(/%<|toFixed|Math\.round/);
  });

  it("§5 — progress is DOTS plus a count, not a sentence", () => {
    expect(STAGE).toMatch(/w-6 bg-primary/); // the active dot widens
    expect(STAGE).toMatch(/\{idx \+ 1\} \/ \{total\}/);
    expect(STAGE).not.toMatch(/Slide \{idx \+ 1\} of \{total\}/);
  });

  it("§6 — the golden-thread line is gone from both components", () => {
    expect(PHASE).not.toMatch(/goldenThread|GOLDEN_THREAD/);
    expect(STAGE).not.toMatch(/goldenThread|GOLDEN_THREAD/);
  });

  it("THE WIRING: every slide control still reports to onAdvance", () => {
    // The tap timeline is the word→slide bucketing input. Three controls —
    // the slide itself (clicker feel), Back, Next — and all three must land
    // on the same callback the parent timestamps.
    expect(STAGE).toMatch(/onClick=\{onNext\}/);
    expect(PHASE).toMatch(/onNext=\{\(\) => onAdvance\(1\)\}/);
    expect(PHASE).toMatch(/onClick=\{\(\) => onAdvance\(-1\)\}/);
    expect(PHASE).toMatch(/onClick=\{\(\) => onAdvance\(1\)\}/);
  });

  it("THE SLIDE IS THE SLIDE: an uploaded deck renders its own page here", () => {
    // The founder's line: "in the place where there is a text should be the
    // slide; when slides are uploaded by the user". SlideRender draws the
    // deck's PDF page whenever presentationRef is set and only falls back to
    // the text card without one — so this slot must stay SlideRender, never
    // a hardcoded text card.
    expect(STAGE).toMatch(/<SlideRender/);
    expect(STAGE).toMatch(/presentationRef=\{presentationRef\}/);
    expect(STAGE).not.toMatch(/<TextSlide/);
    expect(PHASE).toMatch(/presentationRef=\{presentationRef\}/);
  });

  it("the screen names itself RECORDING, and only this screen does", () => {
    // Founder 2026-08-11: "Let's drop 'Practice run' … to match our
    // philosophy that every take matters." The word is the philosophy, so
    // it is pinned, not left to whoever next tidies a header.
    expect(LAB).toMatch(/state === "lab_recording" \? "Recording" : ""/);
    // What RENDERS, not the vocabulary: the comment beside that line records
    // which word was retired and why, and that record is worth keeping.
    expect(LAB).not.toMatch(/\?\s*"Practice run"/);
  });
});
