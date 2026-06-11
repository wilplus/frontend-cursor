import { describe, expect, it } from "vitest";
import {
  initialSlides,
  nonEmptySlides,
  bulletLines,
  deckFileError,
  mapExtractedDeck,
  mapSlide,
  SLIDE_CAPS,
} from "./presentation";

describe("initialSlides", () => {
  it("opens with 5 empty blocks", () => {
    const s = initialSlides();
    expect(s).toHaveLength(5);
    expect(s.every((x) => x.title === "" && x.body === "")).toBe(true);
  });
});

describe("nonEmptySlides", () => {
  it("drops rows blank in both title and body", () => {
    const out = nonEmptySlides([
      { title: "Intro", body: "" },
      { title: "", body: "" },
      { title: "", body: "a point" },
      { title: "  ", body: "  " },
    ]);
    expect(out).toEqual([
      { title: "Intro", body: "" },
      { title: "", body: "a point" },
    ]);
  });

  it("clamps title/body and caps the count", () => {
    const long = Array.from({ length: 70 }, () => ({
      title: "t".repeat(300),
      body: "b".repeat(3000),
    }));
    const out = nonEmptySlides(long);
    expect(out).toHaveLength(SLIDE_CAPS.maxSlides);
    expect(out[0].title.length).toBe(SLIDE_CAPS.maxTitle);
    expect(out[0].body.length).toBe(SLIDE_CAPS.maxBody);
  });
});

describe("bulletLines", () => {
  it("splits on newline and drops blank lines", () => {
    expect(bulletLines("one\n\n  two \n")).toEqual(["one", "two"]);
    expect(bulletLines("")).toEqual([]);
  });
});

describe("deckFileError", () => {
  const file = (name: string, size: number) =>
    ({ name, size }) as File;
  it("accepts pptx/pdf under the size cap", () => {
    expect(deckFileError(file("deck.pptx", 1000))).toBeNull();
    expect(deckFileError(file("DECK.PDF", 1000))).toBeNull();
  });
  it("rejects wrong type and oversize", () => {
    expect(deckFileError(file("deck.key", 1000))).toMatch(/pptx or .pdf/);
    expect(deckFileError(file("deck.pdf", SLIDE_CAPS.maxFileBytes + 1))).toMatch(
      /20 MB/
    );
  });
});

describe("mapExtractedDeck", () => {
  it("maps presentation_ref + slides + warnings, dropping blank slides", () => {
    expect(
      mapExtractedDeck({
        presentation_ref: "https://cdn/x.pdf",
        slides: [
          { title: "Open", body: "hook\nstory" },
          { title: "", body: "" },
          "junk",
        ],
        warnings: ["slide 4 had no text", 5],
      })
    ).toEqual({
      presentationRef: "https://cdn/x.pdf",
      slides: [{ title: "Open", body: "hook\nstory" }],
      warnings: ["slide 4 had no text"],
    });
  });

  it("defaults to null ref + empty arrays on a bare/blank response", () => {
    expect(mapExtractedDeck({})).toEqual({
      presentationRef: null,
      slides: [],
      warnings: [],
    });
    expect(mapExtractedDeck(null)).toEqual({
      presentationRef: null,
      slides: [],
      warnings: [],
    });
  });

  it("mapSlide rejects a fully-blank slide", () => {
    expect(mapSlide({ title: "  ", body: "" })).toBeNull();
    expect(mapSlide({ title: "Has title", body: "" })?.title).toBe("Has title");
  });
});
