import type { DocumentSuggestion } from "@/services/api/idealText";

/* -------------------------------------------------------------------------- */
/*  trackedChanges — the LIVING TRANSCRIPT's span resolution (founder          */
/*  2026-07-20). Pure, so the rules that protect the document are testable:    */
/*                                                                            */
/*   1. VERIFY OR DROP (FE-5). A suggestion is rendered from its span, but     */
/*      only after text.slice(start,end) matches its quote exactly. A stale    */
/*      span (the student edited the text, a newer version shifted it) is      */
/*      DROPPED — never re-anchored by searching for the quote, which would    */
/*      silently strike the wrong words.                                       */
/*   2. DECIDED IS GONE. Anything the server already recorded as approved or   */
/*      dismissed is not re-offered.                                          */
/*   3. NO OVERLAPS. Two suggestions covering the same characters cannot both  */
/*      render; earlier start wins, the loser is dropped (never merged).       */
/*   4. ADVICE IS NOT A TEXT CHANGE. delivery/structural coaching keeps the    */
/*      existing star + modal treatment, so it never draws a strike here.      */
/* -------------------------------------------------------------------------- */

/** One render unit: a plain run, or a run carrying its suggestion. */
export interface TrackedSegment {
  text: string;
  suggestion?: DocumentSuggestion;
}

/** The suggestions that may actually render over `text`, sorted by position
 *  and guaranteed non-overlapping. Pure. */
function verifies(text: string, s: DocumentSuggestion): boolean {
  // Rule 2 — a decided suggestion is history, not an offer.
  if (s.status === "approved" || s.status === "dismissed") return false;
  if (s.end > text.length) return false;
  // Rule 1 — the span must still hold exactly the anchored words.
  return text.slice(s.start, s.end) === s.quote;
}

/** Greedy non-overlapping accept over pre-sorted spans, refusing anything that
 *  intersects a span already taken (including ones taken by a higher-priority
 *  pass). */
function packSpans(
  candidates: DocumentSuggestion[],
  taken: Array<[number, number]>
): DocumentSuggestion[] {
  const out: DocumentSuggestion[] = [];
  const busy = [...taken];
  for (const s of candidates) {
    if (busy.some(([a, b]) => s.start < b && s.end > a)) continue;
    out.push(s);
    busy.push([s.start, s.end]);
  }
  return out;
}

/** The TEXT-CHANGING suggestions that may render (replace + bold), sorted and
 *  non-overlapping. Advice is excluded here — it never alters the text (rule
 *  4); see resolveAdviceSpans. Pure. */
export function resolveTrackedSuggestions(
  text: string,
  suggestions: DocumentSuggestion[] | null
): DocumentSuggestion[] {
  if (!text || !suggestions || suggestions.length === 0) return [];
  const usable = suggestions
    .filter((s) => s.kind !== "advice" && verifies(text, s))
    .sort((a, b) => a.start - b.start || a.end - b.end);
  return packSpans(usable, []);
}

/** The ADVICE spans that may render as coaching stars. Text changes win every
 *  collision (an advice sentence often contains a narrow replace), so they are
 *  packed first and advice only fills what is left. Pure. */
export function resolveAdviceSpans(
  text: string,
  suggestions: DocumentSuggestion[] | null
): DocumentSuggestion[] {
  if (!text || !suggestions || suggestions.length === 0) return [];
  const taken = resolveTrackedSuggestions(text, suggestions).map(
    (s) => [s.start, s.end] as [number, number]
  );
  const usable = suggestions
    .filter((s) => s.kind === "advice" && s.device && verifies(text, s))
    .sort((a, b) => a.start - b.start || a.end - b.end);
  return packSpans(usable, taken);
}

/** Split `text` into plain runs and suggestion runs, in document order.
 *  `hidden` (ids the user just decided in this session) render as plain text
 *  so the tracked change disappears the instant it is accepted or kept. Pure. */
export function buildTrackedSegments(
  text: string,
  suggestions: DocumentSuggestion[] | null,
  hidden?: ReadonlySet<string>
): TrackedSegment[] {
  const accepted = [
    ...resolveTrackedSuggestions(text, suggestions),
    // Advice rides the same segment stream so a coaching star can sit inline
    // in the document; it carries no text change (TrackedText draws a star,
    // never a strike).
    ...resolveAdviceSpans(text, suggestions),
  ]
    .filter((s) => !hidden?.has(s.id))
    .sort((a, b) => a.start - b.start);
  if (accepted.length === 0) return text ? [{ text }] : [];
  const out: TrackedSegment[] = [];
  let cursor = 0;
  for (const s of accepted) {
    if (s.start > cursor) out.push({ text: text.slice(cursor, s.start) });
    out.push({ text: text.slice(s.start, s.end), suggestion: s });
    cursor = s.end;
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor) });
  return out;
}

/** Apply the student's ACCEPTED replacements to the text, right-to-left so
 *  earlier spans keep their offsets. Used for the local optimistic text while
 *  the server reassembles. Pure. */
export function applyAcceptedReplacements(
  text: string,
  suggestions: DocumentSuggestion[],
  acceptedIds: ReadonlySet<string>
): string {
  const hits = resolveTrackedSuggestions(text, suggestions)
    .filter((s) => acceptedIds.has(s.id) && s.kind === "replace" && s.proposedText)
    .sort((a, b) => b.start - a.start);
  let out = text;
  for (const s of hits) {
    out = out.slice(0, s.start) + (s.proposedText ?? "") + out.slice(s.end);
  }
  return out;
}

/** Re-express document-level suggestions inside a paragraph slice: only the
 *  ones FULLY within [start, end) survive, rebased to paragraph-local
 *  offsets. A suggestion straddling a paragraph boundary is dropped (it
 *  cannot be drawn in one paragraph). Pure. */
export function rebaseSuggestionsToSpan(
  suggestions: DocumentSuggestion[] | null,
  span: { start: number; end: number }
): DocumentSuggestion[] | null {
  if (!suggestions) return null;
  return suggestions
    .filter((s) => s.start >= span.start && s.end <= span.end)
    .map((s) => ({ ...s, start: s.start - span.start, end: s.end - span.start }));
}
