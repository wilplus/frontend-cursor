/* -------------------------------------------------------------------------- */
/*  HOW LONG THE PAGE WAITS FOR FEEDBACK (founder 2026-09-20)                  */
/*                                                                            */
/*  On the first bookmarks the product ever showed anyone: "after a while,    */
/*  after I closed it, or not even closing it, I just left it alone for a     */
/*  while. It refetched and then displayed. So this is just a loading bug."   */
/*                                                                            */
/*  It was. The marks are not in the core read — they are computed DURING     */
/*  the enrichment request (`document_layers` runs the Manager over the       */
/*  Take), and when that reader outruns its server budget the section comes   */
/*  back `{status: "pending", retryable: true}`: the server saying, in as     */
/*  many words, ASK ME AGAIN.                                                 */
/*                                                                            */
/*  The page asked three times — 200ms, 500ms, 1000ms apart — and then        */
/*  stopped. Not "stopped and said so": `settleIdealTextEnrichment` returns   */
/*  `kind: "ready"` whether the sections settled or the attempts simply ran   */
/*  out, so the caller declared feedback finished, dropped the reserved mark  */
/*  slots, and painted a finished-looking talk with no bookmarks on it. And   */
/*  nothing asked again, because after the first paint nothing re-reads the   */
/*  document at all. The marks the founder eventually saw arrived on an       */
/*  unrelated refetch, minutes later, by luck.                                */
/*                                                                            */
/*  TWO BOUNDS, AND THEY MEAN DIFFERENT THINGS.                               */
/*                                                                            */
/*    SETTLE_CEILING_MS    the SCREEN's patience. Like ANALYSIS_SETTLE_CAP_MS */
/*                         in documentSettle, it is not a verdict on the      */
/*                         backend — the Take keeps whatever it persisted and */
/*                         the next read picks the marks up. It only says how */
/*                         long this page will hold a slot open.              */
/*    SETTLE_MAX_ATTEMPTS  a hard stop on REQUESTS, because each retry re-runs */
/*                         real Manager work. The ceiling alone would not     */
/*                         bound that if the server answered instantly and    */
/*                         kept saying retryable.                             */
/*                                                                            */
/*  Whichever bites first wins. The delays widen rather than repeat, so a     */
/*  slow Take costs a handful of requests over a minute and a half, not a     */
/*  tight loop.                                                               */
/*                                                                            */
/*  WHY THE CEILING EXISTS AT ALL, rather than waiting forever: an honest     */
/*  empty lane is a real outcome (24c/24d — coverage is "a target on          */
/*  selection, never a floor on output"), and a slot held open forever is the */
/*  same lie as a late mark, told more slowly. When the budget is spent the   */
/*  page stops reserving and shows what it has.                               */
/*                                                                            */
/*  HERE RATHER THAN IN THE SERVICE, for the reason bookmarkMotion, deckScroll */
/*  and waitProgress each give in turn: a schedule buried in an async loop is */
/*  a rule no unit test can state. These are pure and the loop asks them.     */
/* -------------------------------------------------------------------------- */

/** How long this page will keep asking for a section the server called
 *  retryable. Past anything observed and still bounded. */
export const SETTLE_CEILING_MS = 90_000;

/** How many follow-up requests one settle may spend. Each one re-runs the
 *  Manager, so this is a cost bound, not a time bound. */
export const SETTLE_MAX_ATTEMPTS = 8;

/** The wait BEFORE each follow-up request. Widening, then held: the first
 *  few cover a reader that just missed its budget; the tail covers a Take
 *  whose Manager work is genuinely slow without turning into a poll. */
export const SETTLE_DELAYS_MS: readonly number[] = [
  200, 500, 1000, 2000, 4000, 8000,
];

/** The wait before attempt `attempt` (0-based), held at the last value. */
export function settleDelayMs(attempt: number): number {
  const index = Math.min(
    Math.max(0, Math.floor(attempt)),
    SETTLE_DELAYS_MS.length - 1,
  );
  return SETTLE_DELAYS_MS[index];
}

