import { describe, expect, it } from "vitest";
import { splitLinks, trimTrailingPunctuation } from "./linkify";

const links = (t: string) =>
  splitLinks(t)
    .filter((p) => p.type === "link")
    .map((p) => p.value);

/** Nothing may be dropped: the parts must reassemble into the input. */
const lossless = (t: string) =>
  splitLinks(t)
    .map((p) => p.value)
    .join("") === t;

describe("splitLinks", () => {
  it("links the URL from the screenshot, with its query string intact", () => {
    const url =
      "https://cal.com/artur-willonski-zywzu7/lesson?duration=60&overlayCalendar=true";
    // The message ends in a sentence period — linking it breaks the URL.
    const text = `Book here: ${url}.`;
    expect(links(text)).toEqual([url]);
    expect(lossless(text)).toBe(true);
  });

  it("does not truncate at the first &", () => {
    const url = "https://x.co/a?b=1&c=2&d=3";
    expect(links(url)).toEqual([url]);
  });

  it("leaves trailing sentence punctuation outside the anchor", () => {
    for (const mark of [".", ",", "!", "?", ":", ";"]) {
      expect(links(`see https://x.co${mark}`)).toEqual(["https://x.co"]);
    }
  });

  it("balances a closing paren only when the URL opens one", () => {
    // Wrapped in prose parens — the ")" belongs to the sentence.
    expect(links("(see https://x.co/a)")).toEqual(["https://x.co/a"]);
    // A wiki-style URL legitimately ends in one.
    expect(links("https://x.co/A_(b)")).toEqual(["https://x.co/A_(b)"]);
  });

  it("handles several links and the text between them", () => {
    const text = "one https://a.co and two http://b.co done";
    expect(links(text)).toEqual(["https://a.co", "http://b.co"]);
    expect(lossless(text)).toBe(true);
  });

  it("takes http and https only — www. and emails stay out of scope", () => {
    expect(links("go to www.example.com or mail a@b.co")).toEqual([]);
  });

  it("is not fooled by a bare scheme", () => {
    expect(links("https:// is a scheme")).toEqual([]);
    expect(links("http://")).toEqual([]);
  });

  it("returns nothing for empty text, and one run when there is no URL", () => {
    expect(splitLinks("")).toEqual([]);
    expect(splitLinks("no links here")).toEqual([
      { type: "text", value: "no links here" },
    ]);
  });

  it("never re-encodes the message — the runs reassemble byte-for-byte", () => {
    // Characters that an HTML-string implementation would mangle. This path
    // builds React nodes precisely so they survive.
    for (const text of [
      "a <b> & c https://x.co/?q=1&r=2 tail",
      "quotes \" ' and https://x.co/#frag",
      "https://x.co/a\nhttps://x.co/b",
    ]) {
      expect(lossless(text)).toBe(true);
    }
  });
});

describe("trimTrailingPunctuation", () => {
  it("returns the link and the tail it gave back", () => {
    expect(trimTrailingPunctuation("https://x.co/a.")).toEqual([
      "https://x.co/a",
      ".",
    ]);
    expect(trimTrailingPunctuation("https://x.co/a")).toEqual([
      "https://x.co/a",
      "",
    ]);
  });

  it("strips a run of punctuation, not just the last character", () => {
    expect(trimTrailingPunctuation("https://x.co/a?!")).toEqual([
      "https://x.co/a",
      "?!",
    ]);
  });
});
