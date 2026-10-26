/* The words of a voice note as it is said (backend N194): what is settled,
   the newest one or two that may still change, and the hesitations that
   fade out when the note settles. Pure, so the note on screen and its tests
   read the same rules. */

/** Hesitations the backend takes out of a note (transcript_smoothing's
 *  strip_fillers keeps every other word). */
const FILLERS = new Set(["um", "umm", "uh", "uhm", "uhh", "er", "erm", "ah", "hmm", "mm", "mhm"]);

export function isFiller(word: string): boolean {
  return FILLERS.has(word.toLowerCase().replace(/[^a-z]/g, ""));
}

export interface LiveWord {
  text: string;
  /** Heard last, so it may still change: drawn lighter. */
  fresh: boolean;
  filler: boolean;
}

/** The note's words: the finished pieces, then the piece still being heard,
 *  whose last two words are fresh. */
export function liveWords(finished: readonly string[], current: string): LiveWord[] {
  const settled = finished.join(" ").split(/\s+/).filter(Boolean);
  const heard = current.split(/\s+/).filter(Boolean);
  const freshFrom = Math.max(0, heard.length - 2);
  return [
    ...settled.map((text) => ({ text, fresh: false, filler: isFiller(text) })),
    ...heard.map((text, i) => ({ text, fresh: i >= freshFrom, filler: isFiller(text) })),
  ];
}

/** The words as the note will read: hesitations out, first letter capital. */
export function settledWords(words: readonly LiveWord[]): string {
  const text = words.filter((w) => !w.filler).map((w) => w.text).join(" ").replace(/^[,.;:\s]+/, "");
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}
