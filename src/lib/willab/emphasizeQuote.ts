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
/*  `**bold**` is the marker contract (lib/willab/richMarkers, pinned BE-side  */
/*  in services/ideal_text_block.py). MarkedEditor renders it as a styled span */
/*  and serializes it back byte-for-byte, so the student never sees the        */
/*  asterisks — FE-1.                                                         */
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

/**
 * Wrap the FIRST occurrence of `quote` in `text` with `**…**`.
 *
 * Returns `text` untouched when:
 *   - the quote is empty, or absent from the text (spans drift as a document
 *     is reassembled — an anchor that no longer matches must not be forced);
 *   - the occurrence already carries the emphasis (applying twice would
 *     produce `****x****`, which is not the contract and renders as literal
 *     asterisks);
 *   - the quote spans an existing marker boundary — detected conservatively by
 *     refusing any quote that itself contains `**`.
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
  if (!body || !q || q.includes("**")) return body;

  const at = body.indexOf(q);
  if (at < 0) return body;

  // Already emphasised — either exactly (`**q**`) or as part of a wider bold
  // run. Both mean the work is done; re-wrapping would break the markup.
  const before = body.slice(0, at);
  const after = body.slice(at + q.length);
  if (before.endsWith("**") && after.startsWith("**")) return body;

  // An ODD number of `**` before the match means the quote sits INSIDE an open
  // bold run, so it is already rendering bold and wrapping it again would
  // close that run in the wrong place.
  const opensBefore = (before.match(/\*\*/g) ?? []).length;
  if (opensBefore % 2 === 1) return body;

  return `${before}**${q}**${after}`;
}
