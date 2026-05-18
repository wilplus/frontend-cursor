/**
 * AI chat-bubble length cap.
 *
 * The onboarding chat reads better when each AI bubble is short and
 * snappy — long paragraphs feel like email, not conversation. Every
 * AI-authored bubble pushed into the thread gets passed through
 * `splitAiBubbleText` first, which breaks the text into ≤75-char
 * chunks at sentence boundaries (fall back to word boundaries when a
 * single sentence exceeds the cap).
 *
 * The ONE exception is KB-sourced Q&A answers returned from
 * /v2/chat/query. Those represent a longer, structured response from
 * the master document and are rendered as a single bubble verbatim —
 * splitting them at arbitrary 75-char points would mangle the
 * citations and reading flow.
 */

export const MAX_AI_BUBBLE_CHARS = 75;

/**
 * Split AI bubble text into ≤`max`-char chunks.
 *
 * Heuristic, in priority order:
 *   1. Empty → empty array (caller should skip the push entirely).
 *   2. Length ≤ max → return as a single chunk verbatim.
 *   3. Sentence-pack: split into sentences via lookbehind on `.!?`,
 *      then greedily pack consecutive sentences into chunks until
 *      adding the next would exceed `max`.
 *   4. Word-fallback: if a single sentence is longer than `max`,
 *      flush the current chunk and split that sentence by whitespace,
 *      again packing greedily.
 *   5. Pathological words longer than `max` (rare in chat input)
 *      emit as their own oversized chunk — better than breaking
 *      mid-word, which would read worse.
 */
export function splitAiBubbleText(
  text: string,
  max: number = MAX_AI_BUBBLE_CHARS
): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= max) return [trimmed];

  // Sentence-level pass. The lookbehind keeps the punctuation on the
  // preceding sentence; the split point is the whitespace right after.
  const sentences = trimmed
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const chunks: string[] = [];
  let cur = "";

  for (const sentence of sentences) {
    if (sentence.length <= max) {
      const candidate = cur ? `${cur} ${sentence}` : sentence;
      if (candidate.length <= max) {
        cur = candidate;
      } else {
        if (cur) chunks.push(cur);
        cur = sentence;
      }
      continue;
    }

    // Sentence itself is too long — flush whatever's in `cur` and
    // pack words greedily within the cap.
    if (cur) {
      chunks.push(cur);
      cur = "";
    }
    const words = sentence.split(/\s+/);
    let bucket = "";
    for (const w of words) {
      const candidate = bucket ? `${bucket} ${w}` : w;
      if (candidate.length <= max) {
        bucket = candidate;
      } else {
        if (bucket) chunks.push(bucket);
        bucket = w; // word may itself be > max; emit alone next round
      }
    }
    if (bucket) chunks.push(bucket);
  }

  if (cur) chunks.push(cur);
  return rebalanceTail(chunks, max);
}

/**
 * Post-process for word-fallback's stranded-tail problem.
 *
 * The greedy packer in `splitAiBubbleText` walks word-by-word and
 * flushes the current bucket the instant the next word would push
 * it past `max`. That produces a bad UX when the very last word(s)
 * form a tiny chunk (e.g. "analysis?" alone after "…about the voice"):
 * the reader sees a noun phrase split mid-thought and an awkward
 * one-word bubble at the end.
 *
 * Heuristic fix: if the LAST chunk is meaningfully shorter than the
 * cap (< 40% of `max`) AND merging it back into the previous chunk
 * stays within the SOFT cap (1.2 × `max`), do the merge. The result
 * is one slightly-oversized bubble instead of one normal + one
 * stranded bubble. The 75-char cap is a UX target, not a hard
 * contract — overshooting by 20% to keep a noun phrase intact reads
 * better than the alternative.
 *
 * Only the tail is rebalanced; middle chunks aren't second-guessed
 * because the greedy packer already produces reasonable boundaries
 * there.
 */
function rebalanceTail(chunks: string[], max: number): string[] {
  if (chunks.length < 2) return chunks;
  const STRANDED_TAIL_MAX = Math.floor(max * 0.4);
  const SOFT_OVERFLOW_MAX = Math.floor(max * 1.2);
  const last = chunks[chunks.length - 1];
  const prev = chunks[chunks.length - 2];
  if (
    last.length <= STRANDED_TAIL_MAX &&
    prev.length + 1 + last.length <= SOFT_OVERFLOW_MAX
  ) {
    return [...chunks.slice(0, -2), `${prev} ${last}`];
  }
  return chunks;
}
