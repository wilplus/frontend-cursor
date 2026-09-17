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

export interface WheelGestureState {
  lastAt: number | null;
  direction: 1 | -1 | null;
  boundaryDelta: number;
  advanced: boolean;
}

export const IDLE_WHEEL_GESTURE: WheelGestureState = {
  lastAt: null,
  direction: null,
  boundaryDelta: 0,
  advanced: false,
};

export type WheelGestureAction =
  | "scroll-inner"
  | "advance-screen"
  | "swallow";

/** Browser wheel events do not expose a physical trackpad gesture. Treat a
 * quiet gap as a new gesture, accumulate intent at a slide boundary, advance
 * once, then swallow that gesture's entire momentum tail. */
export function wheelGestureStep(
  state: WheelGestureState,
  input: {
    deltaY: number;
    now: number;
    innerCanScroll: boolean;
    quietMs?: number;
    boundaryThreshold?: number;
  }
): { state: WheelGestureState; action: WheelGestureAction } {
  const dir: 1 | -1 = input.deltaY > 0 ? 1 : -1;
  const quietMs = input.quietMs ?? 120;
  const threshold = input.boundaryThreshold ?? 18;
  const fresh =
    state.lastAt === null ||
    input.now - state.lastAt > quietMs;
  const current = fresh ? IDLE_WHEEL_GESTURE : state;

  if (current.advanced) {
    return {
      state: { ...current, lastAt: input.now },
      action: "swallow",
    };
  }

  if (input.innerCanScroll) {
    return {
      state: {
        lastAt: input.now,
        direction: dir,
        boundaryDelta: 0,
        advanced: false,
      },
      action: "scroll-inner",
    };
  }

  const boundaryDelta =
    current.direction === dir
      ? current.boundaryDelta + Math.abs(input.deltaY)
      : Math.abs(input.deltaY);
  const advanced = boundaryDelta >= threshold;
  return {
    state: {
      lastAt: input.now,
      direction: dir,
      boundaryDelta,
      advanced,
    },
    action: advanced ? "advance-screen" : "swallow",
  };
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

/* ── §11.7.2/§11.7.3 — THE SCREEN GRAIN (founder, 2026-08-14) ────────────────
 * A SCREEN is the slide's display unit: at most ~3 chunks (~9 lines at the
 * §11.1 ~4-line chunk grain) visible at once. A slide with more chunks
 * CONTINUES on further screens — same slide, next screen — and the rail
 * makes the continuation visible. The hierarchy is slide → screen → chunk;
 * the nested-scroll rule above is unchanged, it just steps between SCREENS
 * (each screen keeps its own inner chunk scroller). */

/** How many chunks one screen holds (~3 × ~4 lines ≈ the founder's ~9). */
export const SCREEN_MAX_CHUNKS = 3;

export interface DeckScreenModel<T> {
  /** The slide this screen belongs to (macro). */
  slideIndex: number | null;
  /** 0-based position of this screen WITHIN its slide (continuation). */
  screenOfSlide: number;
  /** How many screens the slide spans — 1 = no continuation. */
  screensInSlide: number;
  chunks: T[];
}

/** What one screen can actually hold, measured from the rendered deck.
 *
 *  FOUNDER 2026-09-17: "divide the text into two or more screens when the
 *  text for the slide is longer — make it one screen view for the text, and
 *  if it exceeds then you make more screens with the text below, so it all
 *  fits." Reported as being stuck on the third slide, which it was not: the
 *  slide's text simply ran past the bottom of the screen and had to be
 *  scrolled inside, which reads as the deck refusing to move.
 *
 *  All in CSS pixels, read from the live deck rather than assumed — the type
 *  is `clamp()`d to the viewport and the frame around it changes with the
 *  slide preview, so a constant here would be wrong on most screens.
 */
export interface ScreenFit {
  /** Usable height of one screen's chunk area. */
  budgetPx: number;
  /** Rendered height of one line of chunk text. */
  lineHeightPx: number;
  /** Characters that fit on one line at this width and type. */
  charsPerLine: number;
  /** Vertical gap between two chunks on the same screen. */
  gapPx: number;
}

/** How tall a chunk will render, near enough to pack by. Pure.
 *
 *  Character count over characters-per-line is a deliberate approximation:
 *  it cannot know where the words break, so it is within a line either way.
 *  Packing tolerates that — one line of slack costs a little white space,
 *  never a lost paragraph — and the alternative is laying the text out twice
 *  on every render.
 */
export function estimatedChunkHeight(text: string, fit: ScreenFit): number {
  const perLine = Math.max(1, Math.floor(fit.charsPerLine));
  const lines = Math.max(1, Math.ceil((text ?? "").trim().length / perLine));
  return lines * fit.lineHeightPx;
}

/** Cut points that never land inside a `**…**` pair.
 *
 *  Emphasis is stored as markers in the paragraph's own text, so a cut taken
 *  on raw character count alone can separate an opening `**` from its close
 *  — and each half then renders as literal asterisks on the page, which is
 *  the defect the chunk editor was fixed for once already. A whitespace
 *  position is safe only when an even number of `**` sit before it.
 *
 *  Pure. Returns raw indices into `text`, ascending.
 */
export function safeCutPoints(text: string): number[] {
  const out: number[] = [];
  let markers = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "*" && text[i + 1] === "*") {
      markers += 1;
      i += 1;
      continue;
    }
    if (/\s/.test(text[i]) && markers % 2 === 0) out.push(i);
  }
  return out;
}

