/* -------------------------------------------------------------------------- */
/*  deckScroll — the deck's NESTED SCROLL model (SPEC §11.3, founder           */
/*  2026-08-14).                                                              */
/*                                                                            */
/*  A scroll step advances one CHUNK. While the active slide has chunks       */
/*  below the current one, scroll moves through them and the slide does NOT   */
/*  change; only from the FINAL chunk of the active slide does the next step  */
/*  bubble up and advance to the next slide — and symmetrically backwards     */
/*  from a slide's first chunk (arriving on the previous slide's LAST         */
/*  chunk, because that is where you were when you left it going forward).    */
/*                                                                            */
/*  Everything here is PURE — positions and container metrics in, positions   */
/*  out — so the interception wiring in the component stays a thin shell      */
/*  and the bubbling rule itself is pinned by unit tests. No React, no DOM.   */
/* -------------------------------------------------------------------------- */

export interface DeckPosition {
  /** Index into the slide groups (macro). */
  slide: number;
  /** Index into the active slide's chunks (micro). */
  chunk: number;
}

/** Clamp a position onto a real (slide, chunk) of `counts` — `counts[i]` is
 *  slide i's chunk count. Empty decks clamp to {0, 0}. */
export function clampPosition(
  counts: readonly number[],
  pos: DeckPosition
): DeckPosition {
  if (counts.length === 0) return { slide: 0, chunk: 0 };
  const slide = Math.max(0, Math.min(counts.length - 1, pos.slide));
  const last = Math.max(0, (counts[slide] ?? 1) - 1);
  return { slide, chunk: Math.max(0, Math.min(last, pos.chunk)) };
}

/** One scroll step. THE RULE (§11.3): the chunk is the step, the slide is
 *  the section. Forward from the last chunk bubbles to the next slide's
 *  FIRST chunk; backward from the first chunk bubbles to the previous
 *  slide's LAST chunk. The ends of the deck absorb the step (no wrap). */
export function stepPosition(
  counts: readonly number[],
  pos: DeckPosition,
  dir: 1 | -1
): DeckPosition {
  const at = clampPosition(counts, pos);
  if (counts.length === 0) return at;
  if (dir === 1) {
    const last = (counts[at.slide] ?? 1) - 1;
    if (at.chunk < last) return { slide: at.slide, chunk: at.chunk + 1 };
    if (at.slide < counts.length - 1)
      return { slide: at.slide + 1, chunk: 0 };
    return at;
  }
  if (at.chunk > 0) return { slide: at.slide, chunk: at.chunk - 1 };
  if (at.slide > 0) {
    const prev = at.slide - 1;
    return { slide: prev, chunk: Math.max(0, (counts[prev] ?? 1) - 1) };
  }
  return at;
}

/** Where a scroller stands, from its metrics alone. `"both"` = content
 *  fits (no scrolling possible), which counts as being at EITHER edge —
 *  a slide whose chunks all fit must bubble immediately in both
 *  directions, or short slides would swallow the gesture. */
export function scrollEdge(metrics: {
  scrollTop: number;
  clientHeight: number;
  scrollHeight: number;
}): "top" | "bottom" | "both" | null {
  const { scrollTop, clientHeight, scrollHeight } = metrics;
  // Sub-pixel scroll positions are real (touch momentum, zoom): tolerate.
  const eps = 2;
  const atTop = scrollTop <= eps;
  const atBottom = scrollTop + clientHeight >= scrollHeight - eps;
  if (atTop && atBottom) return "both";
  if (atTop) return "top";
  if (atBottom) return "bottom";
  return null;
}

/** May a gesture in `dir` bubble from chunk-scroll up to the slide? Only
 *  when the inner scroller already stands at the edge the gesture pushes
 *  against — this IS "only when the user reaches the final chunk". */
export function canBubble(
  edge: "top" | "bottom" | "both" | null,
  dir: 1 | -1
): boolean {
  if (edge === "both") return true;
  return dir === 1 ? edge === "bottom" : edge === "top";
}

/** The chunk the reader is on: the last chunk whose top the scroller has
 *  reached (with the same sub-pixel tolerance). Offsets are the chunks'
 *  offsetTop values inside the inner scroller, ascending. */
export function nearestChunkIndex(
  offsets: readonly number[],
  scrollTop: number
): number {
  if (offsets.length === 0) return 0;
  let at = 0;
  for (let i = 0; i < offsets.length; i += 1) {
    if (offsets[i] <= scrollTop + 2) at = i;
  }
  return at;
}

/** Group sizes for the position model — one count per slide group, each at
 *  least 1 so a group always has a standable chunk. */
export function chunkCounts(
  groups: readonly { chunks: readonly unknown[] }[]
): number[] {
  return groups.map((g) => Math.max(1, g.chunks.length));
}
