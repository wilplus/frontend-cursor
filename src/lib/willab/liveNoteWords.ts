/* The words of a voice note as it is said (backend N194, N199): the pieces
   heard whole, the piece still being heard (lighter: it may change), and the
   hesitations that fade out when the note settles. Pure, so the note on
   screen and its tests read the same rules. */

/** Hesitations the backend takes out of a note (transcript_smoothing's
 *  strip_fillers keeps every other word). */
const FILLERS = new Set(["um", "umm", "uh", "uhm", "uhh", "er", "erm", "ah", "hmm", "mm", "mhm"]);

export function isFiller(word: string): boolean {
  return FILLERS.has(word.toLowerCase().replace(/[^a-z]/g, ""));
}

export interface LiveWord {
  text: string;
  /** In the piece still being heard, so it may change: drawn lighter. */
  fresh: boolean;
  filler: boolean;
}

/** The note's words: the pieces heard whole, then the piece still being
 *  heard, every word of it fresh (N199: a phrase is lighter until its whole
 *  piece has been heard). */
export function liveWords(finished: readonly string[], current: string): LiveWord[] {
  const settled = finished.join(" ").split(/\s+/).filter(Boolean);
  const heard = current.split(/\s+/).filter(Boolean);
  return [
    ...settled.map((text) => ({ text, fresh: false, filler: isFiller(text) })),
    ...heard.map((text) => ({ text, fresh: true, filler: isFiller(text) })),
  ];
}

/** Words kept on the phone (hesitations and all), for the note until it is
 *  kept. */
export function wordsOf(text: string): LiveWord[] {
  return text.split(/\s+/).filter(Boolean).map((t) => ({ text: t, fresh: false, filler: isFiller(t) }));
}
