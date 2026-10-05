/* -------------------------------------------------------------------------- */
/*  THE PDF EXPORT FOLLOWS CLAUSE 20 (founder 2026-09-26; design lock's next  */
/*  improvement round, decided 2026-09-28: "clause 20 says italic, and it     */
/*  applies to Presentation Mode and export too"; audit 2026-10-05 NR-1, 20). */
/*                                                                            */
/*  Each paragraph's helper words are a bold orange headline DIRECTLY ABOVE   */
/*  THAT PARAGRAPH, and inside the text the same words are italic in the     */
/*  paragraph's own colour: the headline is the only orange. The PDF drew    */
/*  every headline first and every paragraph after, and the words orange.    */
/* -------------------------------------------------------------------------- */
import { describe, expect, it, vi } from "vitest";

type Call = { text: string; y: number; font: string; fill: string };
const calls: Call[] = [];

/** A 2D context that records what was written where, in which font and
 *  colour; enough of the canvas surface for `slideCanvas`. */
function recordingCanvas(width: number, height: number) {
  const ctx = {
    font: "",
    fillStyle: "",
    fillRect: () => undefined,
    drawImage: () => undefined,
    measureText: (text: string) => ({ width: text.length * 10 }),
    fillText(text: string, _x: number, y: number) {
      calls.push({ text, y, font: ctx.font, fill: String(ctx.fillStyle) });
    },
  };
  return { width, height, getContext: () => ctx } as unknown as HTMLCanvasElement;
}

vi.mock("@/lib/willab/presentationVisuals", () => ({
  createPresentationCanvas: (w: number, h: number) => recordingCanvas(w, h),
  loadPresentationPdf: vi.fn(),
  presentationCanvasJpegBytes: () => new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
  renderMockPresentationSlide: vi.fn(),
  renderPresentationPage: vi.fn(),
}));

import { pdfTextBlocks, slideCanvas, type PresentationPdfSlide } from "./presentationPdf";

const ORANGE = "#e56f2d";

const slide: PresentationPdfSlide = {
  key: "unassigned-text",
  page: null,
  title: "",
  body: "",
  artworkSrc: null,
  hasVisual: false,
  rows: [
    {
      key: 0,
      rootPhrase: "the timing matters",
      rootType: "flagship",
      idealText: "We think the timing matters because the window closes.",
    },
    {
      key: 60,
      rootPhrase: "",
      rootType: "neutral",
      idealText: "Nobody believed the numbers.",
    },
    {
      key: 100,
      rootPhrase: "one more quarter",
      rootType: "flagship",
      idealText: "So I am asking for one more quarter of the same budget.",
    },
  ],
};

describe("the order: each headline directly above its own paragraph", () => {
  it("interleaves headline and paragraph, row by row; no headline without words", () => {
    const blocks = pdfTextBlocks(slide.rows);
    expect(blocks.map((b) => (b.kind === "headline" ? `H:${b.text}` : "P"))).toEqual([
      "H:the timing matters",
      "P",
      "P",
      "H:one more quarter",
      "P",
    ]);
  });

  it("draws them on the page in that order, top to bottom", async () => {
    calls.length = 0;
    await slideCanvas(slide, null);
    const firstY = (text: string) => calls.find((c) => c.text.trim() === text)?.y ?? NaN;
    const headline1 = firstY("the");
    const paragraph1 = firstY("We");
    const paragraph2 = firstY("Nobody");
    const headline2 = firstY("one");
    const paragraph3 = firstY("So");
    expect(headline1).toBeLessThan(paragraph1);
    expect(paragraph1).toBeLessThan(paragraph2);
    expect(paragraph2).toBeLessThan(headline2);
    expect(headline2).toBeLessThan(paragraph3);
  });
});

describe("inside the text: italic, the paragraph's own colour; the headline is the only orange", () => {
  it("marks the helper words italic where the paragraph says them, and nowhere else", () => {
    const [, paragraph] = pdfTextBlocks(slide.rows);
    expect(paragraph.kind).toBe("paragraph");
    if (paragraph.kind !== "paragraph") return;
    expect(paragraph.segments.filter((s) => s.italics).map((s) => s.text)).toEqual([
      "the timing matters",
    ]);
    expect(paragraph.segments.map((s) => s.text).join("")).toBe(
      "We think the timing matters because the window closes.",
    );
  });

  it("draws the helper words in the text italic and never orange", async () => {
    calls.length = 0;
    await slideCanvas(slide, null);
    const headlineWords = calls.filter((c) => c.fill === ORANGE).map((c) => c.text.trim());
    // Orange is the two headlines and nothing else.
    expect(headlineWords).toEqual(["the", "timing", "matters", "one", "more", "quarter"]);
    const inText = calls.filter((c) => c.fill !== ORANGE);
    const italic = inText.filter((c) => c.font.startsWith("italic ")).map((c) => c.text.trim());
    expect(italic.filter(Boolean)).toEqual(["the", "timing", "matters", "one", "more", "quarter"]);
    // The words around them are upright.
    expect(inText.find((c) => c.text.trim() === "because")?.font.startsWith("italic ")).toBe(false);
  });
});
