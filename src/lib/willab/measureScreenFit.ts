import type { ScreenFit } from "@/lib/willab/deckScroll";

/* -------------------------------------------------------------------------- */
/*  measureScreenFit — read the deck's own type and box, so the screen split   */
/*  can follow what actually FITS (founder 2026-09-17).                        */
/*                                                                            */
/*  Everything here is measured rather than assumed, because every number is   */
/*  variable on this surface: the chunk type is `clamp()`d to the viewport,    */
/*  the line height is a ratio of it, the column width changes with the        */
/*  breakpoint, and the height left for words depends on whether the slide     */
/*  above them rendered at all. A constant would be right on one phone.        */
/*                                                                            */
/*  It lives outside the component for the reason chunkSteps.ts gives: vitest  */
/*  cannot transform .tsx imports, so a rule left inside a component is a rule */
/*  no unit test can reach. The PACKING is pure and lives in deckScroll; this  */
/*  is only the part that must touch the DOM.                                  */
/* -------------------------------------------------------------------------- */

/** One shared canvas — measuring text should not allocate per call. */
let scratch: CanvasRenderingContext2D | null | undefined;

function context(): CanvasRenderingContext2D | null {
  if (scratch !== undefined) return scratch;
  try {
    scratch = document.createElement("canvas").getContext("2d");
  } catch {
    scratch = null; // jsdom, a locked-down browser — callers degrade
  }
  return scratch;
}

/** Average rendered width of a character in `font`, from real text.
 *
 *  A lowercase-heavy sample rather than one letter: "m" would over-estimate
 *  and "i" would under-estimate by more than the packing can absorb. This is
 *  an approximation on purpose — see `estimatedChunkHeight` for why one line
 *  of slack is an acceptable price and laying the text out twice is not.
 */
const SAMPLE =
  "the quick brown fox jumps over the lazy dog and then it said something";

export function averageCharWidth(font: string): number | null {
  const ctx = context();
  if (!ctx || !font) return null;
  try {
    ctx.font = font;
    const width = ctx.measureText(SAMPLE).width;
    if (!(width > 0)) return null;
    return width / SAMPLE.length;
  } catch {
    return null;
  }
}

/** What one screen can hold, from the live deck. `null` when it cannot be
 *  measured yet — before layout, or in an environment with no canvas — and
 *  the caller then keeps the fixed-count split it always had.
 *
 *  `scroller` is the screen's chunk area (the box the words get). `sample` is
 *  any rendered chunk paragraph, read for the type actually in effect.
 */
export function measureScreenFit(
  scroller: HTMLElement | null,
  sample: HTMLElement | null,
): ScreenFit | null {
  if (!scroller || !sample) return null;
  const budgetPx = scroller.clientHeight;
  const width = sample.clientWidth || scroller.clientWidth;
  if (!(budgetPx > 0) || !(width > 0)) return null;

  const style = window.getComputedStyle(sample);
  const lineHeightPx = parseFloat(style.lineHeight);
  if (!(lineHeightPx > 0)) return null;

  const perChar = averageCharWidth(style.font || `${style.fontSize} ${style.fontFamily}`);
  if (!perChar || !(perChar > 0)) return null;

  // The gap between two chunks on one screen, read from the flex column that
  // holds them rather than hard-coded beside the class that sets it.
  const parent = sample.parentElement;
  const gapPx = parent ? parseFloat(window.getComputedStyle(parent).rowGap) : NaN;

  return {
    budgetPx,
    lineHeightPx,
    charsPerLine: Math.max(1, Math.floor((width / perChar) * WRAP_ALLOWANCE)),
    gapPx: Number.isFinite(gapPx) ? gapPx : 0,
  };
}

/** How much of a line real text actually uses.
 *
 *  MEASURED, NOT GUESSED (2026-09-17). Width over average character width is
 *  how many characters would fit if text could break anywhere. It cannot: it
 *  breaks between WORDS, so every line ends early by up to a word. On the
 *  deck at 390px that was ~44 characters predicted against ~40 rendered, and
 *  a paragraph split to "exactly one screen" came out a couple of lines too
 *  tall and scrolled — the very thing the split exists to remove, caught in
 *  Chromium rather than in a unit test, because no pure test can see a line
 *  break.
 *
 *  Deliberately pessimistic. Being short by a line costs a little white
 *  space at the bottom of a screen; being long by one puts words under the
 *  fold, which is the defect.
 */
const WRAP_ALLOWANCE = 0.84;

/** Has the fit changed enough to be worth repacking the deck?
 *
 *  THE LOOP GUARD, and the reason this is a named rule rather than an `!==`.
 *  Repacking changes the screens, which re-renders, which measures again — so
 *  a fit that jitters by a fraction of a pixel (a scrollbar appearing, a
 *  sub-pixel line height, iOS rounding the viewport as the URL bar slides)
 *  would repack forever. Only a change big enough to move a paragraph onto a
 *  different screen counts.
 */
export function fitChangedMeaningfully(
  previous: ScreenFit | null,
  next: ScreenFit,
): boolean {
  if (!previous) return true;
  return (
    Math.abs(previous.budgetPx - next.budgetPx) > next.lineHeightPx / 2 ||
    Math.abs(previous.lineHeightPx - next.lineHeightPx) > 1 ||
    Math.abs(previous.charsPerLine - next.charsPerLine) > 2 ||
    Math.abs(previous.gapPx - next.gapPx) > 1
  );
}
