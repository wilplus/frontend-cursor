/** Tap-to-select for the rooting phrase, in RAW-DRAFT coordinates.
 *
 *  Founder 2026-09-15: the text field is gone. The paragraph renders as
 *  tappable words — tap a word to pick it, tap it again to drop it (any words
 *  since 2026-10-15) — and the tapped words render in the accent, because
 *  that is literally how a rooting phrase renders while recording. It is a
 *  preview, not a selection colour.
 *
 *  THE OFFSETS ARE THE WHOLE PROBLEM. The retired `customRootSpan()` did
 *  `draft.indexOf(phrase)`, i.e. offsets into the RAW draft — which carries
 *  marker grammar (`**bold**`, legacy `==x==`). `RootPhraseSpan` is
 *  `{text, start, end}` and the backend reads those offsets literally against
 *  the same raw text. So a tokenizer that measured the DISPLAYED string would
 *  be short by every marker character before it, and every span on an
 *  emphasised paragraph would land on the wrong words — silently, because the
 *  offsets stay in range and the text still looks plausible.
 *
 *  So: tokenize the displayed text, but carry each character's raw index with
 *  it. `parseRichSpans` already knows the mapping (`srcStart`/`srcEnd` bracket
 *  a run's text in the original, excluding its tokens), which is why this
 *  reuses it rather than writing a second parser that could disagree with the
 *  renderer about where a word is.
 *
 *  Tokenizing the STRIPPED text rather than each span separately matters too:
 *  `**sur**prised` is one word to a reader and two spans to the parser, and a
 *  speaker cannot tap half a word.
 */
import type { RootPhraseSpan } from "@/services/api/partLock";
import { parseRichSpans, stripRichMarkers } from "./richMarkers";

export interface PhraseToken {
  /** The word as it is read, with no marker characters in it. */
  text: string;
  /** Raw-draft offsets: `raw.slice(start, end)` may include markers. */
  start: number;
  end: number;
}

/** The picked words' indices, ascending; never empty (null is "nothing").
 *  Any words of the paragraph (founder 2026-10-15): neighbours make one
 *  piece, and the pieces read in the order said, joined with PIECE_SEP. */
export type PhraseSelection = readonly number[];

/** Between the pieces of one pick, as saved and as shown. */
export const PIECE_SEP = " · ";

/** The pieces one saved pick holds. */
export function phrasePieces(phrase: string | null | undefined): string[] {
  return (phrase ?? "").split(PIECE_SEP.trim()).map((p) => p.trim()).filter(Boolean);
}

/** Is this word picked? */
export function isPicked(selection: PhraseSelection | null, index: number): boolean {
  return selection !== null && selection.includes(index);
}

/** The picked words as runs of neighbours, in order. */
function runs(selection: PhraseSelection): number[][] {
  const out: number[][] = [];
  for (const index of selection) {
    const last = out[out.length - 1];
    if (last && last[last.length - 1] === index - 1) last.push(index);
    else out.push([index]);
  }
  return out;
}

/** Every displayed character's index in the raw draft, in reading order. */
function rawIndexByDisplayedChar(raw: string): number[] {
  const map: number[] = [];
  for (const span of parseRichSpans(raw)) {
    for (let i = 0; i < span.text.length; i += 1) map.push(span.srcStart + i);
  }
  return map;
}

/** The paragraph as tappable words, each carrying where it really lives. */
export function phraseTokens(raw: string): PhraseToken[] {
  if (!raw) return [];
  const spans = parseRichSpans(raw);
  const displayed = spans.map((span) => span.text).join("");
  const rawIndex = rawIndexByDisplayedChar(raw);
  const tokens: PhraseToken[] = [];
  for (const match of displayed.matchAll(/\S+/g)) {
    const first = match.index ?? 0;
    const last = first + match[0].length - 1;
    if (rawIndex[first] === undefined || rawIndex[last] === undefined) continue;
    tokens.push({
      text: match[0],
      start: rawIndex[first],
      end: rawIndex[last] + 1,
    });
  }
  return tokens;
}

