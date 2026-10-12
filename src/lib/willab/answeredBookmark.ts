/* A paragraph's helper words and whether it opens its own sheet.
 *
 * Pure, so the sheet stays a renderer and the rules are tested here. Words
 * only: no score, band, rank or count reaches the screen (AC-9).
 */

/** One headline per PARAGRAPH (founder 2026-09-26, superseding Q12 A's one
 *  headline per Slide): the helper words sit directly above the paragraph
 *  they came from, like a newspaper headline over its own article (contract
 *  clause 20, "above the Paragraph"). A paragraph with more than one set joins
 *  them in pick order. Paragraphs without helper words get no entry. */
export function paragraphHeadlines(
  roots: readonly { partId: string; text: string }[],
): Map<string, string> {
  const byPart = new Map<string, string[]>();
  for (const root of roots) {
    const text = root.text.trim();
    if (!text) continue;
    const list = byPart.get(root.partId) ?? [];
    if (!list.includes(text)) list.push(text);
    byPart.set(root.partId, list);
  }
  const out = new Map<string, string>();
  for (const [part, list] of byPart) out.set(part, list.join(" · "));
  return out;
}

/** Where a paragraph's helper words stand in its own text, for the italic
 *  inside the running text (founder 2026-09-26). Matched by their words,
 *  ignoring case, because helper words are stored as text rather than as a
 *  position (clause 14) — and a later Take need not say them at all, in which
 *  case there is simply nothing to mark. First occurrence of each phrase. */
export function helperWordRanges(
  text: string,
  headline: string | null | undefined,
): Array<[number, number]> | undefined {
  if (!headline) return undefined;
  const hay = text.toLowerCase();
  const out: Array<[number, number]> = [];
  for (const phrase of headline.split(" · ")) {
    const needle = phrase.trim().toLowerCase();
    if (!needle) continue;
    const at = hay.indexOf(needle);
    if (at >= 0) out.push([at, at + needle.length]);
  }
  return out.length > 0 ? out : undefined;
}

/** Which paragraphs open their own sheet rather than the judgement: nothing
 *  on them is waiting. Answered (Q19 A), locked (Q26 B) — and, since founder
 *  2026-09-26 (J10), a paragraph nobody gave feedback on, which opens on its
 *  latest text and its earlier Takes instead of doing nothing (clause 16: a
 *  bookmark is never an empty screen). */
export function opensParagraphSheet(
  state: {
    pending: readonly { feedbackFamily?: string | null; source?: string | null }[];
    decided?: readonly unknown[];
    locked?: boolean;
  },
  /** The paragraph's helper words are saved (founder lock 2026-09-30, B8,
   *  D9): it is the saved screen whatever else rides it; nothing is judged
   *  on it until the words are deleted. */
  saved = false,
): boolean {
  if (saved) return true;
  // A rewrite or a praise rides its moment (24f) and is shown on the
  // paragraph's own sheet as the practise card (founder lock 2026-09-30,
  // B5); only a Confident Voice judgement still waiting opens the question.
  return !state.pending.some(
    (item) =>
      item.feedbackFamily === "confident_voice" ||
      item.source === "confident_voice",
  );
}
