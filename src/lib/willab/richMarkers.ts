/* -------------------------------------------------------------------------- */
/*  richMarkers — the ideal-text marker contract (FE-9, pinned BE-side in       */
/*  services/ideal_text_block.py; both the coach editor and the student         */
/*  notebook share it):                                                         */
/*    **bold**   __underline__   //italic//   {{orange:text}}                   */
/*    [[moment:snippet|session]]text[[/moment]]  (key-moment deep link)         */
/*  Legacy tokens still parse for texts saved before the contract:              */
/*    *italic*   ==highlight==  (highlight renders as the same orange)          */
/*  Stored as-is in the TEXT column; the BE strips only raw HTML and never      */
/*  parses markers except [[moment:]]. Every other surface degrades to          */
/*  readable plain text. No nesting — flat spans only.                          */
/*                                                                            */
/*  INVARIANT (review R-it): wrapSelection's output must always round-trip      */
/*  through parseRichMarkers — the toolbar may wrap ANY selection (mid-word,    */
/*  after a colon, flush against another marker, containing "and/or"), so the   */
/*  italic arm accepts all of those. The only rejection is a "//" immediately   */
/*  preceded by ":" (a URL protocol), enforced in JS — NOT via regex            */
/*  lookbehind, which throws at parse time on older iOS Safari.                 */
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

/*  Alternation order = precedence: moment first (longest, bracketed), then
 *  ** before * (so bold never half-matches as italic), the pinned tokens,
 *  then the legacy ones. Named groups (ES2018 — safely older than every
 *  browser this app supports) so adding an arm can't silently renumber the
 *  others. Bold/underline/orange allow newlines (the toolbar can wrap across
 *  a soft break); italic forbids "//" inside but allows single slashes. */
const TOKEN_RE =
  /\[\[moment:(?<mSnip>[^\]|]*)\|(?<mSess>[^\]]*)\]\](?<mText>[\s\S]+?)\[\[\/moment\]\]|\*\*(?<bold>[\s\S]+?)\*\*|__(?<under>[\s\S]+?)__|\{\{orange:(?<orange>[\s\S]+?)\}\}|==(?<hl>.+?)==|\/\/(?<ital>(?:[^/\n]|\/(?!\/))+?)\/\/|\*(?<italLegacy>.+?)\*/g;

/** A FRESH matcher per scan. TOKEN_RE is /g, so its lastIndex is shared
 *  mutable state — parseRichMarkers recurses (a moment wrapper composes with
 *  the marks inside it), and a nested scan sharing one regex would clobber the
 *  outer loop's position. */
const matcher = () => new RegExp(TOKEN_RE.source, TOKEN_RE.flags);

const PLAIN = { bold: false, italic: false, underline: false, highlight: false };

/** Split marked text into flat render segments. Unmarked text passes through;
 *  malformed / unclosed markers render literally (never crash, never hide). */
export function parseRichMarkers(text: string): RichSegment[] {
  const out: RichSegment[] = [];
  const plain = (t: string) => {
    if (t) out.push({ text: t, ...PLAIN });
  };
  let last = 0;
  let m: RegExpExecArray | null;
  const re = matcher();
  while ((m = re.exec(text)) !== null) {
    const g = m.groups ?? {};
    // Protocol guard (see the header invariant): "https://…" must never
    // italicize. Skip just this candidate and rescan from the next char —
    // the region stays part of the surrounding plain run.
    if (g.ital !== undefined && m.index > 0 && text[m.index - 1] === ":") {
      re.lastIndex = m.index + 1;
      continue;
    }
    if (m.index > last) plain(text.slice(last, m.index));
    if (g.mText !== undefined) {
      // A moment wrapper COMPOSES with the marks inside it. The serve-time
      // fold of an approved emphasize is [[moment:…]]{{orange:…}}[[/moment]],
      // so pushing mText flat would print the inner marker as raw syntax to
      // the student. Parse the inner run and stamp the moment on each segment.
      // (The token match is non-greedy and requires a closer, so the inner
      // text can never contain another complete moment token — no runaway.)
      const moment = { snippetId: g.mSnip ?? "", sessionId: g.mSess ?? "" };
      for (const seg of parseRichMarkers(g.mText)) {
        out.push({ ...seg, moment });
      }
    } else if (g.bold !== undefined) {
      out.push({ text: g.bold, ...PLAIN, bold: true });
    } else if (g.under !== undefined) {
      out.push({ text: g.under, ...PLAIN, underline: true });
    } else if (g.orange !== undefined) {
      out.push({ text: g.orange, ...PLAIN, highlight: true });
    } else if (g.hl !== undefined) {
      out.push({ text: g.hl, ...PLAIN, highlight: true });
    } else if (g.ital !== undefined) {
      out.push({ text: g.ital, ...PLAIN, italic: true });
    } else if (g.italLegacy !== undefined) {
      out.push({ text: g.italLegacy, ...PLAIN, italic: true });
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) plain(text.slice(last));
  return out.length > 0 ? out : [{ text, ...PLAIN }];
}

/** Raw [start, end) spans of every marker token in `text` — used by
 *  segmentIdealText to refuse anchor ranges that would slice a token in half
 *  (which would leak raw marker syntax into the student notebook). */
export function markerTokenSpans(text: string): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  let m: RegExpExecArray | null;
  const re = matcher();
  while ((m = re.exec(text)) !== null) {
    const g = m.groups ?? {};
    if (g.ital !== undefined && m.index > 0 && text[m.index - 1] === ":") {
      re.lastIndex = m.index + 1;
      continue;
    }
    spans.push([m.index, m.index + m[0].length]);
  }
  return spans;
}

/** Strip all markers (for copy / plain-text fallbacks). */
export function stripRichMarkers(text: string): string {
  return parseRichMarkers(text)
    .map((s) => s.text)
    .join("");
}

export type RichMark = "bold" | "italic" | "underline" | "highlight";

/** The pinned wrappers (FE-9): italic is //…//, the accent is {{orange:…}}. */
const WRAPPERS: Record<RichMark, [string, string]> = {
  bold: ["**", "**"],
  italic: ["//", "//"],
  underline: ["__", "__"],
  highlight: ["{{orange:", "}}"],
};

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
