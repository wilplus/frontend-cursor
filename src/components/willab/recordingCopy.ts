/* -------------------------------------------------------------------------- */
/*  recordingCopy — the words the recording screens' lock added               */
/*  (founder lock 2026-10-07, FOUNDER-LOCK-recording-screens-2026-10-07,      */
/*  decisions log N59).                                                       */
/*                                                                            */
/*  ONLY THE LOCK'S NEW WORDS live here, typed exactly as signed. Every other */
/*  word on these screens is today's and stays where it already is            */
/*  ("Getting your mic ready", "Finish take", "Discard this take?", the       */
/*  processing wait). recordingCopy.test.ts holds the list.                   */
/* -------------------------------------------------------------------------- */

export const RECORDING_COPY = {
  /** The first recording's learning screen, on a touch screen (the
   *  founder's own words). */
  scrollToStart: "Scroll down to start",
  /** The same screen on a desktop, under the arrow keys. */
  clickToStart: "Click down to start",
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