/** Narrow the tappable words to the fragment the confidence question asked
 *  about.
 *
 *  FOUNDER 2026-09-17, locked: the rooting phrase is chosen inside "the whole
 *  fragment suggested for confidence judgement" — not the whole paragraph,
 *  and not only the words the speaker personally marked. Orange means "I
 *  confirmed I deliver these words well" (§4), so the words it can land on
 *  are the words the question was actually put about. A paragraph is often
 *  several sentences and the Confident Voice item is about one of them;
 *  offering all of them let a root be set on delivery nobody evaluated.
 *
 *  `fragment` is the Confident Voice candidate's own quote. It is located in
 *  the draft rather than trusted as an offset, for the reason the lock path
 *  already gives: an accepted emphasis rewraps words in `**` and moves every
 *  raw index after it, while the readable text stays stable.
 *
 *  FALLS BACK TO THE WHOLE PARAGRAPH when the fragment is missing or can no
 *  longer be found — edited away, or reworded since. That is deliberate and
 *  it is the lesser evil: the alternative is a step with nothing tappable on
 *  it, which dead-ends the lock and costs the speaker the orange phrase
 *  entirely. Narrowing is an improvement on the choice, never a gate on it.
 *
 *  Pure.
 */
export function tokensWithinFragment(
  tokens: readonly PhraseToken[],
  raw: string,
  fragment: string | null | undefined,
): PhraseToken[] {
  const needle = (fragment ?? "").trim();
  if (!needle || !raw) return [...tokens];
  const displayed = parseRichSpans(raw)
    .map((span) => span.text)
    .join("");
  const at = displayed.indexOf(needle);
  if (at < 0) return [...tokens];
  const rawIndex = rawIndexByDisplayedChar(raw);
  const lo = rawIndex[at];
  const hi = rawIndex[at + needle.length - 1];
  if (lo === undefined || hi === undefined) return [...tokens];
  // OVERLAP, NOT CONTAINMENT. A token is a whole word — "numbers." carries
  // its full stop — while a quote routinely stops short of it. Requiring the
  // token to sit wholly inside the fragment silently dropped the last word of
  // every fragment that ended on punctuation, which is most of them. The
  // speaker taps words, so a word the fragment reaches into is a word the
  // fragment is about.
  const within = tokens.filter(
    (token) => token.end > lo && token.start <= hi,
  );
  // A fragment that lands between the words — punctuation only, or a partial
  // token — leaves nothing to tap. Same reason as above: show it all rather
  // than show nothing.
  return within.length > 0 ? within : [...tokens];
}

/** A helper-word pick is at most this many words (founder lock 2026-09-30,
 *  B3, contract 13). Phrases saved before the cap are shown as they are —
 *  the cap is on the pick. Four, six 2026-10-12, eight 2026-10-15; the
 *  backend's HELPER_WORDS_MAX (services/slide_helper_words.py) must match. */
export const HELPER_WORDS_MAX = 8;

/** How many words a pick holds; 0 for none. */
export function selectionLength(selection: PhraseSelection | null): number {
  return selection ? selection.length : 0;
}

/** What a tap does to the pick: THE ONE HELPER-WORD RULE for every picker
 *  (the paragraph sheet, the helper-words sheet, the practise sheet, the
 *  Feedback sheet and the walk's picker; build plan D-IT-5).
 *
 *  ANY WORDS, IN ANY ORDER (founder 2026-10-15). A tap on a word adds it, a
 *  tap on a picked word takes it away; taking away the last clears the pick.
 *  At most eight: a tap that would make a ninth does nothing and the same
 *  selection comes back, by identity, so a picker can grey the rest. */
export function nextSelection(
  selection: PhraseSelection | null,
  index: number,
  max: number = HELPER_WORDS_MAX,
): PhraseSelection | null {
  if (!selection) return [index];
  if (selection.includes(index)) {
    const rest = selection.filter((i) => i !== index);
    return rest.length > 0 ? rest : null;
  }
  if (selection.length >= max) return selection;
  return [...selection, index].sort((x, y) => x - y);
}

/** Would a tap on this word change the selection? False once the cap is
 *  reached, for the words not picked; the picker greys those. */
export function canTap(
  selection: PhraseSelection | null,
  index: number,
  max: number = HELPER_WORDS_MAX,
): boolean {
  return nextSelection(selection, index, max) !== selection;
}

