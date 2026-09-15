/** Tap-to-select for the rooting phrase, in RAW-DRAFT coordinates.
 *
 *  Founder 2026-09-15: the text field is gone. The paragraph renders as
 *  tappable words — tap to start a run, tap an adjacent word to extend it, tap
 *  inside to shorten it — and the tapped words render in the accent, because
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

export interface PhraseSelection {
  from: number;
  to: number;
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

/** What a tap does to the current run.
 *
 *  `null` means nothing is selected. Tapping the only selected word clears it,
 *  so a speaker can always get back to "no phrase" without a separate control.
 */
export function nextSelection(
  selection: PhraseSelection | null,
  index: number,
): PhraseSelection | null {
  if (!selection) return { from: index, to: index };
  const { from, to } = selection;
  if (index === to + 1) return { from, to: index };
  if (index === from - 1) return { from: index, to };
  if (index >= from && index <= to) {
    if (from === to) return null;
    // Tapping inside shortens: the run now ends where the finger landed.
    return { from, to: index };
  }
  return { from: index, to: index };
}

/** The selected run as the span the backend stores.
 *
 *  `text` is sliced from the RAW draft, markers included, because `start` and
 *  `end` index that same string — a span whose text disagreed with its offsets
 *  would be a different phrase depending on which field a reader trusted.
 */
export function selectionSpan(
  raw: string,
  tokens: readonly PhraseToken[],
  selection: PhraseSelection | null,
): RootPhraseSpan | null {
  if (!selection) return null;
  const first = tokens[selection.from];
  const last = tokens[selection.to];
  if (!first || !last || last.end <= first.start) return null;
  return {
    text: raw.slice(first.start, last.end),
    start: first.start,
    end: last.end,
  };
}

/** The selected run as a reader sees it — no marker characters.
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
  const span = selectionSpan(raw, tokens, selection);
  if (!span) return null;
  const readable = stripRichMarkers(span.text).trim();
  return readable || null;
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
