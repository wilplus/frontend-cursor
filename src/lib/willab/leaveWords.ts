/* The words that leave rather than answer (backend N467 rule 3): wherever a
   chat offers one, `TapRow` draws it as a grey word, never a pill and never
   the filled answer. Every copy that offers one takes it from here, so a
   word and its look cannot drift apart. No new words without the founder's
   OK (Never 4). */
export const NOT_NOW = "Not now";
export const SKIP = "Skip";
export const CANCEL = "Cancel";
export const CLOSE = "Close";
export const LEAVE_WORDS: readonly string[] = [NOT_NOW, SKIP, CANCEL, CLOSE];
