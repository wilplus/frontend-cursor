/* -------------------------------------------------------------------------- */
/*  recordingCopy — the words the recording screens' lock added               */
/*  (founder lock 2026-10-07, FOUNDER-LOCK-recording-screens-2026-10-07,      */
/*  decisions log N59).                                                       */
/*                                                                            */
/*  ONLY THE LOCK'S WORDS live here, typed exactly as signed: the three the   */
/*  lock added and "Getting your mic ready", visible since Q-B4 A. Every      */
/*  other word on these screens is today's and stays where it already is      */
/*  ("Finish take", "Discard this take?", the processing wait).               */
/*  recordingCopy.test.ts holds the list.                                     */
/* -------------------------------------------------------------------------- */

export const RECORDING_COPY = {
  /** The first recording's learning screen, on a touch screen (the
   *  founder's own words). */
  scrollToStart: "Scroll down to start",
  /** The same screen on a desktop, under the arrow keys. */
  clickToStart: "Click down to start",
  /** Before a later Take, as small grey text under the voice mark (the
   *  prototype's renderMic). It was read only by screen readers until the
   *  founder signed every word a locked prototype shows (Q-B4 A, decisions
   *  log N62/N63, 2026-10-07). */
  micReady: "Getting your mic ready",
} as const;

/** The top bar's line while recording: "Take N · Slide n of m". The only
 *  numbers are the Take's and the slide's position (AC-9). The /dev harness
 *  has no Take, so it reads "Slide n of m" alone. */
export function recordingWhere(
  take: number | null,
  slideIndex: number,
  slideCount: number,
): string {
  const slide = `Slide ${slideIndex + 1} of ${slideCount}`;
  return take ? `Take ${take} · ${slide}` : slide;
}
