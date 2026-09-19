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
  aiGeneratedXmp,
} from "./aiGeneratedMark";

const canvas = (width: number, height: number) =>
  ({ width, height }) as unknown as HTMLCanvasElement;

async function build(pages = 2): Promise<string> {
  const blob = pdfFromCanvases(
    Array.from({ length: pages }, () => canvas(800, 450)),
  );
  return Buffer.from(await blob.arrayBuffer()).toString("latin1");
}

describe("the XMP packet", () => {
  it("is well-formed XML", () => {
    const parsed = new DOMParser().parseFromString(aiGeneratedXmp(), "text/xml");
    expect(parsed.getElementsByTagName("parsererror")).toHaveLength(0);
  });

  it("carries the IPTC DigitalSourceType as a resource reference", () => {
    // `rdf:resource` rather than a text node: the term is a URI, and a reader
    // that resolves it is the whole reason for using a published vocabulary.
    expect(aiGeneratedXmp()).toContain(
      `<Iptc4xmpExt:DigitalSourceType rdf:resource="${IPTC_TRAINED_ALGORITHMIC_MEDIA}"/>`,
    );
  });

  it("escapes a document name that contains markup", () => {
    const xmp = aiGeneratedXmp({ name: "<script>&" });
    expect(xmp).toContain("&lt;script&gt;&amp;");
    const parsed = new DOMParser().parseFromString(xmp, "text/xml");
    expect(parsed.getElementsByTagName("parsererror")).toHaveLength(0);
  });
});

describe("the exported PDF still parses, and carries the mark", () => {
  it("keeps a structurally valid xref after the two added objects", async () => {
    const pdf = await build(2);

    // 2 pages → ids 1..8 used, metadata 9, info 10, so /Size is 11.
    expect(pdf).toContain("/Size 11");
    expect(pdf).toContain("9 0 obj");
    expect(pdf).toContain("10 0 obj");

    // Every xref entry must point at the byte where that object actually
    // starts. This is what a hand-written xref gets wrong, and a wrong offset
    // is what makes a strict viewer reject the file.
    const xrefStart = pdf.lastIndexOf("xref\n0 ");
    const entries = pdf
      .slice(xrefStart)
      .split("\n")
      .filter((line) => /^\d{10} \d{5} [nf] $/.test(line));
    expect(entries).toHaveLength(11);
    entries.slice(1).forEach((entry, index) => {
      const offset = Number(entry.slice(0, 10));
      expect(pdf.slice(offset, offset + 12)).toContain(`${index + 1} 0 obj`);
    });

    // startxref must point at the xref table itself.
    const startxref = Number(pdf.slice(pdf.lastIndexOf("startxref") + 10).trim().split("\n")[0]);
    expect(pdf.slice(startxref, startxref + 4)).toBe("xref");
  });

  it("references the metadata from the catalogue and the info from the trailer", async () => {
    const pdf = await build(1);
    // 1 page → ids 1..5, metadata 6, info 7.
    expect(pdf).toContain("/Type /Catalog /Pages 2 0 R /Metadata 6 0 R");
    expect(pdf).toContain("/Root 1 0 R /Info 7 0 R");
  });

  it("carries the claim in both XMP and DocInfo", async () => {
    const pdf = await build(1);
    expect(pdf).toContain("/Type /Metadata /Subtype /XML");
    expect(pdf).toContain("Iptc4xmpExt:DigitalSourceType");
    expect(pdf).toContain(IPTC_TRAINED_ALGORITHMIC_MEDIA);
    expect(pdf).toContain(`/Producer (${AI_GENERATED_PRODUCER})`);
    expect(pdf).toContain("/Keywords (ai-generated,");
  });

  it("declares the metadata stream's real byte length", async () => {
    // A /Length that disagrees with the stream is the other classic way a
    // hand-assembled PDF becomes unreadable.
    const pdf = await build(1);
    const declared = Number(
      /\/Type \/Metadata \/Subtype \/XML \/Length (\d+) >>/.exec(pdf)?.[1],
    );
    const body = pdf.slice(pdf.indexOf("<?xpacket begin"));
    const actual = body.slice(0, body.indexOf("<?xpacket end=\"w\"?>") + 19).length;
    expect(declared).toBe(actual);
  });
});
