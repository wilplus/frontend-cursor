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

function drawDemoSlide(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  title: string,
  body: string,
): void {
  const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  const lines = body.split(/\n+/).map((part) => part.trim()).filter(Boolean);
  const tiles = lines.length > 1 && lines.every((line) => /^\d+$/.test(line));
  const x = Math.round(width * 0.09);
  const titleSize = Math.round(width * 0.09);
  const under = tiles ? width * 0.125 : width * 0.035;
  let y = Math.round(height / 2 - (titleSize + under) / 2);
  context.fillStyle = "rgba(255,255,255,0.9)";
  context.fillRect(x, y - height * 0.06, width * 0.09, Math.max(2, height * 0.015));
  context.fillStyle = "#ffffff";
  context.font = `800 ${titleSize}px ${font}`;
  y += titleSize * 0.85;
  context.fillText(title || "Presentation slide", x, y);
  if (tiles) {
    const size = width * 0.125;
    const top = y + width * 0.035;
    lines.forEach((line, index) => {
      const left = x + index * size * 1.22;
      context.fillStyle = "rgba(255,255,255,0.2)";
      context.beginPath();
      context.roundRect(left, top, size, size, size * 0.18);
      context.fill();
      context.fillStyle = "#ffffff";
      context.font = `800 ${Math.round(size * 0.53)}px ${font}`;
      context.textAlign = "center";
      context.fillText(line, left + size / 2, top + size * 0.69);
      context.textAlign = "left";
    });
  } else if (lines.length > 0) {
    context.fillStyle = "rgba(255,255,255,0.92)";
    context.font = `500 ${Math.round(width * 0.035)}px ${font}`;
    context.fillText(lines.join(" "), x, y + width * 0.06);
  }
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
    // The demo deck (founder 2026-10-13): the coloured artwork, no shade; the
    // same bar, title and line or tiles as MockPresentationSlide.
    drawDemoSlide(context, width, height, title, body);
    return output;
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
