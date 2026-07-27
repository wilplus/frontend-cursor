/* -------------------------------------------------------------------------- */
/*  richMarkers — the ideal-text marker contract (FE-9, pinned BE-side in       */
/*  services/ideal_text_block.py:5-20; the coach editor, the student notebook   */
/*  and the ideal-text readout all share it):                                   */
/*    **bold**   __underline__   //italic//   {{orange:text}}                   */
/*    [[moment:snippet|session]]text[[/moment]]  (key-moment deep link)         */
/*  Legacy tokens still parse for texts saved before the contract:              */
/*    *italic*   ==highlight==  (highlight renders as the same orange)          */
/*  Stored as-is in the TEXT column; the BE strips only raw HTML and never      */
/*  parses markers except [[moment:]].                                          */
/*                                                                            */
/*  FE-1 (2026-07-27) — THE READER MUST NEVER SEE A MARKER. This used to be a  */
/*  regex that rendered anything malformed "literally, never hide", and the     */
/*  result was `{{orange:` printed to the user mid-paragraph. The five rules    */
/*  below are non-negotiable and are why this is now an explicit scanner:       */
/*                                                                            */
/*   1. FLAT, NOT NESTED. Left to right; the first opener wins until its        */
/*      matching closer. A style token inside an open span is that span's       */
/*      CONTENT for matching purposes — it never opens a nested style. It is    */
/*      then dropped from the output, because rule 3's guarantee is absolute:   */
/*      no character of this grammar ever reaches the reader. (The two rules    */
/*      read as if they disagree — rule 1 says "literal text of that span",     */
/*      rule 3 says never show a brace or an asterisk. Rule 1 is about          */
/*      MATCHING, rule 3 is about OUTPUT, and this is the reading that          */
/*      satisfies both: the token stops being a delimiter, and the words        */
/*      around it all survive.)                                                 */
/*   2. MULTI-LINE TOLERANT. Every span may contain "\n" — a scanner, never a   */
/*      line-by-line regex. An accent straddling a paragraph break was the      */
/*      exact bug. (BE-1 now also emits one accent per line, so the common      */
/*      case is fixed at source, but an old row can still arrive.)              */
/*   3. AN UNMATCHED OPENER IS NEVER SHOWN. No closer before end of text (or    */
/*      before the next same opener) → drop the token, KEEP EVERY WORD, render  */
/*      the rest unstyled. Same for a stray closer.                             */
/*   4. A MOMENT NEEDS BOTH IDS. Missing either → plain text, not a dead tap    */
/*      target. Its wrapper tokens still go.                                    */
/*   5. IDEMPOTENT ON EMPTY. "" is an empty document, not a crash.              */
/*                                                                            */
/*  The one composition exception: a [[moment:…]] wrapper COMPOSES with the     */
/*  marks inside it. It is an annotation, not a style — and the BE's            */
/*  serve-time fold of an approved emphasize is literally                       */
/*  [[moment:…]]{{orange:…}}[[/moment]], so refusing to compose would print     */
/*  that accent as raw syntax and breach rule 3.                                */
/*                                                                            */
/*  INVARIANT (review R-it): wrapSelection's output must always round-trip      */
/*  through parseRichMarkers — the toolbar may wrap ANY selection (mid-word,    */
/*  after a colon, flush against another marker, containing "and/or"), so the   */
/*  italic arm accepts all of those. The only rejection is a "//" immediately   */
/*  preceded by ":" (a URL protocol).                                           */
/* -------------------------------------------------------------------------- */

export interface RichSegment {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  /** The one accent color (orange) — {{orange:…}} and legacy ==…==. */
  highlight: boolean;
  /** Key-moment deep link ([[moment:snippet|session]]…[[/moment]]). Styled
   *  distinctly from a plain underline by every renderer. Optional so plain
   *  segments keep the legacy 5-field shape. */
  moment?: { snippetId: string; sessionId: string };
}

