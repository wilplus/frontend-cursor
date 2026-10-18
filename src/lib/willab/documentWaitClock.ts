/* -------------------------------------------------------------------------- */
/*  documentWaitClock — when the document phase of the Take in flight began,   */
/*  for the waiting screens that are shown without the marker in hand.       */
/*                                                                            */
/*  The settle hook (`useDocumentSettle`) reads the processing-take marker on */
/*  every host that can show the Ideal Text — the Lounge, the Lab, the        */
/*  picker — and the marker carries `phaseStartedAt`. The waiting screen      */
/*  itself (`ProcessingWait`) is also rendered by the Ideal Text overlay and  */
/*  the readout with no marker in hand, and there it clocked the document     */
/*  tail from its own mount: open the overlay, the bar starts its last slice  */
/*  again; close and reopen, again (founder 2026-10-18: "reloading the last   */
/*  5-10% again and again").                                                  */
/*                                                                            */
/*  So the settle hook publishes the marker's clock here, and the screen      */
/*  reads it when its host gave it none. The marker is keyed by account in    */
/*  storage; this mirror is not, so the screen needs no auth hook to read it. */
/*  A module value, not state: it is a clock to read on render, and the hook  */
/*  that writes it is mounted wherever the screen can appear.                 */
/* -------------------------------------------------------------------------- */

let current: { sessionId: string; phaseStartedAt: number } | null = null;

/** The settle hook's write: the Take whose document phase is running, or
 *  null when none is. */
export function setDocumentWaitClock(
  clock: { sessionId: string; phaseStartedAt: number } | null,
): void {
  current = clock;
}

/** When the document phase in flight began, or null when none is. */
export function documentWaitStartedAt(): number | null {
  return current?.phaseStartedAt ?? null;
}
