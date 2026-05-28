/**
 * Approximation of the backend's `word_diff_count(draft, final)` helper —
 * used client-side to drive the >5-word-change save gate on AI-drafted
 * fields (per-snippet admin_comment, session-level AI commentary).
 *
 * Backend implementation (Python, see BE handoff):
 *   - Lowercase + strip punctuation + whitespace-split both strings
 *   - difflib.SequenceMatcher.get_opcodes() over the token sequences
 *   - For each non-"equal" opcode, count max(left-side, right-side) length
 *
 * This file ports the same semantics to JS using an LCS-based diff. The
 * algorithms aren't byte-for-byte identical (Python difflib uses a heuristic
 * matcher; this is a straight LCS), but they agree on the common cases that
 * matter for the gate:
 *   - Identical strings → 0
 *   - Single-word substitution → 1
 *   - Pure inserts/deletes → exact count
 *   - Reordered phrases → counts the swaps
 *   - Case + punctuation differences only → 0
 *
 * The server is the authority. When client diff says 6 and server says 5,
 * the server's 422 wins and the user sees the BE error copy. The client
 * util's only job is to drive a snappy disable-Save UX hint; mismatches at
 * the edge cases just cost a round-trip, not a wrong save.
 */

/**
 * Lowercase + strip punctuation + whitespace-split. Mirrors the BE's
 * `_normalise` helper. Empty / null / whitespace-only input → empty array.
 */
function normalise(s: string | null | undefined): string[] {
  if (!s) return [];
  const lower = s.toLowerCase();
  // Strip anything that isn't a word char or whitespace. Keeping the
  // pattern simple (ASCII-leaning) matches BE's `[^\w\s]` Python regex
  // closely enough for the gate's resolution; perfect Unicode parity
  // isn't needed.
  const stripped = lower.replace(/[^\w\s]/g, " ");
  return stripped.split(/\s+/).filter((t) => t.length > 0);
}

/**
 * Count the number of word-level token changes between `draft` and `final`.
 * Symmetric: insertions + deletions + (max-side) replacements.
 *
 * Returns the full token count of `final` when `draft` is empty — typed-
 * from-scratch content gets full credit (matches BE's empty-draft branch).
 *
 * Per the FE→BE handoff: when the AI draft is null/empty/whitespace, the
 * gate is SKIPPED entirely upstream (don't even call this — see the
 * `shouldGate` helper below). This function still returns a sensible
 * value if called in that case (the absolute token count) so it can also
 * power "X words written" hints if a caller wants that.
 */
export function wordDiffCount(
  draft: string | null | undefined,
  final: string | null | undefined
): number {
  const d = normalise(draft);
  const f = normalise(final);

  if (d.length === 0) return f.length;
  if (f.length === 0) return d.length;

  // Standard LCS table — O(d * f) space, fine for textarea-scale input
  // (comments are dozens of words, not thousands). The diff count is
  // (d.length + f.length - 2 * lcsLength) / 2 by the symmetric-edit
  // formula, but we want the max-side count on replaces to match BE.
  // Easier to walk the opcodes directly.
  const m = d.length;
  const n = f.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0)
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (d[i - 1] === f[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Walk back through the table, accumulating opcodes (equal/insert/
  // delete/replace) the same way difflib.SequenceMatcher does, then
  // apply BE's `max(i2-i1, j2-j1)` per non-equal opcode.
  type Op = { kind: "equal" | "delete" | "insert" | "replace"; len: number };
  const ops: Op[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i - 1] === f[j - 1]) {
      const last = ops[ops.length - 1];
      if (last && last.kind === "equal") last.len += 1;
      else ops.push({ kind: "equal", len: 1 });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      const last = ops[ops.length - 1];
      if (last && last.kind === "insert") last.len += 1;
      else ops.push({ kind: "insert", len: 1 });
      j--;
    } else {
      const last = ops[ops.length - 1];
      if (last && last.kind === "delete") last.len += 1;
      else ops.push({ kind: "delete", len: 1 });
      i--;
    }
  }
  ops.reverse();

  // Coalesce adjacent delete+insert into replace so the max-side count
  // applies. Matches difflib's opcode behaviour where a "replace"
  // emerges from interleaved deletions and insertions.
  const merged: Op[] = [];
  for (const op of ops) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      ((prev.kind === "delete" && op.kind === "insert") ||
        (prev.kind === "insert" && op.kind === "delete"))
    ) {
      const replaceLen = Math.max(prev.len, op.len);
      merged[merged.length - 1] = { kind: "replace", len: replaceLen };
    } else {
      merged.push(op);
    }
  }

  let changed = 0;
  for (const op of merged) {
    if (op.kind === "equal") continue;
    changed += op.len;
  }
  return changed;
}

/**
 * Should the >5-word-change gate apply to this save? FE convenience
 * wrapper around the BE's "skip the gate when there's no AI baseline"
 * rule — see the empty-draft branch in the FE→BE handoff.
 *
 * Returns false when the AI baseline is missing / whitespace-only.
 * Returns true when there's a real baseline to diff against.
 */
export function shouldGate(aiDraft: string | null | undefined): boolean {
  if (!aiDraft) return false;
  return aiDraft.trim().length > 0;
}

/** Server-shared threshold. >5 word-level changes counts as a real
 *  correction. Keep in sync with the BE constant. */
export const WORD_DIFF_THRESHOLD = 5;