/** The pick as the backend stores it.
 *
 *  One run of neighbours: `text` is sliced from the RAW draft, markers
 *  included, because `start` and `end` index that same string. Words picked
 *  apart have no single span: the readable pieces joined with PIECE_SEP and
 *  no offsets.
 */
export function selectionSpan(
  raw: string,
  tokens: readonly PhraseToken[],
  selection: PhraseSelection | null,
): RootPhraseSpan | null {
  if (!selection) return null;
  const pieces = runs(selection);
  if (pieces.length > 1) {
    const text = selectionText(raw, tokens, selection);
    return text ? { text, start: null, end: null } : null;
  }
  const first = tokens[selection[0]];
  const last = tokens[selection[selection.length - 1]];
  if (!first || !last || last.end <= first.start) return null;
  return {
    text: raw.slice(first.start, last.end),
    start: first.start,
    end: last.end,
  };
}

/** The pick as a reader sees it — no marker characters, pieces joined with
 *  PIECE_SEP in the order said.
 *
 *  This is what gets carried to the lock step rather than the raw span,
 *  because the draft can still change between choosing the words and locking
 *  them (an accepted emphasis rewraps them in `**`). Re-resolving the readable
 *  text against the final draft is stable across that; a raw offset is not.
 */
export function selectionText(
  raw: string,
  tokens: readonly PhraseToken[],
  selection: PhraseSelection | null,
): string | null {
  if (!selection) return null;
  const pieces = runs(selection).map((run) => {
    const first = tokens[run[0]];
    const last = tokens[run[run.length - 1]];
    if (!first || !last) return "";
    return stripRichMarkers(raw.slice(first.start, last.end)).trim();
  });
  if (pieces.some((p) => !p)) return null;
  if (pieces.length === 1) return pieces[0];
  // Picked apart, each piece reads as words: no trailing comma or stop.
  const words = pieces.map((p) => p.replace(/[.,;:!?…]+$/u, ""));
  return words.every(Boolean) ? words.join(PIECE_SEP) : null;
}

/** Where a quote sits in the raw draft, for the emphasis -> lock promotion.
 *
 *  The emphasised words are already known — the speaker accepted them — so
 *  this finds them rather than asking again. It matches on the DISPLAYED text
 *  and returns raw coordinates, so a quote that reads `surprised us` still
 *  resolves after the emphasis wrapped it as `**surprised us**`.
 *
 *  `null` when the quote is absent or appears more than once: an ambiguous
 *  anchor is not worth guessing at, and the paragraph simply locks without
 *  one.
 */
export function quoteSpan(raw: string, quote: string): RootPhraseSpan | null {
  const needle = (quote || "").trim();
  if (!raw || !needle) return null;
  const pieces = phrasePieces(needle);
  if (pieces.length > 1) {
    return pieces.every((p) => quoteSpan(raw, p)) ? { text: pieces.join(PIECE_SEP), start: null, end: null } : null;
  }
  const spans = parseRichSpans(raw);
  const displayed = spans.map((span) => span.text).join("");
  const at = displayed.indexOf(needle);
  if (at < 0 || at !== displayed.lastIndexOf(needle)) return null;
  const rawIndex = rawIndexByDisplayedChar(raw);
  const start = rawIndex[at];
  const end = rawIndex[at + needle.length - 1];
  if (start === undefined || end === undefined) return null;
  return { text: raw.slice(start, end + 1), start, end: end + 1 };
}

/** Saved helper words as a selection of the paragraph's words, so a screen
 *  can draw them pressed (the replayed walk, Q-IT643b A). Null when a piece
 *  cannot be found once, the pieces are out of order, or there are more than
 *  eight words: nothing is guessed. */
export function phraseSelection(raw: string, phrase: string | null | undefined): PhraseSelection | null {
  const tokens = phraseTokens(raw);
  const out: number[] = [];
  for (const piece of phrasePieces(stripRichMarkers(phrase ?? ""))) {
    const span = quoteSpan(raw, piece);
    if (!span || span.start === null || span.end === null) return null;
    const { start, end } = span;
    tokens.forEach((t, i) => {
      if (t.end > start && t.start < end) out.push(i);
    });
  }
  const ascending = out.every((v, i) => i === 0 || v > out[i - 1]);
  if (out.length === 0 || !ascending || out.length > HELPER_WORDS_MAX) return null;
  return out;
}
