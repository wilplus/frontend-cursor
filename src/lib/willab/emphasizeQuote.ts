/* -------------------------------------------------------------------------- */
/*  emphasizeQuote — put **bold** around a proposal's quote, locally           */
/*  (founder 2026-08-15).                                                     */
/*                                                                            */
/*  "When I clicked to apply styling it didn't apply … it did apply but after  */
/*  I have closed the modal. I want it to happen right the moment you click."  */
/*                                                                            */
/*  The Apply button awaited the server and changed nothing on screen, so the  */
/*  words stayed plain until the host refetched — which, if the student closed */
/*  the modal first, looked like the click had done nothing and the state had  */
/*  "reactivated" later. This is the local half: the same emphasis the server  */
/*  is about to persist, applied to the draft on the spot.                    */
/*                                                                            */
/*  THE MARK IS THE ONE THE SERVER WILL BAKE, and that is not a detail        */
/*  (founder 2026-08-15). An applied accent is baked server-side by            */
/*  ideal_decision_ledger.bake_piece → ideal_text_block.wrap_accent, which     */
/*  writes `{{orange:…}}` — the ONE accent colour. This function used to write */
/*  `**bold**`, so the student saw the words go BOLD on the click and then     */
/*  turn ORANGE a moment later when the refetch landed: two treatments for one */
/*  accepted accent, a beat apart, which reads as the system changing its mind.*/
/*                                                                            */
/*  Bold is not the wrong mark by accident — it is the mark of a PROPOSED      */
/*  accent (intervention_candidates._VISUAL_ACCENT), and orange is the mark of */
/*  an ACCEPTED one. Painting bold at the moment of acceptance showed the      */
/*  pre-decision state as the result of the decision.                          */
/*                                                                            */
/*  `{{orange:…}}` is the marker contract (lib/willab/richMarkers, pinned      */
/*  BE-side in services/ideal_text_block.py). MarkedEditor renders it as a     */
/*  styled span and serializes it back byte-for-byte, so the student never     */
/*  sees the syntax — FE-1.                                                   */
/*                                                                            */
/*  Pure. Returns the text UNCHANGED whenever it cannot place the emphasis     */
/*  exactly, and the caller treats "unchanged" as "nothing to undo" — a        */
/*  guess here would corrupt the student's own words, which is worse than a    */
/*  button that waits for the refetch.                                        */
/* -------------------------------------------------------------------------- */

/** Escape a literal for use inside a RegExp. */
function esc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The accepted-accent wrappers — identical to what wrap_accent bakes. */
const OPEN = "{{orange:";
const CLOSE = "}}";

/**
 * Wrap the FIRST occurrence of `quote` in `text` with `{{orange:…}}`.
 *
 * Returns `text` untouched when:
 *   - the quote is empty, or absent from the text (spans drift as a document
 *     is reassembled — an anchor that no longer matches must not be forced);
 *   - the occurrence already carries the emphasis (applying twice would
 *     produce a nested token, which is not the contract and renders its own
 *     syntax at the reader;
 *   - the quote spans an existing marker boundary — detected conservatively by
 *     refusing any quote that itself carries accent syntax.
 *
 * Matching is exact and literal, deliberately: the proposal's quote comes from
 * the same served text this draft was seeded with, so a fuzzy match would only
 * ever help when the two have ALREADY diverged — the case where guessing is
 * least safe.
 */
export function emphasizeQuote(
  text: string | null | undefined,
  quote: string | null | undefined
): string {
  const body = text ?? "";
  const q = (quote ?? "").trim();
  if (!body || !q || q.includes(OPEN) || q.includes(CLOSE)) return body;

  const at = body.indexOf(q);
  if (at < 0) return body;

  // Already accented — either exactly (`{{orange:q}}`) or as part of a wider
  // run. Both mean the work is done; re-wrapping would break the markup.
  const before = body.slice(0, at);
  const after = body.slice(at + q.length);
  if (before.endsWith(OPEN) && after.startsWith(CLOSE)) return body;

  // INSIDE AN OPEN RUN. The tokens are asymmetric (unlike `**`), so counting
  // one of them is not enough: the quote sits inside an accent when the last
  // token before it is an OPEN. Wrapping there would close that run in the
  // wrong place and leak `}}` into the sentence.
  const lastOpen = before.lastIndexOf(OPEN);
  const lastClose = before.lastIndexOf(CLOSE);
  if (lastOpen > lastClose) return body;

  return `${before}${OPEN}${q}${CLOSE}${after}`;
}
