/* -------------------------------------------------------------------------- */
/*  recordingCopy — the words the recording screens' lock added               */
/*  (founder lock 2026-10-07, N59, as amended 2026-10-12, N70).               */
/*                                                                            */
/*  ONLY THE LOCK'S WORDS live here, typed exactly as signed. Every other     */
/*  word on these screens is today's and stays where it already is ("Finish  */
/*  take", "Discard this take?", the processing wait). "Scroll down to start" */
/*  and "Click down to start" were retired with the learning screen (N70).    */
/*  recordingCopy.test.ts holds the list.                                     */
/* -------------------------------------------------------------------------- */

export const RECORDING_COPY = {
  /** The two buttons under the strip (N70). On the last slide Next slide
   *  becomes Finish take. */
  back: "Back",
  nextSlide: "Next slide",
  /** Before every Take, as small grey text under the voice mark (the
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
