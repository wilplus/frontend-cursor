"use client";

import { useMemo } from "react";
import {
  parseRichSpans,
  splitSpanParagraphs,
  type RichSpan,
} from "@/lib/willab/richMarkers";

/* -------------------------------------------------------------------------- */
/*  MarkedParagraphs (FE-1) — the plain reading view for marker text            */
/*                                                                            */
/*  The star/badge/tracked lanes have their own renderers (MomentStarText,      */
/*  TrackedText) because they layer stars, pills and decisions over the words.  */
/*  This is the surface for everywhere else the same document is READ with no   */
/*  layer on top — the guest / flag-off readout, and any future plain mount.    */
/*  Before FE-1 those printed `text` straight into a <p>, markers and all.      */
/*                                                                            */
/*  Layout is the FE-1 spec, and it is deliberately not `pre-wrap` in a box:    */
/*    · blank lines become REAL <p> elements, spaced by CSS margin — never      */
/*      "\n\n" rendered as <br><br>                                             */
/*    · a ~65-character measure and a 1.6+ line-height                          */
/*    · body type, never monospace                                             */
/*                                                                            */
/*  Splitting the PARSED SPANS rather than the source string is what makes an   */
/*  accent that straddles a paragraph break keep its colour on both sides: by   */
/*  then the parse has already happened, so there is no half-open token left to */
/*  leak into either half.                                                      */
/* -------------------------------------------------------------------------- */

export default function MarkedParagraphs({
  text,
  textSizeClass = "text-[17px]",
  tint,
}: {
  text: string;
  textSizeClass?: string;
  /** FE-7 — document-absolute key-point ranges to accent. */
  tint?: Array<[number, number]>;
}) {
  const paragraphs = useMemo(
    () => splitSpanParagraphs(parseRichSpans(text)),
    [text]
  );
  return (
    <div className="flex flex-col gap-4">
      {paragraphs.map((spans, i) => (
        <p
          key={i}
          className={`max-w-[65ch] whitespace-pre-line leading-relaxed text-foreground ${textSizeClass}`}
        >
          {spans.map((span, j) => (
            <Span key={j} span={span} tint={tint} />
          ))}
        </p>
      ))}
    </div>
  );
}

/** One parsed span, with the key-point accent painted over whatever falls
 *  inside it. Styling mirrors RichText — keep the two in step. */
function Span({ span, tint }: { span: RichSpan; tint?: Array<[number, number]> }) {
  const cls = [
    span.bold ? "font-semibold" : "",
    span.italic ? "italic" : "",
    span.underline ? "underline underline-offset-2" : "",
    // The one accent colour. A key moment with no tap handler paints the same
    // orange and NO underline, so a surface with no moment flow never shows a
    // dead link-looking affordance.
    span.highlight || span.moment ? "text-primary" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const hits = (tint ?? []).filter(
    ([s, e]) => s < span.srcEnd && e > span.srcStart
  );
  if (hits.length === 0) {
    return <span className={cls || undefined}>{span.text}</span>;
  }
  const parts: React.ReactNode[] = [];
  let at = 0;
  hits
    .sort((a, b) => a[0] - b[0])
    .forEach(([s, e], k) => {
      const from = Math.max(0, s - span.srcStart);
      const to = Math.min(span.text.length, e - span.srcStart);
      if (to <= at) return;
      if (from > at) parts.push(span.text.slice(at, from));
      parts.push(
        <span key={k} className="text-primary">
          {span.text.slice(Math.max(at, from), to)}
        </span>
      );
      at = to;
    });
  if (at < span.text.length) parts.push(span.text.slice(at));
  return <span className={cls || undefined}>{parts}</span>;
}
