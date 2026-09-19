import { parseRichSpans } from "@/lib/willab/richMarkers";
import type { PresentationDocumentSlide } from "@/lib/willab/presentationDocument";
import {
  createPresentationCanvas,
  loadPresentationPdf,
  presentationCanvasJpegBytes,
  renderMockPresentationSlide,
  renderPresentationPage,
} from "@/lib/willab/presentationVisuals";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  AI_GENERATED_PRODUCER,
  IPTC_TRAINED_ALGORITHMIC_MEDIA,
  aiGeneratedAssertion,
  aiGeneratedXmp,
} from "@/lib/willab/aiGeneratedMark";

export type PresentationPdfSlide = PresentationDocumentSlide;

const PAGE_WIDTH = 1240;
const WORK_HEIGHT = 12000;
const MARGIN = 84;
const ORANGE = "#e56f2d";
const INK = "#191919";
const MUTED = "#666666";

function font(size: number, weight = 400): string {
  return `${weight} ${size}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
}

function drawWrapped(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  size: number,
  lineHeight: number,
  color: string,
  weight = 400
): number {
  ctx.font = font(size, weight);
  ctx.fillStyle = color;
  let atX = x;
  let atY = y;
  const words = text.trim().split(/\s+/).filter(Boolean);
  for (const word of words) {
    const prefix = atX === x ? "" : " ";
    const width = ctx.measureText(prefix + word).width;
    if (atX !== x && atX + width > x + maxWidth) {
      atX = x;
      atY += lineHeight;
    }
    ctx.fillText((atX === x ? "" : " ") + word, atX, atY);
    atX += ctx.measureText((atX === x ? "" : " ") + word).width;
  }
  return atY + lineHeight;
}

function drawIdealText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number
): number {
  const size = 31;
  const lineHeight = 49;
  let atX = x;
  let atY = y;
  const newline = () => {
    atX = x;
    atY += lineHeight;
  };

  for (const segment of parseRichSpans(text)) {
    const color = segment.highlight ? ORANGE : INK;
    const weight = segment.bold ? 650 : 400;
    ctx.font = font(size, weight);
    ctx.fillStyle = color;
    const tokens = segment.text.split(/(\n|\s+)/).filter((token) => token !== "");
    for (const token of tokens) {
      if (token === "\n") {
        newline();
        continue;
      }
      const whitespace = /^\s+$/.test(token);
      if (whitespace && atX === x) continue;
      const width = ctx.measureText(token).width;
      if (!whitespace && atX !== x && atX + width > x + maxWidth) newline();
      if (atY > WORK_HEIGHT - 200) break;
      ctx.fillText(token, atX, atY);
      atX += width;
    }
  }
  return atY + lineHeight;
}

async function slideCanvas(
  slide: PresentationPdfSlide,
  pdf: PDFDocumentProxy | null
): Promise<HTMLCanvasElement> {
  const work = createPresentationCanvas(PAGE_WIDTH, WORK_HEIGHT);
  const ctx = work.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, work.width, work.height);

  const contentWidth = PAGE_WIDTH - MARGIN * 2;
  let y = MARGIN;
  const rendered =
    slide.page === null
      ? null
      : await renderPresentationPage({
          pdf,
          pageIndex: slide.page,
          targetWidth: contentWidth,
        });
  if (rendered) {
    ctx.drawImage(rendered, MARGIN, y);
    y += rendered.height + 62;
  } else if (slide.page !== null) {
    throw new Error("The presentation slide could not be rendered for PDF export.");
  } else if (slide.hasVisual) {
    const mock = await renderMockPresentationSlide({
      title: slide.title,
      body: slide.body,
      artworkSrc: slide.artworkSrc,
      targetWidth: contentWidth,
    });
    ctx.drawImage(mock, MARGIN, y);
    y += mock.height + 62;
  }

  for (const row of slide.rows) {
    y = drawWrapped(
      ctx,
      row.rootPhrase,
      MARGIN,
      y,
      contentWidth,
      48,
      62,
      row.rootType === "flagship" ? ORANGE : MUTED,
      row.rootType === "flagship" ? 700 : 550
    );
    y += 14;
  }
  y += 34;

  for (const row of slide.rows) {
    y = drawIdealText(ctx, row.idealText, MARGIN, y, contentWidth);
    y += 38;
  }

  const finalHeight = Math.max(900, Math.min(WORK_HEIGHT, Math.ceil(y + MARGIN)));
  const out = createPresentationCanvas(PAGE_WIDTH, finalHeight);
  const outCtx = out.getContext("2d");
  if (!outCtx) throw new Error("Canvas is unavailable");
  outCtx.drawImage(work, 0, 0, PAGE_WIDTH, finalHeight, 0, 0, PAGE_WIDTH, finalHeight);
  return out;
}

const bytes = (value: string): Uint8Array => new TextEncoder().encode(value);

function concat(parts: Uint8Array[]): Uint8Array {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** PDF string literal escaping: `(`, `)` and `\` are the three characters that
 *  can terminate or corrupt a literal string object. */
function pdfString(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

/** Exported for the Article 50(2) metadata test.
 *
 *  A hand-assembled PDF that a strict reader rejects is the exact failure mode
 *  `docs/AI-CONTENT-MARKING-PROPOSAL.md` §2 warns about, so the test builds a
 *  real file and checks the two structures that make one unreadable: it walks
 *  every xref entry and asserts the byte at that offset actually begins the
 *  object the entry claims, and it compares the metadata stream's declared
 *  `/Length` against its real byte count.
 *
 *  It does NOT parse with pdfjs, and this comment used to say it did. The
 *  distinction matters because `03-article-50-assessment` cites this test as
 *  evidence: offset arithmetic is what the test proves, and acceptance by a
 *  strict viewer still has to be confirmed by opening a produced file. */
export function pdfFromCanvases(pages: HTMLCanvasElement[]): Blob {
  const objects: Uint8Array[] = [];
  const pageIds = pages.map((_, index) => 3 + index * 3);
  objects[2] = bytes(
    `<< /Type /Pages /Count ${pages.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`
  );
  pages.forEach((page, index) => {
    const pageId = 3 + index * 3;
    const imageId = pageId + 1;
    const contentId = pageId + 2;
    const mediaWidth = 595;
    const mediaHeight = Math.round(mediaWidth * (page.height / page.width));
    const jpg = presentationCanvasJpegBytes(page);
    objects[pageId] = bytes(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${mediaWidth} ${mediaHeight}] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`
    );
    objects[imageId] = concat([
      bytes(`<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`),
      jpg,
      bytes("\nendstream"),
    ]);
    const commands = `q ${mediaWidth} 0 0 ${mediaHeight} 0 0 cm /Im0 Do Q`;
    objects[contentId] = bytes(
      `<< /Length ${commands.length} >>\nstream\n${commands}\nendstream`
    );
  });

  // Article 50(2) — this exporter assembles the file by hand, so there is no
  // setMetadata() to call: the XMP packet is written as its own object and
  // referenced from the catalogue, with the DocInfo dictionary carrying the
  // same claim for readers that ignore XMP. Both come from the one shared
  // assertion module, never worded here.
  // Appended AFTER the pages so no existing object id moves: for n pages the
  // highest id used is 3n+2, so `objects.length` is the next free one.
  const metadataId = objects.length;
  const infoId = metadataId + 1;
  const xmp = bytes(aiGeneratedXmp());
  objects[metadataId] = concat([
    bytes(`<< /Type /Metadata /Subtype /XML /Length ${xmp.length} >>\nstream\n`),
    xmp,
    bytes("\nendstream"),
  ]);
  objects[infoId] = bytes(
    `<< /Producer (${pdfString(AI_GENERATED_PRODUCER)})` +
      ` /Creator (${pdfString(AI_GENERATED_PRODUCER)})` +
      ` /Subject (${pdfString(aiGeneratedAssertion())})` +
      ` /Keywords (${pdfString(`ai-generated, ${IPTC_TRAINED_ALGORITHMIC_MEDIA}`)}) >>`
  );
  objects[1] = bytes(
    `<< /Type /Catalog /Pages 2 0 R /Metadata ${metadataId} 0 R >>`
  );

  const output: Uint8Array[] = [bytes("%PDF-1.4\n%âãÏÓ\n")];
  const offsets = new Array(objects.length).fill(0);
  let length = output[0].length;
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = length;
    const object = concat([bytes(`${id} 0 obj\n`), objects[id], bytes("\nendobj\n")]);
    output.push(object);
    length += object.length;
  }
  const xrefOffset = length;
  const xref = [
    `xref\n0 ${objects.length}\n`,
    "0000000000 65535 f \n",
    ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`),
    `trailer\n<< /Size ${objects.length} /Root 1 0 R /Info ${infoId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
  ].join("");
  output.push(bytes(xref));
  const final = concat(output);
  const buffer = final.buffer.slice(
    final.byteOffset,
    final.byteOffset + final.byteLength
  ) as ArrayBuffer;
  return new Blob([buffer], { type: "application/pdf" });
}

export async function downloadPresentationPdf({
  slides,
  presentationRef,
  filename = "willab-presentation.pdf",
}: {
  slides: PresentationPdfSlide[];
  presentationRef: string | null;
  filename?: string;
}): Promise<void> {
  const pdf = await loadPresentationPdf(presentationRef);
  const rendered: HTMLCanvasElement[] = [];
  for (const slide of slides) rendered.push(await slideCanvas(slide, pdf));
  const url = URL.createObjectURL(pdfFromCanvases(rendered));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
