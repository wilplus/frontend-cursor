import { parseRichSpans } from "@/lib/willab/richMarkers";
import { helperWordRanges } from "@/lib/willab/answeredBookmark";

/** One run of an exported paragraph: its text, whether it is bold, and
 *  whether it is one of the paragraph's helper words (italic). */
export interface IdealTextSegment {
  text: string;
  bold: boolean;
  italics: boolean;
}

/** One paragraph's runs for an export. The helper words are italic in the
 *  paragraph's own colour and font (founder 2026-09-26, clause 20; export
 *  2026-09-28, 6A): orange belongs to the headline above the paragraph, so
 *  two orange marks never compete. One rule for every export format (the
 *  Word file and the PDF), so the two can never disagree about which words
 *  are italic. Pure. */
export function idealTextSegments(
  text: string,
  headline: string | null | undefined,
): IdealTextSegment[] {
  const spans = parseRichSpans(text);
  const plain = spans.map((span) => span.text).join("");
  const ranges = helperWordRanges(plain, headline) ?? [];
  const inRange = (at: number) =>
    ranges.some(([start, end]) => at >= start && at < end);
  const out: IdealTextSegment[] = [];
  let offset = 0;
  for (const span of spans) {
    let run = "";
    let italics = inRange(offset);
    for (let i = 0; i < span.text.length; i += 1) {
      const next = inRange(offset + i);
      if (next !== italics && run) {
        out.push({ text: run, bold: span.bold, italics });
        run = "";
      }
      italics = next;
      run += span.text[i];
    }
    if (run) out.push({ text: run, bold: span.bold, italics });
    offset += span.text.length;
  }
  return out;
}
