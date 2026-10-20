/*
STORY    As a speaker, I want a clear message when I pick a file that is not
         a PDF or is over 20 MB, so that I know what to upload.
OUTCOME
  O1  PowerPoint and Keynote files are refused with a message naming PDF;
      a PDF over the size limit is refused with a message naming 20 MB.
PROVES   O1 -> "rejects non-pdf (incl. pptx, now PDF-only) and oversize"
*/
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
