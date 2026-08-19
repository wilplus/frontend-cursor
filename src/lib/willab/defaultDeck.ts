/* -------------------------------------------------------------------------- */
/*  THE DEFAULT DECK (three structural slides for a deckless speech)           */
/*  same message: "this is the mock presentation that should always be there   */
/*  if someone did not upload their own presentation").                        */
/*                                                                            */
/*  WHY THIS IS AN F1 PIECE, not a nicety. The whole pipeline is defined per   */
/*  SLIDE: words are bucketed to the slide on screen when they were spoken,    */
/*  takes are ranked slide by slide, and the best version of each slide is     */
/*  assembled into the speech. A deckless recording has no buckets — there is  */
/*  nothing for the ranking to compare across takes, because "the same slide,  */
/*  said again" is undefined. Giving every speaker three slides to click       */
/*  through means the 1:1 word→slide segmentation is ALWAYS defined, for every */
/*  user, from their first take.                                              */
/*                                                                            */
/*  It is a real deck, not a placeholder: the speaker advances it while        */
/*  recording exactly as they would their own, so the timeline it produces is  */
/*  the same shape the uploaded-deck path produces. Nothing downstream needs   */
/*  to know which kind of deck it was.                                        */
/*                                                                            */
/*  The headings are the MVP contract: Main premise, Development, Conclusion.  */
/*  The supporting guidance retains the previously approved three-part talk.  */
/* -------------------------------------------------------------------------- */

export interface DeckSlide {
  title: string;
  /** Free text; newlines read as bullets — the same shape an uploaded deck's
   *  slides take in `intake_context.slides`. */
  body: string;
}

/* The rule lands on its OWN line in every slide; `bulletLines` splits on
 * newlines. */
export const DEFAULT_DECK: readonly DeckSlide[] = [
  {
    title: "Main premise",
    body:
      "Grab attention (question, surprising fact, story), state why it " +
      "matters to them, and tell them the one thing they'll get.\n" +
      "Rule: say what you're going to say.",
  },
  {
    title: "Development",
    body:
      "Make a single argument, back it with ~3 points, each with " +
      "evidence/example.\n" +
      "Rule: say it — tell, show, prove.",
  },
  {
    title: "Conclusion",
    body:
      "Restate the one takeaway, then tell them exactly what to do/feel/" +
      "remember next.\n" +
      "Rule: say what you said, and close with a clear ask.",
  },
];

/* GOLDEN_THREAD lived here — the deck-level line printed under the three
 * slides. Deleted with the recording-screen respec (founder 2026-08-11, §6):
 * the screen you look at mid-sentence carries the slide and the controls,
 * nothing to read about the deck. The three slides still carry the rules
 * themselves, in their own bodies. */

/** The deck to record against: the speaker's own if they uploaded one, else
 *  the default.
 *
 *  A served PDF is authoritative even when text extraction returned blank
 *  pages. Those pages are still the presentation the speaker sees, and their
 *  positions still define the word→slide buckets. Without a PDF, blank manual
 *  rows are not a usable deck and the structural default remains the fallback.
 *  Pure. */
export function deckForRecording(
  slides: readonly DeckSlide[] | null | undefined,
  presentationRef?: string | null
): { slides: readonly DeckSlide[]; isDefault: boolean } {
  const supplied = slides ?? [];
  if (presentationRef) {
    // The extraction endpoint normally returns one row per PDF page, including
    // image-only pages. Keep every row and its index. The one-page fallback is
    // defensive for legacy records that retained the served PDF but lost the
    // extraction metadata; it is still more truthful than showing a mock deck.
    return {
      slides: supplied.length > 0 ? supplied : [{ title: "", body: "" }],
      isDefault: false,
    };
  }
  const own = supplied.filter(
    (s) => s && (s.title.trim().length > 0 || s.body.trim().length > 0)
  );
  return own.length > 0
    ? { slides: own, isDefault: false }
    : { slides: DEFAULT_DECK, isDefault: true };
}
