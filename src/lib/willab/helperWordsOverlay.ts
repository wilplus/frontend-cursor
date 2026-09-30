/* THE HELPER WORDS OVERLAY'S RULES (founder lock 2026-09-30, B4, B10, D4,
 * D5, Q2, Q3). Pure, so the sheet stays a renderer and vitest can reach
 * them.
 *
 * One chip per Take that has a version of the paragraph, newest first, the
 * current one marked "now". Choosing a chip shows that Take's text as
 * tappable words; switching chips starts a fresh selection (Q3: one Take,
 * one phrase). The picker opens with the saved words pre-selected on the
 * current Take (B10) and the button lights only when the selection differs
 * from the saved words.
 */
import type { ParagraphHistory } from "@/services/api/bookmarkHistory";
import { phraseTokens, type PhraseSelection, type PhraseToken } from "./phraseTokens";

export interface TakeChip {
  /** The Take number, or null when the history does not name it. */
  takeIndex: number | null;
  /** "Take 2" — or the Take word alone when unnumbered. */
  label: string;
  /** The current Take: its words are the paragraph as it is now. */
  now: boolean;
  /** The words to tap. */
  text: string;
}

/** The chips, newest first. The newest version is the paragraph as it is
 *  now, so its text is the current paragraph, exact; earlier versions are
 *  the Slide's words as that Take said them. With no history at all there
 *  is one chip, the current text. */
export function takeChips(
  history: ParagraphHistory | null,
  currentText: string,
  takeWord: string,
): TakeChip[] {
  const versions = (history?.versions ?? []).filter((v) =>
    v.paragraphs.some((p) => p.trim()),
  );
  if (versions.length === 0) {
    return [{ takeIndex: null, label: takeWord, now: true, text: currentText }];
  }
  return versions
    .map((v, i) => ({
      takeIndex: v.takeIndex,
      label: v.takeIndex ? `${takeWord} ${v.takeIndex}` : takeWord,
      now: i === versions.length - 1,
      text: i === versions.length - 1 ? currentText : v.paragraphs.join("\n\n"),
    }))
    .reverse();
}

/** A word as the eye reads it: case and the punctuation on its edges do
 *  not make "matters," a different word from "matters". The page matches
 *  the saved words the same way for the italic. */
function plain(word: string): string {
  return word.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

function plainWords(text: string): string[] {
  return text.split(/\s+/).map(plain).filter(Boolean);
}

/** The saved words as a run of this text's tokens, when they sit in it
 *  whole (B10: the picker opens with them pre-selected); null otherwise. */
export function preselect(
  tokens: readonly PhraseToken[],
  headline: string | null,
): PhraseSelection | null {
  if (!headline) return null;
  const want = plainWords(headline);
  if (want.length === 0) return null;
  for (let from = 0; from + want.length <= tokens.length; from += 1) {
    let match = true;
    for (let k = 0; k < want.length; k += 1) {
      if (plain(tokens[from + k].text) !== want[k]) {
        match = false;
        break;
      }
    }
    if (match) return { from, to: from + want.length - 1 };
  }
  return null;
}

/** Does the selection differ from the saved words? Nothing chosen never
 *  differs: the button stays off, Delete is the way to clear (D4). */
export function changed(chosen: string | null, headline: string | null): boolean {
  if (!chosen) return false;
  return plainWords(chosen).join(" ") !== plainWords(headline ?? "").join(" ");
}

function time(value: string | null): number {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

/** The Take the saved words were chosen in: the newest version that stood
 *  when the last non-empty set was written. Null when unknown. */
export function savedTakeIndex(history: ParagraphHistory | null): number | null {
  if (!history) return null;
  const sets = history.helperWords.filter((s) => s.phrases.some((p) => p.trim()));
  const last = sets[sets.length - 1];
  if (!last) return null;
  const at = time(last.at);
  let take: number | null = null;
  for (const v of history.versions) {
    if (time(v.at) <= at && v.takeIndex) take = v.takeIndex;
  }
  return take;
}

/** The signed line under the picker on a later Take (B9): shown when the
 *  saved words came from an earlier Take than the one whose words are
 *  being tapped. */
export function replaceNoteTake(
  history: ParagraphHistory | null,
  headline: string | null,
  chip: TakeChip,
): number | null {
  if (!headline || !chip.now || !chip.takeIndex) return null;
  const saved = savedTakeIndex(history);
  return saved !== null && saved < chip.takeIndex ? saved : null;
}

export { phraseTokens };
