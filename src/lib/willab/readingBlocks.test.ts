import { describe, expect, it } from "vitest";
import { readingBlocks, READING_BLOCK_CHARS } from "./readingBlocks";

/** Every block must point back at the exact text it came from — a drifting
 *  offset tints or stars the wrong words. */
const offsetsExact = (src: string) =>
  readingBlocks(src).every((b) => src.slice(b.offset, b.offset + b.text.length) === b.text);

describe("readingBlocks", () => {
  it("splits on the single newlines the served text actually uses", () => {
    const src = "First block.\nSecond block.\nThird block.";
    expect(readingBlocks(src).map((b) => b.text)).toEqual([
      "First block.",
      "Second block.",
      "Third block.",
    ]);
    expect(offsetsExact(src)).toBe(true);
  });

  it("keeps a short document as one block", () => {
    expect(readingBlocks("Just the one sentence.")).toEqual([
      { text: "Just the one sentence.", offset: 0 },
    ]);
  });

  it("breaks a block that runs past the budget, at a sentence end", () => {
    const sentence = "This is a sentence of a reasonable length that reads fine. ";
    const src = sentence.repeat(12).trim(); // ~700 chars, no newlines
    const blocks = readingBlocks(src);
    expect(blocks.length).toBeGreaterThan(1);
    for (const b of blocks) {
      // Under budget, or a single over-long sentence we refused to cut.
      expect(b.text.length).toBeLessThanOrEqual(READING_BLOCK_CHARS + sentence.length);
      expect(b.text).toMatch(/[.!?]$/); // never cut mid-thought
    }
    expect(offsetsExact(src)).toBe(true);
  });

  it("never cuts a single long sentence in half", () => {
    const src = "word ".repeat(200).trim() + "."; // one ~1000-char sentence
    expect(readingBlocks(src)).toHaveLength(1);
  });

  it("loses no words — the blocks reassemble to the source", () => {
    const src =
      "Opening line.\nA middle block that goes on. It has several sentences. Enough of them that it will need to be broken somewhere sensible for a reader. And then some more to be sure it passes the budget comfortably. Still going, because five lines is not very many at all. Nearly there now, one more clause.\nClosing line.";
    const joined = readingBlocks(src)
      .map((b) => b.text)
      .join(" ");
    const norm = (s: string) => s.replace(/\s+/g, " ").trim();
    expect(norm(joined)).toBe(norm(src));
    expect(offsetsExact(src)).toBe(true);
  });

  it("handles blank lines and trailing whitespace without empty blocks", () => {
    const src = "One.\n\n\nTwo.\n   \nThree.  ";
    const blocks = readingBlocks(src);
    expect(blocks.map((b) => b.text)).toEqual(["One.", "Two.", "Three."]);
    expect(blocks.every((b) => b.text.trim().length > 0)).toBe(true);
    expect(offsetsExact(src)).toBe(true);
  });

  it("is empty for empty text", () => {
    expect(readingBlocks("")).toEqual([]);
    expect(readingBlocks("   \n  ")).toEqual([]);
  });

  it("respects a caller-supplied budget", () => {
    const src = "Aaa bbb ccc. Ddd eee fff. Ggg hhh iii.";
    expect(readingBlocks(src, 15).length).toBeGreaterThan(1);
    expect(readingBlocks(src, 9999)).toHaveLength(1);
  });
});
