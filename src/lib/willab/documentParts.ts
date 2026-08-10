import { splitSegments } from "./documentSegments";

/* -------------------------------------------------------------------------- */
/*  documentParts — the ideal text as an ordered list of parts with STABLE ids  */
/*  (SPEC-parts-locking-and-layers §3.1, Step 0).                              */
/*                                                                            */
/*  Identity only. Nothing here locks anything; PR 3 hangs the lock on the id  */
/*  this file keeps alive.                                                    */
/*                                                                            */
/*  WHY AN ID AND NOT A POSITION. A lock has to survive both REORDERING and    */
/*  REWORDING. An array index shifts on reorder — and `splitSegments` drops    */
/*  empty segments, so it shifts on edits that are not reorders at all. A      */
/*  content hash dies the moment an approved accentuation touches the words,   */
/*  and locked text is exactly the text that keeps being restyled. A character */
/*  offset needs re-anchoring on every edit, which is a second segmentation    */
/*  problem beside the one F1 already owns.                                    */
/*                                                                            */
/*  IDS ARE MINTED HERE, CLIENT-SIDE, and this is deliberate. The paragraph    */
/*  split is marker-aware — `splitBadgeParagraphSpans` refuses a split point   */
/*  inside a rich-marker token, because a fold marker may legally contain a    */
/*  blank line and slicing it leaks raw syntax. A backend mirror of that       */
/*  scanner would be a SECOND definition of "paragraph", and the two would     */
/*  drift on exactly the documents where the split is hard. One splitter, in   */
/*  one place; the backend validates and stores what it is sent.               */
/*                                                                            */
/*  Pure — no React, no fetch. The arranger drives it; the host persists it.   */
/* -------------------------------------------------------------------------- */

export interface Part {
  /** Stable across reorder and reword. Never regenerated for the same part. */
  id: string;
  text: string;
  /** SPEC §4 — locked sections take ACCENTUATION only (styling), open ones
   *  take COMPOSITION (rewrites). Server-owned: absent/false until the BE says
   *  otherwise, and never set optimistically from a failed request. */
  locked?: boolean;
}

/** A v4 uuid. `crypto.randomUUID` where it exists (every current browser on a
 *  secure origin), else built from `getRandomValues`.
 *
 *  The fallback is not paranoia: `randomUUID` is undefined on a NON-SECURE
 *  origin, which is every plain-http preview and LAN device test. Without it,
 *  minting would throw on exactly the surfaces used to check a change before
 *  it ships. The format has to be a real v4 either way — the backend validates
 *  the shape and refuses "some string". */
export function newPartId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  const b = new Uint8Array(16);
  if (c && typeof c.getRandomValues === "function") c.getRandomValues(b);
  else for (let i = 0; i < 16; i += 1) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // variant 10
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0"));
  return (
    h.slice(0, 4).join("") +
    "-" +
    h.slice(4, 6).join("") +
    "-" +
    h.slice(6, 8).join("") +
    "-" +
    h.slice(8, 10).join("") +
    "-" +
    h.slice(10, 16).join("")
  );
}

/** The parts back into the document the PUT sends. MIRRORS the backend's
 *  `joined()` and the existing `joinSegments`: trim, drop blanks, join on a
 *  blank line. The backend refuses a payload whose parts do not join to its
 *  text, so this is the mapping both sides check against. */
export function partsToText(parts: readonly Part[]): string {
  return parts
    .map((p) => p.text.trim())
    .filter((t) => t.length > 0)
    .join("\n\n");
}

/** Derive parts for `text`, KEEPING the ids of `prev` wherever the words are
 *  unchanged.
 *
 *  This is what makes an id stable rather than merely unique. The document can
 *  be rewritten underneath the student by a new take assembling or a coach
 *  verifying — neither goes through the arranger — and re-minting every id
 *  there would discard every lock PR 3 hangs on them, including on the
 *  paragraphs that did not change.
 *
 *  TWO PASSES, and the order is the whole design. §3.1 requires an id to
 *  survive reordering AND rewording, and a single monotonic pass gets only the
 *  second: `A B C` → `C A B` matches C, then runs off the end and re-mints A
 *  and B. A single FREE pass gets only the first: a document that legitimately
 *  repeats a paragraph lets a later copy claim an earlier one's id, and the two
 *  swap identity on the next reorder. So:
 *
 *    1. UNIQUE text, in both lists → match wherever it moved to. A paragraph
 *       that appears exactly once on each side can only be the same part, and
 *       position tells you nothing extra.
 *    2. everything left (the repeats) → first unused with equal text, in
 *       reading order. Two identical paragraphs are textually
 *       indistinguishable, so reading order is the only rule that is not a
 *       guess — and because the words are identical, which of the two keeps
 *       which id is unobservable in the document.
 *
 *  Whatever matches nothing is genuinely new words and gets a new id. That is
 *  the honest answer: a paragraph the machine rewrote is not the part the
 *  student locked, and carrying the id across would keep a lock over text they
 *  never approved. */
