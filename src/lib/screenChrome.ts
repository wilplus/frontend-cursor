/* -------------------------------------------------------------------------- */
/*  screenChrome — the spacing a full-screen view shares (founder 2026-07-30)   */
/*                                                                            */
/*  THE HEIGHT MODEL THIS ASSUMES. `app/layout.tsx` owns a viewport-locked      */
/*  column: `body` is `h-[100dvh] flex flex-col`, the page renders into a       */
/*  `flex-1 overflow-y-auto` slot, and the site Footer is pinned below it.      */
/*  So a page's screen is NOT 100dvh — it is 100dvh MINUS the footer. A page    */
/*  that sizes itself to the viewport is therefore taller than the space it     */
/*  was given, every time, by exactly the footer's height, and the bottom of    */
/*  it sits under the fold. Fill the SLOT (`h-full` / `min-h-full`), never the  */
/*  document.                                                                  */
/*                                                                            */
/*  The exception is a fixed overlay (`fixed inset-0`, as the Lab is): it       */
/*  covers the footer deliberately, so its screen really is the viewport.      */
/* -------------------------------------------------------------------------- */

/** The gap under a screen's primary action row.
 *
 *  One value, shared, because the founder asked for these screens to feel like
 *  one product: the voice-game ended 20px off the bottom, the recording setup
 *  24px, the panel's setup 32px — three numbers nobody chose, close enough to
 *  look like a mistake rather than a rhythm. 32px is the largest of the three,
 *  so unifying LIFTS the two tight ones rather than dropping anything: a
 *  button pressed against the bottom edge reads as the screen having run out,
 *  and there is empty space above it in every one of these views.
 *
 *  A constant rather than the class typed three times — a copy is how the
 *  three drifted apart in the first place. `src/lib/**` is in the Tailwind
 *  content globs, so the literal is scanned from here. */
export const SCREEN_BOTTOM_GAP = "pb-8";