/** The wait before the next follow-up request, or `null` when the budget is
 *  spent and the page must stop asking.
 *
 *  The ceiling gates STARTING an attempt: an attempt begun inside the budget
 *  is allowed to finish, so the true wall clock is the ceiling plus one
 *  request. That is deliberate — cutting a request off mid-flight would throw
 *  away the answer we are waiting for.
 */
export function nextSettleDelayMs(
  attempt: number,
  elapsedMs: number,
  ceilingMs: number = SETTLE_CEILING_MS,
): number | null {
  if (!Number.isFinite(attempt) || attempt < 0) return null;
  if (attempt >= SETTLE_MAX_ATTEMPTS) return null;
  if (!Number.isFinite(elapsedMs) || elapsedMs >= ceilingMs) return null;
  return settleDelayMs(attempt);
}

/** The sections the server asked us to come back for, in a stable order.
 *
 *  `retryable` is the server's word, not a guess of ours — see
 *  `services/ideal_text_enrichment.py`, which sets it when a reader times out
 *  or throws, and leaves it off when the answer is complete. */
export function retryableSections(
  sections: Readonly<Record<string, { retryable?: boolean }>>,
): string[] {
  return Object.entries(sections ?? {})
    .filter(([, section]) => section?.retryable === true)
    .map(([name]) => name)
    .sort();
}

/** The sections that carry MARKS — the ones the reserved slot is actually
 *  waiting for. `document_layers` is the bookmarks (the Manager's block);
 *  `feedback` is the key-moment links. Nothing else on the enrichment puts a
 *  mark on the page. */
export const MARK_SECTIONS: readonly string[] = ["document_layers", "feedback"];

/** THE TWO LANES A FIRST OPEN ASKS IN (founder 2026-09-22: "can you do
 *  something to make loading of the bookmarks faster? cause it is really
 *  long").
 *
 *  It used to be one request for everything, and that cost a whole wasted
 *  round trip. The server picks its budget from what is asked for, and a
 *  request naming nothing got the two-second cold open — but the Manager
 *  measurably takes about four and a half seconds, so the bookmarks could
 *  not possibly answer in time. The page spent two seconds failing, waited,
 *  and only then asked again with room to finish. Seven seconds of ring for
 *  four and a half seconds of work.
 *
 *  Asking in two lanes at once gives each the budget it needs. The marks get
 *  the long one immediately; everything the page draws around them keeps the
 *  tight one and arrives when it always did. Neither can hold the other up,
 *  which one response could never express — one response has one deadline.
 *
 *  SLOW_LANE is `document_layers` alone, and it matches `SLOW_SECTIONS` on
 *  the server, which is where the rule is really decided. PROMPT_LANE is
 *  every other section this page reads; `mergeIdealTextEnrichment` names the
 *  same seven, so this is not a new place to keep in step with the backend. */
export const SLOW_LANE: readonly string[] = ["document_layers"];

export const PROMPT_LANE: readonly string[] = [
  "feedback", "notes", "history", "journey", "entitlement", "learning",
];

/** True when the server is still asking to be asked again ABOUT THE MARKS —
 *  i.e. the marks this page is holding are NOT all the marks there are.
 *
 *  The property `feedbackPending` should actually be set from: a settle that
 *  ran out of budget still has retryable sections, and a caller that reads
 *  only `kind === "ready"` cannot tell that from a settle that finished.
 *
 *  ONLY THE MARK SECTIONS COUNT (founder 2026-09-21). The `learning` section
 *  is the F2 learning layer's exposure receipt. In production it failed on
 *  every read (`learning presentation ownership rejected`, a canonical
 *  `takes` row that is only written for the data-foundation canary owner),
 *  came back `retryable`, and this function read that as "feedback still
 *  coming" — so the deck held the empty slot for the whole ninety-second
 *  budget and drew no bookmarks over a Take whose `document_layers` had
 *  answered in full. The bookmark does not wait on the learning layer (R12,
 *  backend #574): a failing F2 section must never hide an F1 mark. */
export function feedbackStillComing(
  sections: Readonly<Record<string, { retryable?: boolean }>>,
): boolean {
  return retryableSections(sections).some((name) =>
    MARK_SECTIONS.includes(name),
  );
}
