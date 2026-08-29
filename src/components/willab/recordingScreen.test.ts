import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/* -------------------------------------------------------------------------- */
/*  THE RECORDING SCREEN                                                       */
/*                                                                            */
/*  A source scan, because this screen is difficult to open without a live mic.*/
/*  The non-cosmetic invariant is that every scroll-selected slide still       */
/*  reaches the overlay's canonical setter. Those changes are timestamped into */
/*  the timeline the backend uses for word-to-slide bucketing.                 */
/* -------------------------------------------------------------------------- */

const LAB = readFileSync("src/components/willab/LabOverlay.tsx", "utf8");
const STAGE = readFileSync("src/components/willab/SlideStage.tsx", "utf8");
const ROADMAP = readFileSync(
  "src/components/willab/RecordingRoadmap.tsx",
  "utf8"
);
const SLIDE_RENDER = readFileSync(
  "src/components/willab/pdfSlides.tsx",
  "utf8",
);
const SLIDE_TAKE = readFileSync(
  "src/components/willab/SlideTake.tsx",
  "utf8",
);
const LIBRARY = readFileSync(
  "src/components/willab/LibraryOverlay.tsx",
  "utf8",
);
const CSS = readFileSync("src/app/globals.css", "utf8");
const TW = readFileSync("tailwind.config.ts", "utf8");

const PHASE = LAB.slice(LAB.indexOf("export function RecordingPhase"));

