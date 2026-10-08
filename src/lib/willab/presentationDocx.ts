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
import { idealTextSegments } from "@/lib/willab/helperWordSegments";
import {
  loadPresentationPdf,
  presentationCanvasJpegBytes,
  renderMockPresentationSlide,
  renderPresentationPage,
} from "@/lib/willab/presentationVisuals";

const ORANGE = "E56F2D";
const INK = "191919";

/* The paragraph's runs (helper words italic, clause 20) live in
   `helperWordSegments`, shared with the PDF export so the two formats can
   never disagree; re-exported here for the callers that read them from the
   Word export. */
export { idealTextSegments };

/** One row's headline: its helper words, bold and orange, whatever the
 *  row's kind (founder 2026-10-07, Q-B9 A: the walk's orange rule applies
 *  inside the walk only; helper-word headlines stay orange on the page, in
 *  Presentation Mode and in the exports; build plan D-IT-10). There is no
 *  grey branch. null when the row has no helper words. Pure, for its test. */
export function docxHeadline(row: {
  rootPhrase: string;
}): { text: string; color: string; bold: true } | null {
  return row.rootPhrase ? { text: row.rootPhrase, color: ORANGE, bold: true } : null;
}

/** The paragraph's runs: its helper words italic inside it (clause 20),
 *  for every row that has them. */
export function docxTextSegments(row: { idealText: string; rootPhrase: string }) {
  return idealTextSegments(row.idealText, row.rootPhrase || null);
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
      const headline = docxHeadline(row);
      if (headline) {
        children.push(
          new Paragraph({
            spacing: { before: 120, after: 60 },
            children: [
              new TextRun({
                text: headline.text,
                bold: headline.bold,
                color: headline.color,
                size: 32,
              }),
            ],
          })
        );
      }
      children.push(
        new Paragraph({
          spacing: { before: 60, after: 180, line: 360 },
          children: idealTextRuns(row.idealText, row.rootPhrase || null),
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