/** A segment plus where its TEXT came from in the source string.
 *
 *  `srcStart`/`srcEnd` bracket the run in the ORIGINAL marker-bearing text,
 *  excluding the tokens themselves. Two consumers need this and neither can
 *  work without it:
 *    · FE-7 tints key points whose start/end index the SERVED text (markers
 *      included), so the offsets have to be mapped through here rather than
 *      computed on the stripped string.
 *    · the styled editor maps a DOM caret back to a marker-text offset.
 *
 *  `open`/`close` preserve the EXACT token pair this span was written with, so
 *  a legacy ==accent== serializes back as ==accent== and an untouched document
 *  round-trips byte-for-byte instead of being silently rewritten to the pinned
 *  spelling. */
export interface RichSpan extends RichSegment {
  srcStart: number;
  srcEnd: number;
  open: string | null;
  close: string | null;
}

export type RichMark = "bold" | "italic" | "underline" | "highlight";

const PLAIN = { bold: false, italic: false, underline: false, highlight: false };

/** The pinned wrappers (FE-9): italic is //…//, the accent is {{orange:…}}. */
const WRAPPERS: Record<RichMark, [string, string]> = {
  bold: ["**", "**"],
  italic: ["//", "//"],
  underline: ["__", "__"],
  highlight: ["{{orange:", "}}"],
};

/** Every style token the scanner recognises, longest first so "**" is never
 *  read as two "*" and "{{orange:" is never read as anything else. Legacy
 *  spellings sit alongside the pinned ones and keep their own tokens. */
const STYLE_TOKENS: Array<{ open: string; close: string; mark: RichMark }> = [
  { open: "{{orange:", close: "}}", mark: "highlight" },
  { open: "**", close: "**", mark: "bold" },
  { open: "__", close: "__", mark: "underline" },
  { open: "==", close: "==", mark: "highlight" },
  { open: "//", close: "//", mark: "italic" },
  { open: "*", close: "*", mark: "italic" },
];

/** Deliberately tolerant of a MISSING pipe. `[[moment:]]` and `[[moment:s]]`
 *  are malformed, but they are unmistakably this grammar's opener, so they have
 *  to be recognised in order to be dropped — requiring the pipe here is how
 *  "[[moment:]]" ended up printed to the reader. Rule 4 then decides whether
 *  the ids are usable. */
const MOMENT_OPEN = /^\[\[moment:([^\]]*)\]\]/;
const MOMENT_CLOSE = "[[/moment]]";

/** "//" that is a URL protocol, not an italic delimiter. Enforced in JS rather
 *  than a regex lookbehind, which throws at parse time on older iOS Safari. */
function isProtocolSlash(text: string, at: number): boolean {
  return text.startsWith("//", at) && at > 0 && text[at - 1] === ":";
}

/** The style token starting exactly at `at`, or null. */
function styleTokenAt(
  text: string,
  at: number
): { open: string; close: string; mark: RichMark } | null {
  for (const t of STYLE_TOKENS) {
    if (!text.startsWith(t.open, at)) continue;
    if (t.open === "//" && isProtocolSlash(text, at)) return null;
    return t;
  }
  return null;
}

/** The first index at or after `from` where `close` appears as a real token.
 *
 *  Rule 3's "(or before the next {{orange:)" lives here: hitting `abort` first
 *  means the opener never had a closer and must be dropped. Symmetric tokens
 *  pass no abort — for those, the next occurrence IS the closer. */
function findCloser(
  text: string,
  from: number,
  close: string,
  abort: string | null
): number {
  for (let i = from; i < text.length; i++) {
    if (abort && text.startsWith(abort, i)) return -1;
    if (!text.startsWith(close, i)) continue;
    // "*" must not match the first half of a "**", and a closing "//" must not
    // be the "//" of a URL.
    if (close === "*" && text.startsWith("**", i)) {
      i++;
      continue;
    }
    if (close === "//" && isProtocolSlash(text, i)) continue;
    return i;
  }
  return -1;
}

