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
const GESTURES = readFileSync(
  "src/components/willab/useRecordingGestures.ts",
  "utf8"
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
    expect(ROADMAP).toMatch(/relative min-h-0 flex-1/);
  });

  it("draws no line above the strip (founder lock 2026-10-07)", () => {
    const dock = PHASE.slice(PHASE.indexOf('data-testid="recording-strip"'));
    const cls = dock.slice(0, dock.indexOf("{strip}"));
    expect(cls).toMatch(/relative z-10 -mx-1 shrink-0 bg-background/);
    expect(cls).not.toMatch(/border-t|border-b|divide-/);
  });

  it("keeps the slide visible above one native root scroller", () => {
    expect(ROADMAP).toMatch(/h-full overflow-y-auto overscroll-contain/);
    expect(ROADMAP).toMatch(/<SlideStage/);
    expect(ROADMAP).toMatch(/currentRoots\.map/);
    expect(ROADMAP).toMatch(/aria-current=\{currentSlide === index/);
    expect(ROADMAP).toMatch(/onClick=\{\(\) => goToSlide\(index\)\}/);
    expect(ROADMAP).toMatch(/useRecordingGestures\(/);
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

  it("draws the slide's OWN words when there is no PDF and no artwork", () => {
    // Only the built-in deck carries artworkSrc, so a speaker's real slides —
    // extracted from their deck or typed in setup — used to fall through every
    // branch into "Slide preview unavailable" while their title and body sat
    // unused in props. Per-slide transcription buckets words against the slide
    // ON SCREEN, so a speaker who cannot see their slide cannot drive that
    // boundary; this is an F1 surface, not decoration.
    expect(SLIDE_RENDER).toContain("function SlideTextCard");
    expect(SLIDE_RENDER).toMatch(
      /!presentationRef && \(title\.trim\(\) \|\| body\.trim\(\)\)/
    );
    expect(SLIDE_RENDER).toContain("<SlideTextCard title={title} body={body} />");
  });

  it("keeps the text card structurally unable to render a transcript", () => {
    // The rule above ("never substitute transcribed text") is enforced by
    // CONSTRUCTION rather than by comment: the card's whole prop surface is the
    // slide's own two fields, so there is no channel through which spoken words
    // could reach it. Widening this signature is what would need arguing for.
    expect(SLIDE_RENDER).toMatch(
      /function SlideTextCard\(\{ title, body \}: \{ title: string; body: string \}\)/
    );
  });

  it("moves only the slide and its helper words (founder lock 2026-10-07)", () => {
    // The roadmap hands the gesture hook exactly two moving elements: the
    // slide box and the helper words' scroller. The rail sits beside them,
    // outside what moves; the strip and the top bar are not in this file.
    expect(ROADMAP).toMatch(
      /\[slideBoxRef\.current, scrollRef\.current\]\.filter/
    );
    expect(ROADMAP).not.toMatch(/snap-y|snap-proximity|clampingRef/);
    expect(ROADMAP).not.toMatch(/onTouchStart|onTouchMove|onKeyDown/);
    // The helper words take the wheel first; the swap is flushed so the
    // landing animates the new slide, not the old one.
    expect(GESTURES).toMatch(/scroller\.scrollTop \+= deltaY/);
    expect(GESTURES).toMatch(/flushSync\(swap\)/);
  });

  it("puts Take · Slide in the top bar, with no Recording label (founder lock 2026-10-07)", () => {
    expect(LAB).not.toMatch(/"Recording" : ""/);
    expect(LAB).toMatch(
      /<header className="flex h-12 shrink-0 items-center justify-between px-4">\s*\{\/\*[\s\S]*?\*\/\}\s*<RecordingWhere/
    );
    // The line lives in the header only: no second "Take · Slide" line
    // above the slide.
    const phaseBody = PHASE.slice(0, PHASE.indexOf("export function RecordingWhere"));
    expect(phaseBody).not.toMatch(/<RecordingWhere/);
    expect(LAB).not.toMatch(/\?\s*"Practice run"/);
  });

  it("keeps the retired golden-thread line absent", () => {
    expect(PHASE).not.toMatch(/goldenThread|GOLDEN_THREAD/);
    expect(STAGE).not.toMatch(/goldenThread|GOLDEN_THREAD/);
  });

  it("preloads exact committed roots before a continued Take starts", () => {
    expect(LAB).toMatch(/fetchRecordingRoots\(aid\)/);
    expect(LAB).toMatch(/state === "lab_prerecord"/);
    expect(LAB).toMatch(/attempt < 2/);
    expect(LAB).not.toMatch(/buildCommittedSlideRoots\(result\.pieces/);
  });

  it("drops no hover grow on Finish take and draws the 12px stop square", () => {
    const strip = PHASE.slice(
      PHASE.indexOf("const strip"),
      PHASE.indexOf("if (!hasDeck)")
    );
    expect(strip).not.toMatch(/hover:scale/);
    expect(strip).toMatch(/h-3 w-3 shrink-0 rounded-\[2px\] bg-current/);
  });

  it("animates the slide dots in 0.2 s with no hover colour", () => {
    const rail = ROADMAP.slice(ROADMAP.indexOf('aria-label="Presentation slide position"'));
    const dots = rail.slice(0, rail.indexOf("</nav>"));
    expect(dots.match(/transition-\[height\] duration-200/g)?.length).toBe(2);
    expect(dots).not.toMatch(/hover:/);
  });
});

describe("guest Project ownership at the processing boundary", () => {
  it("replaces an unprovable cached guest Project before uploading", () => {
    expect(LAB).toContain(
      "signedIn === false && projectId && !uploadGuestOwnerToken",
    );
    expect(LAB).toContain("clearExploreArc(null)");
    expect(LAB).toContain("recordedTakeRef.current = 1");
    expect(LAB).toContain("guestOwnerToken: uploadGuestOwnerToken");
  });
});
