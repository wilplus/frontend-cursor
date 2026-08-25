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
import { parseRichSpans } from "@/lib/willab/richMarkers";
import {
  loadPresentationPdf,
  presentationCanvasJpegBytes,
  renderMockPresentationSlide,
  renderPresentationPage,
} from "@/lib/willab/presentationVisuals";

const ORANGE = "E56F2D";
const INK = "191919";
const MUTED = "666666";

function idealTextRuns(text: string): TextRun[] {
  return parseRichSpans(text).map(
    (segment) =>
      new TextRun({
        text: segment.text,
        bold: segment.bold,
        color: segment.highlight ? ORANGE : INK,
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

    for (const row of slide.rows) {
      children.push(
        new Paragraph({
          spacing: { before: 120, after: 120 },
          children: [
            new TextRun({
              text: row.rootPhrase,
              bold: row.rootType === "flagship",
              color: row.rootType === "flagship" ? ORANGE : MUTED,
              size: 32,
            }),
          ],
        })
      );
    }
    for (const row of slide.rows) {
      children.push(
        new Paragraph({
          spacing: { before: 120, after: 180, line: 360 },
          children: idealTextRuns(row.idealText),
        })
      );
    }
    if (index < slides.length - 1) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }
  }

  const file = new Document({
    creator: "Willab",
    title: "Presentation notes",
    sections: [{ properties: {}, children }],
  });
  triggerDownload(await Packer.toBlob(file), filename);
}
