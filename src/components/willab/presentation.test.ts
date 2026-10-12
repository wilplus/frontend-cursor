import { describe, expect, it } from "vitest";
import {
  deckFileError,
  SLIDE_CAPS,
} from "./presentation";

describe("deckFileError", () => {
  const file = (name: string, size: number) =>
    ({ name, size }) as File;
  it("rejects non-pdf (incl. pptx, now PDF-only) and oversize", () => {
    expect(deckFileError(file("deck.pptx", 1000))).toMatch(/PDF/);
    expect(deckFileError(file("deck.key", 1000))).toMatch(/PDF/);
    expect(deckFileError(file("deck.pdf", SLIDE_CAPS.maxFileBytes + 1))).toMatch(
      /20 MB/
    );
  });
});