interface ScanResult {
  spans: RichSpan[];
  /** Regions of the SOURCE that must never be cut into: each complete marker
   *  construct from its opener through its closer, plus every token dropped on
   *  its own. Three consumers rely on the whole-construct extent rather than
   *  the bare delimiters — segmentIdealText refuses an anchor that would slice
   *  one, splitBadgeParagraphs refuses a paragraph break inside one, and
   *  MomentStars refuses a quote split inside one. */
  tokens: Array<[number, number]>;
}

/** The scanner. One left-to-right pass, no regex over the body. */
function scan(text: string): ScanResult {
  const spans: RichSpan[] = [];
  const tokens: Array<[number, number]> = [];

  // Flat: at most ONE style span open at a time (rule 1). The moment wrapper
  // is tracked separately because it composes rather than nests.
  let style: { mark: RichMark; open: string; close: string } | null = null;
  let moment: { snippetId: string; sessionId: string } | null = null;
  // A wrapper can be open while carrying NO moment (rule 4 — an id was
  // missing). Its closer must still be consumed rather than dropped as a stray,
  // so openness is tracked apart from the ids.
  let wrapperOpen = false;
  let runStart = 0;
  let i = 0;
  // Where the currently open construct's OPENER began, so its closer can
  // record the whole [opener, closer) extent rather than two loose delimiters.
  let styleOpenAt = -1;
  let wrapperOpenAt = -1;

  const flush = (end: number) => {
    if (end <= runStart) return;
    spans.push({
      text: text.slice(runStart, end),
      bold: style?.mark === "bold",
      italic: style?.mark === "italic",
      underline: style?.mark === "underline",
      highlight: style?.mark === "highlight",
      ...(moment ? { moment } : {}),
      srcStart: runStart,
      srcEnd: end,
      open: style?.open ?? null,
      close: style?.close ?? null,
    });
  };

  /** Consume a token at [i, i+len): end the current run, record the guarded
   *  region, and resume the run after it. Every path through the scanner goes
   *  through here, which is why no token can ever reach the output.
   *  `from` overrides the region's start so a closer records the whole
   *  construct it just closed. */
  const consume = (len: number, from = i) => {
    flush(i);
    tokens.push([from, i + len]);
    i += len;
    runStart = i;
  };

  while (i < text.length) {
    // ---- the moment wrapper (composes with whatever style is open) ---------
    if (text.startsWith("[[", i)) {
      // The closer, whether or not a wrapper is open: an open one closes, a
      // stray one is dropped (rule 3). Either way it never reaches the reader.
      if (text.startsWith(MOMENT_CLOSE, i)) {
        consume(MOMENT_CLOSE.length, wrapperOpen ? wrapperOpenAt : i);
        moment = null;
        wrapperOpen = false;
        wrapperOpenAt = -1;
        continue;
      }
      const m = MOMENT_OPEN.exec(text.slice(i));
      if (m) {
        if (wrapperOpen) {
          // An inner opener is content for matching (rule 1) and dropped from
          // the output (rule 3); the words after it keep the outer wrapper.
          consume(m[0].length);
          continue;
        }
        const closes =
          findCloser(text, i + m[0].length, MOMENT_CLOSE, "[[moment:") >= 0;
        const [snippetId = "", sessionId = ""] = m[1].split("|").map((s) => s.trim());
        const openedAt = i;
        consume(m[0].length);
        // Rule 4 — both ids or it is not a tap target. An unclosed wrapper is
        // dropped outright (rule 3). Either way the words inside survive.
        if (closes) {
          wrapperOpen = true;
          wrapperOpenAt = openedAt;
          moment = snippetId && sessionId ? { snippetId, sessionId } : null;
        }
        continue;
      }
    }

    // ---- style tokens ------------------------------------------------------
    // The OPEN span's closer is tested first. "}}" is a closer and not an
    // opener, so leaving this until after the opener scan let it fall through
    // as text and print a brace to the reader — the original defect, one layer
    // down.
    if (
      style !== null &&
      text.startsWith(style.close, i) &&
      !(style.close === "*" && text.startsWith("**", i)) &&
      !(style.close === "//" && isProtocolSlash(text, i))
    ) {
      consume(style.close.length, styleOpenAt);
      style = null;
      styleOpenAt = -1;
      continue;
    }

    const tok = styleTokenAt(text, i);
    if (tok) {
      if (style === null) {
        // An opener only opens if it actually closes (rule 3).
        const closeAt = findCloser(
          text,
          i + tok.open.length,
          tok.close,
          // Asymmetric tokens abort on a second opener; symmetric ones can't.
          tok.open === tok.close ? null : tok.open
        );
        const openedAt = i;
        consume(tok.open.length);
        if (closeAt >= 0) {
          style = { mark: tok.mark, open: tok.open, close: tok.close };
          styleOpenAt = openedAt;
        }
        continue;
      }
      // A different style token inside an open span: content for matching,
      // dropped from the output (rule 1 + rule 3).
      consume(tok.open.length);
      continue;
    }

    // A stray "}}" with no accent open is a grammar character the reader must
    // never see (rule 3). Every other close token is symmetric and is already
    // handled as an opener above.
    if (style === null && text.startsWith("}}", i)) {
      consume(2);
      continue;
    }

    i++;
  }
  flush(text.length);
  return { spans, tokens };
}

