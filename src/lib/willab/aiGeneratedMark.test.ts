import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  AI_GENERATED_LABEL,
  AI_GENERATED_PRODUCER,
  IPTC_TRAINED_ALGORITHMIC_MEDIA,
  aiGeneratedAttrs,
  aiGeneratedClipboardHtml,
  aiGeneratedJsonLd,
  aiGeneratedJsonLdScript,
  copyAiGeneratedText,
} from "./aiGeneratedMark";

describe("the mark says what it means", () => {
  it("carries the ratified IPTC term, not a word we invented", () => {
    // The whole value of the marking is that it means something to a reader
    // that is not us. A bespoke string would be machine-readable and say
    // nothing.
    expect(IPTC_TRAINED_ALGORITHMIC_MEDIA).toBe(
      "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia",
    );
    expect(aiGeneratedAttrs("ideal-text")["data-ai-generated-source-type"]).toBe(
      IPTC_TRAINED_ALGORITHMIC_MEDIA,
    );
    expect(aiGeneratedJsonLd("ideal-text").digitalSourceType).toBe(
      IPTC_TRAINED_ALGORITHMIC_MEDIA,
    );
  });

  it("names the producer, so the mark says WHOSE system generated the text", () => {
    expect(aiGeneratedAttrs("manager-feedback")["data-ai-generated-producer"]).toBe(
      AI_GENERATED_PRODUCER,
    );
  });

  it("identifies which document, when the surface has a name", () => {
    expect(aiGeneratedJsonLd("ideal-text", { name: "Series B deck" })).toMatchObject(
      { "schema:name": "Series B deck" },
    );
    // No name, or a blank one, falls back to the kind rather than an empty
    // string — an unnamed claim is still a claim about something.
    expect(aiGeneratedJsonLd("ideal-text", { name: "   " })).toMatchObject({
      "schema:name": "Ideal Text",
    });
    expect(aiGeneratedJsonLd("manager-feedback")).toMatchObject({
      "schema:name": "Feedback",
    });
  });

  it("escapes `<` so inlined JSON-LD cannot close its own script element", () => {
    const script = aiGeneratedJsonLdScript("ideal-text", {
      name: "</script><img onerror=alert(1)>",
    });
    expect(script).not.toContain("<");
    expect(script).toContain("\\u003c");
    expect(JSON.parse(script.replaceAll("\\u003c", "<"))).toMatchObject({
      "schema:name": "</script><img onerror=alert(1)>",
    });
  });
});

describe("AC-9 holds at the label", () => {
  it("states provenance and never a score, rating, band or verdict", () => {
    for (const label of Object.values(AI_GENERATED_LABEL)) {
      expect(label).toMatch(/Written by AI/);
      // No digits at all: a number on this label is the AC-9 breach, whatever
      // it would be counting.
      expect(label).not.toMatch(/\d/);
      expect(label.toLowerCase()).not.toMatch(
        /score|rating|grade|rank|percent|confidence level|out of/,
      );
    }
  });

  it("uses the words the accepted AI notice uses", () => {
    // `copy/ai-notice-1.0.txt` says the documents "ARE WRITTEN BY AI" and that
    // they "can be wrong". A second vocabulary for the same fact at the
    // surface is how a user ends up unsure whether they are two things.
    expect(AI_GENERATED_LABEL["ideal-text"]).toContain("can be wrong");
    expect(AI_GENERATED_LABEL["manager-feedback"]).toContain("can be wrong");
  });
});

describe("the clipboard flavours", () => {
  it("marks the html flavour", () => {
    const html = aiGeneratedClipboardHtml("One.\n\nTwo.", "ideal-text");
    expect(html).toContain('data-ai-generated="true"');
    expect(html).toContain(IPTC_TRAINED_ALGORITHMIC_MEDIA);
    expect(html).toContain("<p>One.</p>");
    expect(html).toContain("<p>Two.</p>");
  });

  it("escapes the text it wraps", () => {
    const html = aiGeneratedClipboardHtml('<b>hi</b> & "there"', "ideal-text");
    expect(html).toContain("&lt;b&gt;hi&lt;/b&gt; &amp; &quot;there&quot;");
  });

  it("keeps single newlines inside a paragraph and splits on blank lines", () => {
    const html = aiGeneratedClipboardHtml("a\nb\n\nc", "ideal-text");
    expect(html).toContain("<p>a<br />b</p>");
    expect(html).toContain("<p>c</p>");
  });
});

