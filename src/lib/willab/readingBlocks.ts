/* -------------------------------------------------------------------------- */
/*  readingBlocks — break a run of ideal text into readable blocks             */
/*                                                                            */
/*  Founder 2026-07-27: the ideal text should be separated between paragraphs, */
/*  and no block should run much past five lines without a space.              */
/*                                                                            */
/*  Two things were wrong on screen. The served text separates its blocks with */
/*  a SINGLE "\n", which `white-space: pre-line` renders as a bare line break  */
/*  with no gap, so the whole document read as one wall. And the closing block */
/*  ran fourteen lines, which no amount of paragraph spacing fixes.            */
/*                                                                            */
/*  This returns the blocks WITH THEIR SOURCE OFFSETS and never edits a        */
/*  character: the caller draws the space between them. That matters because   */
/*  key-point tints, star anchors and the user-edit PUT all index the served   */
/*  text — inserting whitespace into it would slide every offset after the     */
/*  insertion and paint the wrong words.                                       */
/* -------------------------------------------------------------------------- */

export interface ReadingBlock {
  text: string;
  /** Where `text` starts in the run it came from. */
  offset: number;
}

/** Roughly five lines ON A PHONE, which is where this is read. A budget in
 *  CHARACTERS rather than lines on purpose: lines are a layout outcome that
 *  depends on width and font, so counting them would make this untestable and
 *  would give a different answer on every device.
 *
 *  Sized against the narrow measure, not the wide one. At 390px the column
 *  holds ~44 characters a line, so five lines is ~220 — a budget picked for
 *  desktop's 65ch measure would be ~320 and run to nine lines on the phone,
 *  which is the wall of text this exists to break up. Erring short costs a
 *  desktop reader an extra gap; erring long costs a phone reader the whole
 *  point. */
export const READING_BLOCK_CHARS = 220;

/** End of a sentence: .?! optionally closed by a quote or bracket, then space. */
const SENTENCE_END = /[.!?]["'”’)\]]*\s+/g;

/** Split one run at sentence boundaries so no piece exceeds `maxChars`, unless
 *  a single sentence is longer than that on its own — a sentence is never cut
 *  mid-way, because a break mid-thought reads worse than a long block. */
function splitLongRun(text: string, offset: number, maxChars: number): ReadingBlock[] {
  if (text.length <= maxChars) return [{ text, offset }];

  // Every sentence boundary in this run, as the index just past the space.
  const bounds: number[] = [];
  SENTENCE_END.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SENTENCE_END.exec(text)) !== null) bounds.push(m.index + m[0].length);
  if (bounds.length === 0) return [{ text, offset }];

  const out: ReadingBlock[] = [];
  let start = 0;
  let lastFit = -1;
  for (const b of bounds) {
    if (b - start <= maxChars) {
      lastFit = b; // still within budget — keep extending
      continue;
    }
    // This boundary overshoots. Cut at the last one that fitted; if none did,
    // the sentence itself is over budget, so cut here rather than never.
    const cut = lastFit > start ? lastFit : b;
    out.push({ text: text.slice(start, cut).trimEnd(), offset: offset + start });
    start = cut;
    lastFit = -1;
  }
  if (start < text.length) {
    out.push({ text: text.slice(start), offset: offset + start });
  }
  return out.filter((b) => b.text.length > 0);
}

/** Split a run into reading blocks: at every newline, then at sentence
 *  boundaries wherever a block would still run past the budget.
 *
 *  The separating newlines are NOT part of the returned blocks — the caller
 *  renders the gap. Offsets always point back into the input. */
export function readingBlocks(
  text: string,
  maxChars: number = READING_BLOCK_CHARS
): ReadingBlock[] {
  if (!text) return [];
  const out: ReadingBlock[] = [];
  let at = 0;
  const pushRun = (end: number) => {
    const raw = text.slice(at, end);
    const lead = raw.length - raw.trimStart().length;
    const body = raw.trim();
    if (body) out.push(...splitLongRun(body, at + lead, maxChars));
  };
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "\n") continue;
    pushRun(i);
    at = i + 1;
  }
  pushRun(text.length);
  return out;
}