/** Split one paragraph's text into pieces that each fit a screen. Pure.
 *
 *  FOUNDER 2026-09-17, locked, overruling the never-split rule shipped hours
 *  earlier: a paragraph taller than one screen is SHOWN ACROSS TWO OR MORE
 *  rather than given one screen it has to be scrolled inside. Their reasoning
 *  and it is right: scrolling inside a screen is the thing that read as being
 *  stuck, and reading a long paragraph in two screenfuls is how reading works
 *  anyway.
 *
 *  The cost is the controls, not the reading, and it is paid separately: the
 *  bookmark and Lock repeat on every screen the paragraph touches and each
 *  acts on the WHOLE paragraph. That is why the pieces below carry only
 *  display text — `part.text` stays the entire paragraph, so the lock echo,
 *  the sheet and the identity are untouched by how the words were laid out.
 *
 *  Returns `[text]` unchanged when it already fits, or when there is nowhere
 *  safe to cut (one unbroken word longer than a screen).
 */
export function splitTextToFit(text: string, fit: ScreenFit): string[] {
  const perLine = Math.max(1, Math.floor(fit.charsPerLine));
  // ONE LINE OF SLACK, and it is the difference between this working and
  // nearly working. The height of a piece is ESTIMATED — nothing here can see
  // where the browser will break a line — so aiming at the exact budget lands
  // a line or two over about as often as under, and over means words below
  // the fold, which is the entire defect. Measured in Chromium before this
  // reserve: pieces cut to "exactly one screen" rendered 27px and 57px past
  // it. Reserving a line costs a little white space and cannot overshoot.
  const lines = Math.max(
    1,
    Math.floor(fit.budgetPx / Math.max(1, fit.lineHeightPx)) - 1,
  );
  const perScreen = Math.max(perLine, perLine * lines);
  const body = text ?? "";
  if (body.length <= perScreen) return [body];
  const cuts = safeCutPoints(body);
  if (cuts.length === 0) return [body];
  const pieces: string[] = [];
  let from = 0;
  while (body.length - from > perScreen) {
    // The last safe cut that still fits; if none does, the first one after
    // `from`, because an over-long piece beats an infinite loop.
    const fitting = cuts.filter((at) => at > from && at - from <= perScreen);
    const at = fitting.length > 0
      ? fitting[fitting.length - 1]
      : cuts.find((c) => c > from);
    if (at === undefined) break;
    pieces.push(body.slice(from, at).trim());
    from = at + 1;
  }
  const tail = body.slice(from).trim();
  if (tail) pieces.push(tail);
  return pieces.length > 0 ? pieces : [body];
}

/** Greedy pack: fill a screen, start another when the next chunk will not
 *  fit. Pure.
 *
 *  A chunk taller than the whole budget is SPLIT across screens when
 *  `sliceOf` is given (founder 2026-09-17). Each piece carries display text
 *  only; the caller keeps the paragraph's own identity and full text on every
 *  piece, so the controls repeat and still act on the whole thing.
 *
 *  Without `sliceOf` the over-tall chunk takes a screen of its own and
 *  scrolls, which is what pure callers and the older tests expect.
 */
export function packByFit<T>(
  chunks: readonly T[],
  textOf: (chunk: T) => string,
  fit: ScreenFit,
  sliceOf?: ((chunk: T, text: string, index: number, count: number) => T) | null,
): T[][] {
  if (chunks.length === 0) return [];
  if (!(fit.budgetPx > 0) || !(fit.lineHeightPx > 0)) return [[...chunks]];
  const packs: T[][] = [];
  let current: T[] = [];
  let used = 0;
  const flush = () => {
    if (current.length > 0) packs.push(current);
    current = [];
    used = 0;
  };
  for (const chunk of chunks) {
    const height = estimatedChunkHeight(textOf(chunk), fit);
    // TALLER THAN A WHOLE SCREEN: split it across screens rather than hand it
    // one it has to be scrolled inside (founder 2026-09-17).
    if (sliceOf && height > fit.budgetPx) {
      const pieces = splitTextToFit(textOf(chunk), fit);
      if (pieces.length > 1) {
        flush();
        pieces.forEach((piece, index) =>
          packs.push([sliceOf(chunk, piece, index, pieces.length)]),
        );
        continue;
      }
    }
    const cost = current.length === 0 ? height : height + fit.gapPx;
    if (current.length > 0 && used + cost > fit.budgetPx) {
      flush();
      current = [chunk];
      used = height;
      continue;
    }
    current.push(chunk);
    used += cost;
  }
  flush();
  return packs;
}

