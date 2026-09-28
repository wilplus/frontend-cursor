import {
  AlignmentType,
  Document,
  ImageRun,
  Packer,
  PageBreak,
  Paragraph,
  TextRun,
} from "docx";
import type { PresentationDocumentSlide } from "@/lib/willab/presentationDocument";
import {
  AI_GENERATED_PRODUCER,
  IPTC_TRAINED_ALGORITHMIC_MEDIA,
  aiGeneratedAssertion,
} from "@/lib/willab/aiGeneratedMark";
import { parseRichSpans } from "@/lib/willab/richMarkers";
import { helperWordRanges } from "@/lib/willab/answeredBookmark";
import {
  loadPresentationPdf,
  presentationCanvasJpegBytes,
  renderMockPresentationSlide,
  renderPresentationPage,
} from "@/lib/willab/presentationVisuals";

const ORANGE = "E56F2D";
const INK = "191919";
const MUTED = "666666";

/** One paragraph's runs. The helper words are italic in the paragraph's own
 *  colour and font (founder 2026-09-26, clause 20; export 2026-09-28, 6A):
 *  orange belongs to the headline above the paragraph, so two orange marks
 *  never compete. */
export function idealTextSegments(
  text: string,
  headline: string | null | undefined,
): Array<{ text: string; bold: boolean; italics: boolean }> {
  const spans = parseRichSpans(text);
  const plain = spans.map((span) => span.text).join("");
  const ranges = helperWordRanges(plain, headline) ?? [];
  const inRange = (at: number) =>
    ranges.some(([start, end]) => at >= start && at < end);
  const out: Array<{ text: string; bold: boolean; italics: boolean }> = [];
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

function idealTextRuns(text: string, headline: string | null): TextRun[] {
  return idealTextSegments(text, headline).map(
    (segment) =>
      new TextRun({
        text: segment.text,
        bold: segment.bold,
        italics: segment.italics,
        color: INK,
        size: 22,
      })
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadPresentationDocx({
  slides,
  presentationRef,
  filename = "willab-presentation.docx",
}: {
  slides: PresentationDocumentSlide[];
  presentationRef: string | null;
  filename?: string;
}): Promise<void> {
  const pdf = await loadPresentationPdf(presentationRef);
  const children: Paragraph[] = [];

  for (let index = 0; index < slides.length; index += 1) {
    const slide = slides[index];
    let visual =
      slide.page !== null
        ? await renderPresentationPage({ pdf, pageIndex: slide.page, targetWidth: 1000 })
        : null;
    if (!visual && slide.hasVisual && !presentationRef) {
      visual = await renderMockPresentationSlide({
        title: slide.title,
        body: slide.body,
        artworkSrc: slide.artworkSrc,
        targetWidth: 1000,
      });
    }
    if (presentationRef && slide.hasVisual && slide.page !== null && !visual) {
      throw new Error("The presentation slide could not be rendered for DOCX export.");
    }

    if (visual) {
      const naturalHeight = Math.round(600 * (visual.height / visual.width));
      const scale = naturalHeight > 650 ? 650 / naturalHeight : 1;
      const width = Math.round(600 * scale);
      const height = Math.round(naturalHeight * scale);
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 320 },
          children: [
            new ImageRun({
              type: "jpg",
              data: presentationCanvasJpegBytes(visual),
              transformation: { width, height },
              altText: {
                title: slide.title || `Slide ${index + 1}`,
                description: "Presentation slide",
                name: `slide-${index + 1}`,
              },
            }),
          ],
        })
      );
    }

    // Each headline over its OWN paragraph, like a newspaper headline over
    // its article (clause 20) — not every headline first and the text after.
    for (const row of slide.rows) {
      const flagship = row.rootType === "flagship";
      if (row.rootPhrase) {
        children.push(
          new Paragraph({
            spacing: { before: 120, after: 60 },
            children: [
              new TextRun({
                text: row.rootPhrase,
                bold: flagship,
                color: flagship ? ORANGE : MUTED,
                size: 32,
              }),
            ],
          })
        );
      }
      children.push(
        new Paragraph({
          spacing: { before: 60, after: 180, line: 360 },
          children: idealTextRuns(
            row.idealText,
            flagship ? row.rootPhrase : null,
          ),
        })
      );
    }
    if (index < slides.length - 1) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }
  }

  // Article 50(2) — this is the one FILE export that carries generated text
  // out of the product, so the marking rides in the OOXML core properties
  // (`docProps/core.xml`), which is where a reader of a .docx looks for
  // provenance and what any office suite will show under File → Properties.
  // `creator` also stops saying "Willab": it names the producer the mark
  // refers to, and an exported file is the worst place to carry a retired
  // product name.
  const file = new Document({
    creator: AI_GENERATED_PRODUCER,
    title: "Presentation notes",
    description: aiGeneratedAssertion(),
    keywords: `ai-generated, ${IPTC_TRAINED_ALGORITHMIC_MEDIA}`,
    sections: [{ properties: {}, children }],
  });
  triggerDownload(await Packer.toBlob(file), filename);
}