describe("copyAiGeneratedText", () => {
  const original = globalThis.navigator;

  beforeEach(() => {
    vi.stubGlobal("ClipboardItem", class {
      items: Record<string, Blob>;
      constructor(items: Record<string, Blob>) {
        this.items = items;
      }
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (original) vi.stubGlobal("navigator", original);
  });

  it("writes plain text that is byte-identical to what the user reads", async () => {
    // The assessment rejects invisible watermarking BY NAME, and a visible
    // appended attribution line is not machine-readable, so it would cost the
    // user something real and buy no compliance. The plain flavour is the
    // text, exactly.
    const written: Array<Record<string, Blob>> = [];
    vi.stubGlobal("navigator", {
      clipboard: {
        write: async (items: Array<{ items: Record<string, Blob> }>) => {
          written.push(items[0].items);
        },
      },
    });

    const text = "My opening line.\n\nMy second paragraph.";
    expect(await copyAiGeneratedText(text, "ideal-text")).toBe(true);
    expect(await written[0]["text/plain"].text()).toBe(text);
    expect(await written[0]["text/html"].text()).toContain('data-ai-generated="true"');
  });

  it("still copies when the browser refuses rich clipboard data", async () => {
    // A copy button that silently does nothing is worse than an unmarked
    // paste, and this is the degradation the rest of the app's copy buttons
    // already take.
    let plain: string | null = null;
    vi.stubGlobal("navigator", {
      clipboard: {
        write: async () => {
          throw new Error("NotAllowedError");
        },
        writeText: async (value: string) => {
          plain = value;
        },
      },
    });
    expect(await copyAiGeneratedText("text", "ideal-text")).toBe(true);
    expect(plain).toBe("text");
  });

  it("reports failure rather than claiming a copy that did not happen", async () => {
    vi.stubGlobal("navigator", {
      clipboard: {
        write: async () => {
          throw new Error("no");
        },
        writeText: async () => {
          throw new Error("no");
        },
      },
    });
    expect(await copyAiGeneratedText("text", "ideal-text")).toBe(false);
  });
});

describe("Article 50(2) — every surface that shows generated text is marked", () => {
  const src = (...parts: string[]) =>
    readFileSync(join(process.cwd(), "src", ...parts), "utf8");

  it("both Ideal Text mounts carry the mark and the marked copy", () => {
    for (const file of ["IdealTextOverlay.tsx", "IdealTextReadout.tsx"]) {
      const code = src("components", "willab", file);
      expect(code, `${file} container attrs`).toContain('aiGeneratedAttrs("ideal-text")');
      expect(code, `${file} visible note`).toContain('<AiGeneratedNote kind="ideal-text"');
      expect(code, `${file} marked copy`).toContain("copyAiGeneratedText(");
      // The unmarked copy path is what this replaces; it must not come back.
      expect(code, `${file} raw writeText`).not.toContain("clipboard\n        ?.writeText");
    }
  });

  it("Manager Feedback marks the machine's text and NOT the coach's", () => {
    const code = src("components", "willab", "ConfidentMomentCoachingBundle.tsx");
    expect(code).toContain('aiGeneratedAttrs("manager-feedback")');
    expect(code).toContain('<AiGeneratedNote kind="manager-feedback" />');
    // L3: the mark is gated on the provenance field, never applied blanket.
    expect(code).toContain('item.output.origin === "machine"');
  });

  it("the docx export carries the mark in its core properties", () => {
    const code = src("lib", "willab", "presentationDocx.ts");
    expect(code).toContain("IPTC_TRAINED_ALGORITHMIC_MEDIA");
    expect(code).toContain("description:");
    expect(code).toContain("keywords:");
    // The retired product name must not ship inside an exported file.
    expect(code).not.toContain('creator: "Willab"');
  });

  it("transcripts are NOT marked", () => {
    // A transcript represents what the user actually said. Marking it as
    // artificially generated would be a false claim, and the assessment's §3
    // says so.
    const code = src("components", "willab", "TranscriptReviewDeck.tsx");
    expect(code).not.toContain("aiGeneratedAttrs");
    expect(code).not.toContain("AiGeneratedNote");
  });
});