describe("the recording screen", () => {
  it("keeps the recording token pair in both themes and Tailwind", () => {
    expect(CSS).toMatch(/--record:\s*[\d.]+ [\d.]+% [\d.]+%;/);
    expect(CSS).toMatch(/--record-foreground:/);
    expect(CSS.match(/--record:/g)?.length).toBe(2);
    expect(TW).toMatch(/record:\s*\{[\s\S]*?hsl\(var\(--record\)\)/);
    expect(TW).toMatch(/hsl\(var\(--record-foreground\)\)/);
  });

  it("keeps live capture distinct from destructive error styling", () => {
    expect(PHASE).toMatch(/bg-record/);
    expect(PHASE).toMatch(/text-record-foreground/);
    const strip = PHASE.slice(
      PHASE.indexOf("const strip"),
      PHASE.indexOf("if (!hasDeck)")
    );
    expect(strip).not.toMatch(/destructive/);
  });

  it("keeps the roadmap flexible and the recording strip pinned", () => {
    expect(PHASE).toMatch(/mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col/);
    expect(PHASE).toMatch(/pb-\[env\(safe-area-inset-bottom\)\]/);
    expect(PHASE).toMatch(/<RecordingRoadmap/);
    expect(PHASE).toMatch(/shrink-0 border-t/);
    expect(ROADMAP).toMatch(/relative min-h-0 flex-1/);
  });

  it("keeps the slide visible above one native root scroller", () => {
    expect(ROADMAP).toMatch(/h-full overflow-y-auto overscroll-contain/);
    expect(ROADMAP).toMatch(/<SlideStage/);
    expect(ROADMAP).toMatch(/currentRoots\.map/);
    expect(ROADMAP).toMatch(/aria-current=\{currentSlide === index/);
    expect(ROADMAP).toMatch(/onClick=\{\(\) => goToSlide\(index\)\}/);
    expect(ROADMAP).toMatch(/wheelGestureStep\(wheelGestureRef\.current/);
    expect(ROADMAP).not.toMatch(/max-h-\[26vh\]/);
  });

  it("has no separate slide-changing panel", () => {
    expect(PHASE).not.toMatch(/Previous slide|Next slide|Last slide/);
    expect(PHASE).not.toMatch(/ChevronLeft|ChevronRight/);
    expect(PHASE).toMatch(/onSlideChange=\{onSlideChange\}/);
  });

  it("keeps the recording strip to one compact row", () => {
    const strip = PHASE.slice(
      PHASE.indexOf("const strip"),
      PHASE.indexOf("if (!hasDeck)")
    );
    expect(strip).toMatch(/flex items-center gap-3 rounded-2xl bg-muted/);
    const order = [
      "animate-pulse",
      "tabular-nums",
      "flex-1 overflow-hidden",
      "Finish take",
    ];
    let at = -1;
    for (const token of order) {
      const next = strip.indexOf(token, at + 1);
      expect(next).toBeGreaterThan(at);
      at = next;
    }
    expect(strip).toMatch(/h-10 shrink-0/);
    expect(PHASE).not.toMatch(/h-20 w-20|text-\[40px\]/);
  });

  it("keeps the numberless duration bar", () => {
    const strip = PHASE.slice(
      PHASE.indexOf("const strip"),
      PHASE.indexOf("if (!hasDeck)")
    );
    expect(strip).toMatch(/aria-hidden/);
    expect(strip).not.toMatch(/%<|toFixed|Math\.round/);
  });

  it("uses one right-rail marker per slide", () => {
    expect(ROADMAP).toMatch(/aria-label="Presentation slide position"/);
    expect(ROADMAP).toMatch(/Go to slide \$\{index \+ 1\} of/);
    expect(ROADMAP).toMatch(/h-6 w-1\.5 rounded-full bg-foreground/);
    expect(STAGE).not.toMatch(/w-6 bg-primary|\{idx \+ 1\} \/ \{total\}/);
  });

  it("scroll-selected slides still timestamp the recording", () => {
    expect(ROADMAP).toMatch(/onSlideChangeRef\.current\(next\)/);
    expect(PHASE).toMatch(/onSlideChange=\{onSlideChange\}/);
    expect(LAB).toMatch(/function selectSlide\(index: number\)/);
    expect(LAB).toMatch(/slideAdvancesRef\.current\.push/);
  });

  it("renders the uploaded page or canonical default slide in one preview", () => {
    expect(STAGE).toMatch(/<SlideRender/);
    expect(STAGE).toMatch(/presentationRef=\{presentationRef\}/);
    expect(STAGE).toMatch(/showRetry=\{false\}/);
    expect(STAGE).toMatch(/fit/);
    expect(STAGE).not.toMatch(/<TextSlide/);
    expect(PHASE).toMatch(/presentationRef=\{presentationRef\}/);
    expect(ROADMAP).toMatch(/<SlideStage/);
    expect(ROADMAP).not.toMatch(/\{presentationRef \?/);
  });

  it("never substitutes transcribed text for a missing slide image", () => {
    expect(SLIDE_RENDER).not.toContain("function TextSlide");
    expect(SLIDE_RENDER).toContain("Slide preview unavailable");
    expect(SLIDE_TAKE).not.toContain("<TextSlide");
    expect(LIBRARY).not.toContain("<TextSlide");
  });

  it("uses native-feeling scroll rather than the prototype's delayed clamp", () => {
    expect(ROADMAP).not.toMatch(
      /clampingRef|setTimeout|320|snap-y|snap-proximity/
    );
    expect(ROADMAP).not.toMatch(/onTouchStart|onTouchMove/);
    expect(ROADMAP).toMatch(/scroller\.scrollTop \+= deltaY/);
    expect(ROADMAP).toMatch(/wheelGestureStep/);
    expect(ROADMAP).not.toMatch(/behavior: "smooth"/);
  });

  it("keeps the established Willab recording navbar", () => {
    expect(LAB).toMatch(/state === "lab_recording" \? "Recording" : ""/);
    expect(LAB).toMatch(
      /<header className="flex h-12 shrink-0 items-center justify-between px-4">/
    );
    expect(LAB).not.toMatch(/\?\s*"Practice run"/);
  });

  it("keeps the retired golden-thread line absent", () => {
    expect(PHASE).not.toMatch(/goldenThread|GOLDEN_THREAD/);
    expect(STAGE).not.toMatch(/goldenThread|GOLDEN_THREAD/);
  });
});
