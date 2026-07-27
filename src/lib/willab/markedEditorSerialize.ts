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
/* -------------------------------------------------------------------------- */

import { serializeRichSpans } from "@/lib/willab/richMarkers";

interface Run {
  text: string;
  open: string | null;
  close: string | null;
  moment?: { snippetId: string; sessionId: string };
}

/** Walk one paragraph, inheriting the token pair and moment ids from whatever
 *  ancestors carry them. Tolerant on purpose: after real editing the tree can
 *  hold browser-inserted wrappers and nested spans, and none of that may be
 *  allowed to lose a word. */
function runsOf(node: Node, ctx: Run): Run[] {
  if (node.nodeType === Node.TEXT_NODE) {
    // A contentEditable turns typed spaces into non-breaking ones; they are
    // ordinary spaces in the document. Spelled as an escape on purpose — the
    // literal character is invisible in a diff.
    const text = (node.textContent ?? "").replace(/\u00a0/g, " ");
    return text ? [{ ...ctx, text }] : [];
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return [];
  const el = node as HTMLElement;
  if (el.tagName === "BR") return [{ ...ctx, text: "\n" }];
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
  return Array.from(el.childNodes).flatMap((child) => runsOf(child, next));
}

/** The editor's DOM → the marker text to save. */
export function serializeEditor(root: HTMLElement): string {
  const blocks = Array.from(root.childNodes).filter(
    (n) =>
      n.nodeType === Node.ELEMENT_NODE &&
      ["P", "DIV"].includes((n as HTMLElement).tagName)
  );
  // Select-all-then-type can leave the root holding bare text; treat the whole
  // root as one paragraph rather than losing it.
  const paragraphs = blocks.length > 0 ? blocks : [root];
  return paragraphs
    .map((block) => {
      const runs = runsOf(block, { text: "", open: null, close: null });
      // serializeRichSpans re-wraps consecutive runs that share a moment, then
      // a token pair, so an untouched span emits exactly the tokens it came in
      // with. The offsets it never reads are filled with zeroes.
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
    })
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n");
}

