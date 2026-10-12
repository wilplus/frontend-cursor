// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

/* The assembler only needs `width`, `height` and the JPEG bytes, so the visual
   layer is mocked rather than a real canvas stood up in jsdom. */
vi.mock("@/lib/willab/presentationVisuals", () => ({
  createPresentationCanvas: vi.fn(),
  loadPresentationPdf: vi.fn(),
  presentationCanvasJpegBytes: () => new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
  renderMockPresentationSlide: vi.fn(),
  renderPresentationPage: vi.fn(),
}));

import { pdfFromCanvases } from "./presentationPdf";
import {
  AI_GENERATED_PRODUCER,
  IPTC_TRAINED_ALGORITHMIC_MEDIA,
} from "./aiGeneratedMark";

const canvas = (width: number, height: number) =>
  ({ width, height }) as unknown as HTMLCanvasElement;

async function build(pages = 2): Promise<string> {
  const blob = pdfFromCanvases(
    Array.from({ length: pages }, () => canvas(800, 450)),
  );
  return Buffer.from(await blob.arrayBuffer()).toString("latin1");
}

describe("the exported PDF still parses, and carries the mark", () => {

  it("carries the claim in both XMP and DocInfo", async () => {
    const pdf = await build(1);
    expect(pdf).toContain("/Type /Metadata /Subtype /XML");
    expect(pdf).toContain("Iptc4xmpExt:DigitalSourceType");
    expect(pdf).toContain(IPTC_TRAINED_ALGORITHMIC_MEDIA);
    expect(pdf).toContain(`/Producer (${AI_GENERATED_PRODUCER})`);
    expect(pdf).toContain("/Keywords (ai-generated,");
  });
});
