// @vitest-environment jsdom
/*
STORY    As the founder (compliance), I want every exported PDF to carry the
         AI-generated mark and still open, so that we meet labelling duties
         without breaking downloads.
OUTCOME
  O1  The XMP packet and the DocInfo dictionary both carry the IPTC source
      type, the Producer and the "ai-generated" keyword.
  O2  The file is still a well-formed PDF: every xref offset lands on its
      object, startxref lands on the xref table, the trailer's Size, Root
      and Info agree, and the file ends with %%EOF.
PROVES   O1 -> "carries the claim in both XMP and DocInfo"
         O2 -> "is still a well-formed PDF a reader can open"
WHY      Article 50(2) marking; the exporter assembles the file by hand, so a
         shifted byte breaks every download.
*/
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

/** The file as latin1, so one character is one byte and string indexes are
 *  the byte offsets the xref table names. */
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

  it("is still a well-formed PDF a reader can open", async () => {
    const pdf = await build(2);
    expect(pdf.startsWith("%PDF-1.")).toBe(true);
    expect(pdf.endsWith("%%EOF")).toBe(true);

    const startxref = Number(pdf.match(/startxref\n(\d+)\n%%EOF$/)?.[1]);
    expect(pdf.slice(startxref, startxref + 5)).toBe("xref\n");

    const [, first, count] = pdf.slice(startxref).match(/^xref\n(\d+) (\d+)\n/) ?? [];
    expect(Number(first)).toBe(0);
    const entries = [...pdf.slice(startxref).matchAll(/^(\d{10}) (\d{5}) ([nf]) $/gm)];
    expect(entries).toHaveLength(Number(count));
    entries.slice(1).forEach(([, offset], i) => {
      const id = i + 1;
      expect(pdf.slice(Number(offset)).startsWith(`${id} 0 obj\n`), `object ${id}`).toBe(true);
    });

    const trailer = pdf.match(/trailer\n<< \/Size (\d+) \/Root (\d+) 0 R \/Info (\d+) 0 R >>/);
    expect(Number(trailer?.[1])).toBe(Number(count));
    const objectAt = (id: number) => pdf.slice(Number(entries[id][1]));
    expect(objectAt(Number(trailer?.[2]))).toMatch(/^\d+ 0 obj\n<< \/Type \/Catalog /);
    expect(objectAt(Number(trailer?.[3]))).toMatch(/^\d+ 0 obj\n<< \/Producer /);
    // Two pages, each with its page, image and content object.
    expect(pdf).toContain("/Type /Pages /Count 2");
  });
});
