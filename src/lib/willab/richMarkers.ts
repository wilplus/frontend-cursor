/* -------------------------------------------------------------------------- */
/*  richMarkers — the ideal-text marker subset (B6): **bold**, *italic*,        */
/*  __underline__, ==highlight==. Stored as-is in the existing TEXT column;     */
/*  every other surface degrades to readable plain text. No nesting — the       */
/*  editor writes flat spans, and the renderer treats markers as flat tokens.   */
/* -------------------------------------------------------------------------- */

export interface RichSegment {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  highlight: boolean;
}

const TOKEN_RE = /\*\*(.+?)\*\*|__(.+?)__|==(.+?)==|\*(.+?)\*/g;

/** Split marked text into flat render segments. Unmarked text passes through;
 *  malformed / unclosed markers render literally (never crash, never hide). */
export function parseRichMarkers(text: string): RichSegment[] {
  const out: RichSegment[] = [];
  const plain = (t: string) =>
    out.push({ text: t, bold: false, italic: false, underline: false, highlight: false });
  let last = 0;
  let m: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(text)) !== null) {
    if (m.index > last) plain(text.slice(last, m.index));
    if (m[1] !== undefined) {
      out.push({ text: m[1], bold: true, italic: false, underline: false, highlight: false });
    } else if (m[2] !== undefined) {
      out.push({ text: m[2], bold: false, italic: false, underline: true, highlight: false });
    } else if (m[3] !== undefined) {
      out.push({ text: m[3], bold: false, italic: false, underline: false, highlight: true });
    } else if (m[4] !== undefined) {
      out.push({ text: m[4], bold: false, italic: true, underline: false, highlight: false });
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) plain(text.slice(last));
  return out.length > 0
    ? out
    : [{ text, bold: false, italic: false, underline: false, highlight: false }];
}

/** Strip all markers (for copy / plain-text fallbacks). */
export function stripRichMarkers(text: string): string {
  return parseRichMarkers(text)
    .map((s) => s.text)
    .join("");
}

export type RichMark = "bold" | "italic" | "underline" | "highlight";

const WRAPPERS: Record<RichMark, [string, string]> = {
  bold: ["**", "**"],
  italic: ["*", "*"],
  underline: ["__", "__"],
  highlight: ["==", "=="],
};

/** Wrap [start, end) of `text` in the mark's tokens (the editor's B/I/U/HL
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

/** Markers → minimal HTML for the print/PDF export (highlight = the brand
 *  orange). Text is HTML-escaped before markers become tags. */
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
      if (s.highlight)
        h = `<mark style="background:#ee7a2b33;color:inherit">${h}</mark>`;
      return h;
    })
    .join("");
}
