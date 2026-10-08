/* -------------------------------------------------------------------------- */
/*  THE CLEARER VERSION'S WORDS (build plan D-FW-15; founder lock 2026-10-06,  */
/*  flow 6).                                                                  */
/*                                                                            */
/*  The served rewrite is a pair: the speaker's words the Manager anchored on */
/*  (`quote`, the span the Feedback sheet crosses out) and the words offered */
/*  in their place (`proposedText`). The walk draws that same pair, marking  */
/*  only what differs: in the speaker's words the words that go are crossed  */
/*  out, in the new text the words that arrive are orange. The words both    */
/*  share stay plain. Nothing is added or reworded: every piece is a slice   */
/*  of the served text, in order, so the pieces join back into it exactly.   */
/*                                                                            */
/*  Pure. No number, read or score is an input or an output (AC-9).          */
/* -------------------------------------------------------------------------- */

/** One run of words: `cut` goes (crossed out), `fresh` arrives (orange). */
export type ClearerPiece = { text: string; cut?: boolean; fresh?: boolean };

export type ClearerPieces = { before: ClearerPiece[]; after: ClearerPiece[] };

/** Words, single marks and the spaces between them, in order. */
const TOKEN = /\s+|[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*|[^\s\p{L}\p{N}]/gu;

/** Past this many word pairs the comparison is not worth making: the whole
 *  span is marked, exactly as the Feedback sheet marks it. */
const MAX_PAIRS = 40_000;

const isSpace = (t: string) => /^\s+$/.test(t);

/** Which words of `a` and `b` are shared, by their longest common run. */
function shared(a: readonly string[], b: readonly string[]): [boolean[], boolean[]] {
  const inA = a.map(() => false);
  const inB = b.map(() => false);
  if (a.length * b.length > MAX_PAIRS) return [inA, inB];
  const rows = a.length + 1;
  const cols = b.length + 1;
  const len = new Uint16Array(rows * cols);
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      len[i * cols + j] =
        a[i] === b[j]
          ? len[(i + 1) * cols + j + 1] + 1
          : Math.max(len[(i + 1) * cols + j], len[i * cols + j + 1]);
    }
  }
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      inA[i] = true;
      inB[j] = true;
      i += 1;
      j += 1;
    } else if (len[(i + 1) * cols + j] >= len[i * cols + j + 1]) {
      i += 1;
    } else {
      j += 1;
    }
  }
  return [inA, inB];
}

/** The tokens as runs: a word is marked unless shared; a space is marked
 *  only between two marked words, so a run never starts or ends on one. */
function runs(tokens: readonly string[], keep: readonly boolean[], mark: "cut" | "fresh"): ClearerPiece[] {
  const words: number[] = [];
  tokens.forEach((t, i) => {
    if (!isSpace(t)) words.push(i);
  });
  const marked = tokens.map(() => false);
  words.forEach((tokenAt, w) => {
    marked[tokenAt] = !keep[w];
  });
  tokens.forEach((t, i) => {
    if (isSpace(t)) marked[i] = i > 0 && i < tokens.length - 1 && marked[i - 1] && marked[i + 1];
  });
  const out: ClearerPiece[] = [];
  tokens.forEach((t, i) => {
    const last = out[out.length - 1];
    if (last && Boolean(last[mark]) === marked[i]) {
      last.text += t;
      return;
    }
    out.push(marked[i] ? { text: t, [mark]: true } : { text: t });
  });
  return out;
}

/** The served pair as the walk draws it. Null when either side is empty:
 *  a rewrite with nothing to offer is not drawn (nothing is made up). */
export function clearerPieces(quote: string | null | undefined, proposed: string | null | undefined): ClearerPieces | null {
  const said = (quote ?? "").trim();
  const offered = (proposed ?? "").trim();
  if (!said || !offered) return null;
  const a = said.match(TOKEN) ?? [];
  const b = offered.match(TOKEN) ?? [];
  const [keepA, keepB] = shared(
    a.filter((t) => !isSpace(t)),
    b.filter((t) => !isSpace(t)),
  );
  return { before: runs(a, keepA, "cut"), after: runs(b, keepB, "fresh") };
}