/** Split marked text into flat render spans, with source offsets and the exact
 *  tokens each span was written with. Rule 5: "" → no spans. */
export function parseRichSpans(text: string): RichSpan[] {
  if (!text) return [];
  return scan(text).spans;
}

/** Split marked text into flat render segments. The five-field shape every
 *  renderer already consumes; offsets are available via parseRichSpans.
 *  A string that is nothing but tokens ("**") legitimately renders nothing. */
export function parseRichMarkers(text: string): RichSegment[] {
  return parseRichSpans(text).map(
    ({ srcStart: _s, srcEnd: _e, open: _o, close: _c, ...seg }) => seg
  );
}

/** Raw [start, end) spans of every marker token in `text` — used by
 *  segmentIdealText to refuse anchor ranges that would slice a token in half
 *  (which would leak raw marker syntax into the student notebook). */
export function markerTokenSpans(text: string): Array<[number, number]> {
  if (!text) return [];
  return scan(text).tokens;
}

/** Strip all markers (for copy / plain-text fallbacks). */
export function stripRichMarkers(text: string): string {
  return parseRichSpans(text)
    .map((s) => s.text)
    .join("");
}

/** Spans → marker text. The inverse of parseRichSpans, and the editor's save
 *  path: consecutive spans sharing a moment are re-wrapped once, and within
 *  that, consecutive spans sharing a style re-use the span's ORIGINAL token
 *  pair. An untouched document therefore serializes back byte-for-byte.
 *
 *  (Not byte-exact for a MALFORMED document — the tokens rule 3 dropped are
 *  gone, which is the whole point of dropping them. Every word survives.) */
export function serializeRichSpans(spans: RichSpan[]): string {
  let out = "";
  let i = 0;
  while (i < spans.length) {
    const m = spans[i].moment;
    if (m) {
      let j = i;
      while (j < spans.length && spans[j].moment === m) j++;
      out += `[[moment:${m.snippetId}|${m.sessionId}]]`;
      out += serializeStyles(spans.slice(i, j));
      out += MOMENT_CLOSE;
      i = j;
      continue;
    }
    let j = i;
    while (j < spans.length && !spans[j].moment) j++;
    out += serializeStyles(spans.slice(i, j));
    i = j;
  }
  return out;
}

