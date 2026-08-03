/* -------------------------------------------------------------------------- */
/*  markedEditorSerialize (FE-1) — the styled editor's DOM → marker text        */
/*                                                                            */
/*  Kept out of the component, like pieceBadges, so it stays unit-testable:     */
/*  this is the function that decides what gets PUT to                          */
/*  /v2/explore/arc/<id>/ideal-text/user-edit, and FE-1's acceptance criterion  */
/*  is that an edit-with-no-changes posts back exactly what was received. A     */
/*  silent rewrite here would restyle a document nobody touched.                */
/*                                                                            */
/*  The save route strips raw HTML and preserves markers, so what leaves here   */
/*  is always marker text — posting HTML would destroy the styling silently.    */
/*                                                                            */
/*  Task #62 (paragraph separation) — this walk is BLOCK-AWARE AT EVERY DEPTH.  */
/*  The old version read only the root's direct P/DIV children as paragraphs,   */
/*  which held for the DOM paint() creates but not for the DOM a contentEditable */
/*  session leaves behind: WebKit wraps paragraphs in a <div> (they then         */
/*  serialized as ONE flat run — every blank line silently destroyed on the      */
/*  next save), and loose text at the root next to block children was dropped    */
/*  outright (word loss). Now any block element, at any depth, bounds a          */
/*  paragraph, and inline content between blocks is a paragraph of its own.      */
/* -------------------------------------------------------------------------- */

import { serializeRichSpans } from "@/lib/willab/richMarkers";

interface Run {
  text: string;
  open: string | null;
  close: string | null;
  moment?: { snippetId: string; sessionId: string };
}

/** Elements that end one paragraph and start another. Deliberately broad: any
 *  of these appearing mid-document (a paste, a browser restructure) must break
 *  a paragraph rather than weld two together. */
const BLOCK_TAGS = new Set([
  "P",
  "DIV",
  "SECTION",
  "ARTICLE",
  "BLOCKQUOTE",
  "UL",
  "OL",
  "LI",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
]);

function isBlock(el: HTMLElement): boolean {
  return BLOCK_TAGS.has(el.tagName);
}

/** The accumulating walk state: finished paragraphs + the runs of the one
 *  currently open. */
interface Walk {
  paras: Run[][];
  current: Run[];
}

function endParagraph(w: Walk): void {
  if (w.current.length === 0) return;
  w.paras.push(w.current);
  w.current = [];
}

/** Walk one node, inheriting the token pair and moment ids from whatever
 *  ancestors carry them. Tolerant on purpose: after real editing the tree can
 *  hold browser-inserted wrappers and nested spans, and none of that may be
 *  allowed to lose a word. A BLOCK element closes the open paragraph, walks its
 *  own content as fresh paragraphs, and closes again on the way out — that is
 *  the whole #62 fix. */
function walk(node: Node, ctx: Run, w: Walk): void {
  if (node.nodeType === Node.TEXT_NODE) {
    // A contentEditable turns typed spaces into non-breaking ones; they are
    // ordinary spaces in the document. Spelled as an escape on purpose — the
    // literal character is invisible in a diff.
    const text = (node.textContent ?? "").replace(/\u00a0/g, " ");
    if (text) w.current.push({ ...ctx, text });
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as HTMLElement;
  if (el.tagName === "BR") {
    w.current.push({ ...ctx, text: "\n" });
    return;
  }
  const next: Run = {
    text: "",
    // Flat grammar: the nearest ancestor's token pair wins and an inner one is
    // ignored, which mirrors the parser's "first opener wins".
    open: ctx.open ?? el.dataset.open ?? null,
    close: ctx.close ?? el.dataset.close ?? null,
    moment:
      ctx.moment ??
      (el.dataset.snippet && el.dataset.session
        ? { snippetId: el.dataset.snippet, sessionId: el.dataset.session }
        : undefined),
  };
  if (isBlock(el)) {
    endParagraph(w);
    for (const child of Array.from(el.childNodes)) walk(child, next, w);
    endParagraph(w);
    return;
  }
  for (const child of Array.from(el.childNodes)) walk(child, next, w);
}

/** One paragraph's runs → marker text. serializeRichSpans re-wraps consecutive
 *  runs that share a moment, then a token pair, so an untouched span emits
 *  exactly the tokens it came in with. The offsets it never reads are zeroes. */
function serializeParagraph(runs: Run[]): string {
  return serializeRichSpans(
    runs.map((r) => ({
      ...r,
      bold: false,
      italic: false,
      underline: false,
      highlight: false,
      srcStart: 0,
      srcEnd: 0,
    }))
  );
}

/** The editor's DOM → the marker text to save. */
export function serializeEditor(root: HTMLElement): string {
  const w: Walk = { paras: [], current: [] };
  for (const child of Array.from(root.childNodes)) {
    walk(child, { text: "", open: null, close: null }, w);
  }
  endParagraph(w);
  return (
    w.paras
      .map(serializeParagraph)
      // A whitespace-only paragraph (WebKit's <div><br></div> spacer, stray
      // whitespace between blocks) is structure, not content — dropping it is
      // what keeps "a", <div><br></div>, "b" at one blank line, not three.
      .filter((p) => p.trim().length > 0)
      .join("\n\n")
      .replace(/\n{3,}/g, "\n\n")
  );
}
