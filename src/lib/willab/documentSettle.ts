/* -------------------------------------------------------------------------- */
/*  documentSettle — WHEN is "the new text is ready"? (SPEC-lockin-loop §1)     */
/*                                                                            */
/*  The blocking "Working on your text" screen may only drop when the take's   */
/*  document has actually assembled — and the readout going terminal is not    */
/*  that moment (handoff §6.4 S3: the arc-level reassembly lands at pipeline   */
/*  end, after `readout_ready`). The FE has no "assembled" event, so the       */
/*  document phase OBSERVES the served ideal text and decides from evidence:   */
/*                                                                            */
/*    settled  — the served document demonstrably contains the awaited take:   */
/*               either a piece carries its take index, or the durable review  */
/*               version has reached that absolute take index. A version delta */
/*               remains a compatibility signal for legacy/null-index callers.*/
/*    expired  — the cap passed without database-visible evidence. The caller  */
/*               must enter failed_ideal_text_unconfirmed; never clear as if    */
/*               document generation succeeded.                                */
/*    waiting  — neither yet.                                                 */
/*                                                                            */
/*  The version is an ABSOLUTE review identity, not a generic revision count:  */
/*  Take N finalization transactionally publishes version N. This matters for  */
/*  synchronous processing, where finalization can finish before the first     */
/*  browser probe and therefore no version *change* can be observed.            */
/* -------------------------------------------------------------------------- */

/** What one probe of the served ideal text saw. */
export interface DocumentProbe {
  /** The served version, when the GET carried one. */
  version: number | null;
  /** The newest take index among the served pieces, when pieces exist. */
  maxTakeIndex: number | null;
}

/** How long the document phase may block past its start. Bounded because the
 *  probe has no negative signal — "not assembled yet" and "assembled but
 *  unobservable" look identical, and only time separates them. */
export const DOCUMENT_SETTLE_CAP_MS = 120_000;

/** How long the ANALYSIS phase may block before the screen gives up.
 *
 *  FOUNDER 2026-09-17: "it still processes, something is wrong." The document
 *  phase has had a cap since it was written; the analysis phase had NONE. It
 *  was owned by whichever readout happened to be mounted, which transitions it
 *  to "document" at its terminal states — so if that surface was not on screen
 *  (the app reopened, the view switched, the tab reloaded) nothing advanced
 *  the marker, nothing probed, and the cap that would have released the screen
 *  belonged to a phase the take never reached. The only thing that ever
 *  cleared it was the 30-minute staleness rule. Half an hour of a blocking
 *  screen is indistinguishable from the app being broken, because for that
 *  speaker it is.
 *
 *  LONGER THAN THE DOCUMENT CAP, and deliberately so: this phase is doing real
 *  work — upload, transcription, segmentation — on audio whose length nobody
 *  here knows, over a connection nobody here controls. Two minutes would cut
 *  off honest long takes. Eight is past anything observed and still bounded.
 *
 *  A cap is not a verdict on the backend. It releases the SCREEN, and the take
 *  keeps whatever it already persisted — transcription and analysis are
 *  written as they complete, which is why the terminal state for Take 1 is
 *  "we processed your take, but couldn't create your Ideal Text" and offers a
 *  retry rather than asking anyone to record again.
 */
export const ANALYSIS_SETTLE_CAP_MS = 480_000;

export function documentSettled(
  awaitTakeIndex: number | null,
  first: DocumentProbe | null,
  current: DocumentProbe,
  phaseStartedAt: number,
  now: number,
): "settled" | "waiting" | "expired" {
  // Durable confirmation for both async and synchronous completion. The
  // backend's Take finalizer makes review version == take index in one
  // transaction, so reaching N proves that Take N's review is openable even
  // when none of its wording won a place in the master document.
  if (
    awaitTakeIndex !== null &&
    current.version !== null &&
    current.version >= awaitTakeIndex
  ) {
    return "settled";
  }
  // Positive confirmation: the document contains the awaited take.
  if (
    awaitTakeIndex !== null &&
    current.maxTakeIndex !== null &&
    current.maxTakeIndex >= awaitTakeIndex
  ) {
    return "settled";
  }
  // The version moved while we watched — a reassembly landed. This is the
  // signal for a take that won no block: its reassembly still bumps the
  // version even though no piece ever names it.
  if (
    first !== null &&
    first.version !== null &&
    current.version !== null &&
    current.version !== first.version
  ) {
    return "settled";
  }
  if (now - phaseStartedAt > DOCUMENT_SETTLE_CAP_MS) return "expired";
  return "waiting";
}

/** The probe view of a fetched ideal-text payload. Tolerant by design — a
 *  payload with no pieces or no version simply contributes nulls, and the
 *  rules above never treat null as evidence. */
export function probeOf(r: {
  version?: number | null;
  pieces?: Array<{ takeIndex: number | null }> | null;
}): DocumentProbe {
  const takes = (r.pieces ?? [])
    .map((p) => p.takeIndex)
    .filter((t): t is number => typeof t === "number");
  return {
    version: typeof r.version === "number" ? r.version : null,
    maxTakeIndex: takes.length > 0 ? Math.max(...takes) : null,
  };
}
