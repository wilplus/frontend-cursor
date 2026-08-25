import type { PDFDocumentProxy } from "pdfjs-dist";

export function createPresentationCanvas(
  width: number,
  height: number
): HTMLCanvasElement {
  const node = document.createElement("canvas");
  node.width = width;
  node.height = height;
  return node;
}

export async function loadPresentationPdf(
  presentationRef: string | null
): Promise<PDFDocumentProxy | null> {
  if (!presentationRef) return null;
  try {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs?v=${pdfjs.version}`;
    return await pdfjs.getDocument({ url: presentationRef }).promise;
  } catch {
    return null;
  }
}

export async function renderPresentationPage({
  pdf,
  pageIndex,
  targetWidth,
}: {
  pdf: PDFDocumentProxy | null;
  pageIndex: number;
  targetWidth: number;
}): Promise<HTMLCanvasElement | null> {
  if (!pdf) return null;
  try {
    const page = await pdf.getPage(
      Math.min(Math.max(pageIndex + 1, 1), pdf.numPages)
    );
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: targetWidth / base.width });
    const output = createPresentationCanvas(
      Math.round(viewport.width),
      Math.round(viewport.height)
    );
    const context = output.getContext("2d");
    if (!context) return null;
    await page.render({ canvasContext: context, viewport }).promise;
    return output;
  } catch {
    return null;
  }
}

function drawWrappedText({
  context,
  text,
  x,
  y,
  maxWidth,
  font,
  lineHeight,
}: {
  context: CanvasRenderingContext2D;
  text: string;
  x: number;
  y: number;
  maxWidth: number;
  font: string;
  lineHeight: number;
}): number {
  context.font = font;
  let line = "";
  let lineY = y;
  for (const word of text.trim().split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && context.measureText(candidate).width > maxWidth) {
      context.fillText(line, x, lineY);
      line = word;
      lineY += lineHeight;
    } else {
      line = candidate;
    }
  }
  if (line) context.fillText(line, x, lineY);
  return lineY + lineHeight;
}

function loadPresentationArtwork(src: string | null): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

/** The canonical deckless visual used by every downloaded format. */
export async function renderMockPresentationSlide({
  title,
  body,
  artworkSrc = null,
  targetWidth,
}: {
  title: string;
  body: string;
  artworkSrc?: string | null;
  targetWidth: number;
}): Promise<HTMLCanvasElement> {
  const width = Math.max(640, Math.round(targetWidth));
  const height = Math.round((width * 9) / 16);
  const output = createPresentationCanvas(width, height);
  const context = output.getContext("2d");
  if (!context) return output;
  const artwork = await loadPresentationArtwork(artworkSrc);
  if (artwork) {
    context.drawImage(artwork, 0, 0, width, height);
    const shade = context.createLinearGradient(0, 0, width * 0.7, 0);
    shade.addColorStop(0, "rgba(3, 19, 45, 0.98)");
    shade.addColorStop(0.52, "rgba(3, 19, 45, 0.76)");
    shade.addColorStop(1, "rgba(3, 19, 45, 0)");
    context.fillStyle = shade;
    context.fillRect(0, 0, width, height);
  } else {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.strokeStyle = "#e5e5e5";
    context.lineWidth = Math.max(2, width / 500);
    context.strokeRect(1, 1, width - 2, height - 2);
  }

  const margin = Math.round(width * 0.07);
  context.fillStyle = artwork ? "#ffffff" : "#191919";
  const titleSize = Math.round(width * 0.045);
  context.font = `650 ${titleSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  context.fillText(title || "Presentation slide", margin, margin + titleSize);

  let y = margin + titleSize + Math.round(width * 0.06);
  const bodySize = Math.round(width * 0.027);
  const lineHeight = Math.round(bodySize * 1.5);
  context.font = `400 ${bodySize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  for (const line of body.split(/\n+/).map((part) => part.trim()).filter(Boolean)) {
    context.fillStyle = "#e56f2d";
    context.beginPath();
    context.arc(margin + bodySize * 0.2, y - bodySize * 0.25, bodySize * 0.12, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = artwork ? "rgba(255,255,255,0.92)" : "#191919";
    y = drawWrappedText({
      context,
      text: line,
      x: margin + bodySize * 0.8,
      y,
      maxWidth: artwork
        ? Math.round(width * 0.44)
        : width - margin * 2 - bodySize,
      font: `400 ${bodySize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`,
      lineHeight,
    });
    y += Math.round(lineHeight * 0.3);
  }
  return output;
}

export function presentationCanvasJpegBytes(
  node: HTMLCanvasElement
): Uint8Array {
  const encoded = node.toDataURL("image/jpeg", 0.94).split(",")[1] ?? "";
  const binary = atob(encoded);
  const output = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    output[index] = binary.charCodeAt(index);
  }
  return output;
}