/** Style-level serialization for one moment run (or the unwrapped stretch). */
function serializeStyles(spans: RichSpan[]): string {
  let out = "";
  let i = 0;
  while (i < spans.length) {
    const { open, close } = spans[i];
    if (!open || !close) {
      out += spans[i].text;
      i++;
      continue;
    }
    let j = i;
    let body = "";
    while (j < spans.length && spans[j].open === open && spans[j].close === close) {
      body += spans[j].text;
      j++;
    }
    out += open + body + close;
    i = j;
  }
  return out;
}

/** Wrap [start, end) of `text` in the mark's tokens (the editor's B/I/U/orange
 *  buttons). A collapsed selection is a no-op. Returns the new text plus the
 *  new selection range (inside the markers). */
export function wrapSelection(
  text: string,
  start: number,
  end: number,
  mark: RichMark
): { text: string; selStart: number; selEnd: number } {
  if (end <= start) return { text, selStart: start, selEnd: end };
  const [open, close] = WRAPPERS[mark];
  const next =
    text.slice(0, start) + open + text.slice(start, end) + close + text.slice(end);
  return {
    text: next,
    selStart: start + open.length,
    selEnd: end + open.length,
  };
}

/** Markers → minimal HTML for the print/PDF export. Styling mirrors the
 *  RichText renderer (RichText.tsx): the accent is orange TEXT (not a
 *  background) and turns BOLD inside a moment (an approved key phrase), a key
 *  moment is an orange dotted underline — keep the two in step when either
 *  changes. Text is HTML-escaped before markers become tags. */
export function richMarkersToHtml(text: string): string {
  const esc = (t: string) =>
    t
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  return parseRichMarkers(text)
    .map((s) => {
      let h = esc(s.text);
      if (s.bold) h = `<b>${h}</b>`;
      if (s.italic) h = `<i>${h}</i>`;
      if (s.underline) h = `<u>${h}</u>`;
      // Accent inside a moment = an approved key phrase (bold+orange); a
      // standalone accent stays colour-only. Mirrors RichText.
      if (s.highlight)
        h = `<span style="color:#ee7a2b${
          s.moment ? ";font-weight:600" : ""
        }">${h}</span>`;
      if (s.moment)
        h = `<span style="color:#ee7a2b;text-decoration:underline dotted;text-underline-offset:3px">${h}</span>`;
      return h;
    })
    .join("");
}

/* ------------------------------- paragraphs -------------------------------- */

/** Split rendered spans into paragraphs at blank lines.
 *
 *  FE-1 layout: paragraph spacing is CSS margin between real <p> elements,
 *  NEVER "\n\n" rendered as <br><br> and never `white-space: pre-wrap` on the
 *  reading container — pre-wrap is what made a stray marker look like content.
 *
 *  Splitting the SPANS (not the source text) is what lets a span that crosses
 *  a paragraph break keep its styling in both halves: the parse already
 *  happened, so there is no half-open token left to leak. */
export function splitSpanParagraphs(spans: RichSpan[]): RichSpan[][] {
  // A paragraph break is a newline followed by another, with only horizontal
  // whitespace between them. Matched with exec (not split) so every piece keeps
  // an exact source offset — FE-7's tint indexes the served text, so an offset
  // that drifts by one character tints the wrong words.
  const BREAK = /\n[ \t]*\n\s*/g;
  const paras: RichSpan[][] = [];
  let current: RichSpan[] = [];
  const push = (span: RichSpan, from: number, to: number) => {
    if (to <= from) return;
    current.push({
      ...span,
      text: span.text.slice(from, to),
      srcStart: span.srcStart + from,
      srcEnd: span.srcStart + to,
    });
  };
  for (const span of spans) {
    BREAK.lastIndex = 0;
    let at = 0;
    let m: RegExpExecArray | null;
    while ((m = BREAK.exec(span.text)) !== null) {
      push(span, at, m.index);
      if (current.length > 0) paras.push(current);
      current = [];
      at = m.index + m[0].length;
    }
    push(span, at, span.text.length);
  }
  if (current.length > 0) paras.push(current);
  return paras;
}