/** Split slide groups into screens, in order. Pure; a group with no chunks
 *  still yields one (empty) screen so every slide remains navigable.
 *
 *  With a `fit` the split follows what actually FITS (founder 2026-09-17), so
 *  a long slide continues onto as many screens as its text needs and nothing
 *  has to be scrolled inside one. Without it — before the deck has measured
 *  itself, and in every pure test that does not care — it falls back to the
 *  fixed `maxPerScreen` count this always used.
 */
export function buildScreens<T>(
  groups: readonly { slideIndex: number | null; chunks: readonly T[] }[],
  maxPerScreen: number = SCREEN_MAX_CHUNKS,
  fit?: {
    fit: ScreenFit;
    textOf: (chunk: T) => string;
    /** Build a display-only piece of an over-tall chunk. Omit to keep the
     *  old behaviour (one screen, scrolled inside). */
    sliceOf?: (chunk: T, text: string, index: number, count: number) => T;
  } | null,
): DeckScreenModel<T>[] {
  const per = Math.max(1, maxPerScreen);
  const out: DeckScreenModel<T>[] = [];
  for (const g of groups) {
    let packs: T[][] = [];
    if (fit) {
      packs = packByFit(g.chunks, fit.textOf, fit.fit, fit.sliceOf ?? null);
    } else {
      for (let i = 0; i < g.chunks.length; i += per) {
        packs.push(g.chunks.slice(i, i + per));
      }
    }
    if (packs.length === 0) packs.push([]);
    packs.forEach((chunks, i) => {
      out.push({
        slideIndex: g.slideIndex,
        screenOfSlide: i,
        screensInSlide: packs.length,
        chunks,
      });
    });
  }
  return out;
}

/** The first screen carrying something the speaker has not seen yet.
 *
 *  COMING BACK FROM THE EMAIL (founder 2026-09-16, §8). The deck used to open
 *  wherever it was left, with a dot on the mark as the only clue, so someone
 *  following an email hunted slide by slide for the one paragraph that had
 *  changed. The unread signal already existed per paragraph; this is the rule
 *  that turns it into a place to land.
 *
 *  Pure, and here rather than in the deck, for the reason chunkSteps.ts gives:
 *  vitest cannot transform .tsx imports, so a rule left inside the component
 *  is a rule no unit test can reach.
 *
 *  Returns null when nothing is unread — and null means "do not move", not
 *  "go to the top". A speaker with nothing waiting keeps the position they
 *  left, which is the behaviour that existed before this.
 */
export function firstUnreadScreenIndex<T>(
  screens: readonly DeckScreenModel<T>[],
  isUnread: (chunk: T) => boolean,
): number | null {
  const index = screens.findIndex((screen) => screen.chunks.some(isUnread));
  return index < 0 ? null : index;
}

/** Where ONE paragraph sits — `{slide, chunk}` — or null if it is not here.
 *
 *  COMING BACK FROM A DECISION (founder 2026-09-17). Their rule for what a
 *  lock does to the screen: "return to the slide, scrolled to that
 *  paragraph". The sheet closes onto the deck, and the deck has to put the
 *  paragraph just settled back under the reader's eye rather than leaving
 *  them wherever the scroller happened to be.
 *
 *  It is addressed by PART ID and looked up fresh, because a lock
 *  REASSEMBLES the document underneath: the served text is recomposed, the
 *  screens are rebuilt, and the paragraph can land on a different screen
 *  than the one it was opened from. A remembered index would point at
 *  whatever moved into that slot. Null means "not in this deck any more",
 *  which is a reason to stay put, never to jump to the top.
 *
 *  Pure — no React, no DOM, like everything else in this file.
 */
export function screenPositionOfPart<T extends { part: { id: string } }>(
  screens: readonly DeckScreenModel<T>[],
  partId: string | null | undefined,
): DeckPosition | null {
  if (!partId) return null;
  for (let slide = 0; slide < screens.length; slide += 1) {
    const chunk = screens[slide].chunks.findIndex(
      (entry) => entry.part.id === partId,
    );
    if (chunk >= 0) return { slide, chunk };
  }
  return null;
}