export function reconcileParts(
  text: string,
  prev: readonly Part[] = []
): Part[] {
  const texts = splitSegments(text);
  const prevTexts = prev.map((p) => p.text.trim());

  const count = (list: readonly string[]) => {
    const m = new Map<string, number>();
    for (const t of list) m.set(t, (m.get(t) ?? 0) + 1);
    return m;
  };
  const nextCounts = count(texts);
  const prevCounts = count(prevTexts);

  const used = new Array(prev.length).fill(false);
  const out: Array<Part | null> = new Array(texts.length).fill(null);

  // Pass 1 — unique on both sides. Survives an arbitrary reorder.
  texts.forEach((t, i) => {
    if (nextCounts.get(t) !== 1 || prevCounts.get(t) !== 1) return;
    const at = prevTexts.indexOf(t);
    if (at < 0 || used[at]) return;
    used[at] = true;
    out[i] = { id: prev[at].id, text: t, locked: prev[at].locked };
  });

  // Pass 2 — the repeats, in reading order.
  texts.forEach((t, i) => {
    if (out[i]) return;
    for (let j = 0; j < prev.length; j += 1) {
      if (!used[j] && prevTexts[j] === t) {
        used[j] = true;
        out[i] = { id: prev[j].id, text: t, locked: prev[j].locked };
        return;
      }
    }
    out[i] = { id: newPartId(), text: t };
  });

  return out as Part[];
}

/** The parts to render and edit, given the served document and whatever the
 *  server stored.
 *
 *  The served list wins ONLY when it joins back to the served text. A stored
 *  list that does not is stale — written against a document the student is no
 *  longer looking at — and honouring it would anchor identity to words that
 *  are not on screen. Falling back to a fresh derivation is the same "never
 *  re-point a moved anchor" rule the tracked-change lane already follows. */
export function partsForDocument(
  text: string,
  served: readonly Part[] | null | undefined
): Part[] {
  if (served && served.length > 0 && partsToText(served) === text.trim()) {
    return served.map((p) => ({ id: p.id, text: p.text, locked: p.locked }));
  }
  return reconcileParts(text, served ?? []);
}

/* --- the arranger's operations, on parts rather than strings --------------- */
/*  Same semantics as documentSegments', so behaviour is unchanged; the whole
 *  difference is that a part carries its id THROUGH the operation instead of
 *  being re-derived from its new position afterwards.                        */

/** Move the part at `from` so it lands at index `to` in the RESULT list.
 *  Out-of-range or no-op moves return the input untouched, so a caller can
 *  compare by identity and skip marking the document dirty. */
export function movePart(parts: Part[], from: number, to: number): Part[] {
  if (from < 0 || from >= parts.length) return parts;
  const target = Math.max(0, Math.min(to, parts.length - 1));
  if (target === from) return parts;
  const next = parts.slice();
  const [moved] = next.splice(from, 1);
  next.splice(target, 0, moved);
  return next;
}

/** Insert new words at gap `at` (0 = before the first part, length = after the
 *  last). Blank input is refused — a tap that adds nothing is not an edit. */
export function insertPart(parts: Part[], at: number, text: string): Part[] {
  const words = text.trim();
  if (!words) return parts;
  const target = Math.max(0, Math.min(at, parts.length));
  const next = parts.slice();
  next.splice(target, 0, { id: newPartId(), text: words });
  return next;
}

/** Replace the words of one part, KEEPING its id — a reword is the same part
 *  saying something different, which is the whole reason identity is stored
 *  rather than derived from the words. Blank clears the part. */
export function updatePart(parts: Part[], at: number, text: string): Part[] {
  if (at < 0 || at >= parts.length) return parts;
  const words = text.trim();
  if (parts[at].text === words) return parts;
  const next = parts.slice();
  if (!words) next.splice(at, 1);
  else next[at] = { id: parts[at].id, text: words, locked: parts[at].locked };
  return next;
}

/** Drop a part out of the document. Its id goes with it and is never reused. */
export function removePart(parts: Part[], at: number): Part[] {
  if (at < 0 || at >= parts.length) return parts;
  const next = parts.slice();
  next.splice(at, 1);
  return next;
}
