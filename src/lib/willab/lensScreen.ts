/* -------------------------------------------------------------------------- */
/*  THE LENS SCREEN'S ONE QUESTION (founder 2026-10-14, "it is not directly    */
/*  tap and open"): while the walk is on its way the lens screen shows the     */
/*  app's loader and nothing else. The founder tapped after a Take and sat on  */
/*  that loader. Two things had gone wrong, and they are the two rules here.   */
/*                                                                            */
/*  1. The screen only ever came down on a fixed eight-second watchdog, even   */
/*     when the page already knew there was nothing to walk — the marks had   */
/*     answered empty, or every step was answered before the tap. The page    */
/*     knows that the moment its feedback settles; it says so here, and the   */
/*     text appears then, not eight seconds later.                            */
/*  2. The watchdog looked for the walk's ROOT, which the deck renders with    */
/*     the text whether or not a step is on screen, so it never fired at all. */
/*     A step on screen is a live walk layer (`WALK_STEP_SELECTOR`).          */
/*                                                                            */
/*  Pure, so the rule can be stated in a test; the overlay asks it.           */
/* -------------------------------------------------------------------------- */

/** After the page settles with nothing to walk, how long the lens waits for
 *  a step that may still be opening before it shows the text. One paint. */
export const LENS_IDLE_MS = 300;

/** The last resort: a lens with no walk and no settle by now shows the text.
 *  Past anything the page should take to say so itself. */
export const LENS_WATCHDOG_MS = 8_000;

/** A walk step actually on screen: a live layer of the walk, never its idle
 *  root (which the deck mounts with the text) and never a layer leaving. */
export const WALK_STEP_SELECTOR =
  "[data-feedback-walk] .walk-layer:not(.walk-ghost)";

export interface LensPage {
  /** The Ideal Text page's own load state. */
  status: string;
  /** The marks may still land (the server is still saying "ask me again"). */
  feedbackPending: boolean;
  /** The deck has a moment or a coach's word waiting: the walk is opening. */
  reviewWaiting: boolean;
  /** The page already asked the deck to open the walk (live or replayed). */
  walkRequested: boolean;
  /** The page opens a helper-words step by itself as soon as the deck is up. */
  opensHelpers: boolean;
}

/** True when the lens has nothing to wait for: the page is past loading
 *  and, once it is ready, its feedback has settled with no walk to open. A
 *  page that could not load has no walk either. */
export function lensIdle(page: LensPage): boolean {
  if (page.status === "loading") return false;
  if (page.status !== "ready") return true;
  return (
    !page.feedbackPending &&
    !page.reviewWaiting &&
    !page.walkRequested &&
    !page.opensHelpers
  );
}

/** The lens screen's address in the bar, so a reload or a shared link opens
 *  it again (founder 2026-10-14): `?lens=<arc_id>` alone is the coach's
 *  feedback (the address the WhatsApp message sends), `&mode=review` the
 *  review. Null takes both off. The overlay sets it on its own Back entry,
 *  so the entry under it never holds the lens. */
export function lensAddress(arcId: string | null, mode: "review" | "feedback" = "feedback"): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.delete("lens");
  url.searchParams.delete("mode");
  if (arcId) {
    url.searchParams.set("lens", arcId);
    if (mode === "review") url.searchParams.set("mode", "review");
  }
  window.history.replaceState(window.history.state, "", url);
}
