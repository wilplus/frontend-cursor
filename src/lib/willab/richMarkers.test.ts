import { describe, expect, it } from "vitest";
import {
  parseRichMarkers,
  stripRichMarkers,
  wrapSelection,
  richMarkersToHtml,
} from "./richMarkers";

describe("parseRichMarkers", () => {
  it("parses the four marks flat", () => {
    const segs = parseRichMarkers("a **b** *i* __u__ ==h== z");
    expect(segs.map((s) => s.text)).toEqual(["a ", "b", " ", "i", " ", "u", " ", "h", " z"]);
    expect(segs[1]).toMatchObject({ bold: true });
    expect(segs[3]).toMatchObject({ italic: true });
    expect(segs[5]).toMatchObject({ underline: true });
    expect(segs[7]).toMatchObject({ highlight: true });
  });

  it("bold wins over italic at ** (no *-inside-** confusion)", () => {
    const segs = parseRichMarkers("**strong**");
    expect(segs).toHaveLength(1);
    expect(segs[0]).toMatchObject({ text: "strong", bold: true, italic: false });
  });

  it("renders malformed/unclosed markers literally", () => {
    expect(parseRichMarkers("a **b").map((s) => s.text).join("")).toBe("a **b");
    expect(parseRichMarkers("plain")).toEqual([
      { text: "plain", bold: false, italic: false, underline: false, highlight: false },
    ]);
  });

  it("parses the pinned FE-9 tokens: //italic// and {{orange:…}}", () => {
    const segs = parseRichMarkers("a //i// {{orange:h}} z");
    expect(segs.map((s) => s.text)).toEqual(["a ", "i", " ", "h", " z"]);
    expect(segs[1]).toMatchObject({ italic: true });
    expect(segs[3]).toMatchObject({ highlight: true });
  });

  it("parses [[moment:snippet|session]]…[[/moment]] into a moment segment", () => {
    const segs = parseRichMarkers("[[moment:sn1|se1]]key phrase[[/moment]] after");
    expect(segs).toHaveLength(2);
    expect(segs[0]).toMatchObject({
      text: "key phrase",
      moment: { snippetId: "sn1", sessionId: "se1" },
    });
    expect(segs[1].text).toBe(" after");
  });

  it("never italicizes URL protocol slashes", () => {
    expect(
      parseRichMarkers("see https://example.com and http://x.co")
    ).toHaveLength(1);
  });

  it("round-trips every toolbar wrap (the R-it invariant)", () => {
    // Mid-word selection.
    expect(parseRichMarkers("my//word//")[1]).toMatchObject({
      text: "word",
      italic: true,
    });
    // Selection containing a single slash ("and/or", "24/7").
    expect(parseRichMarkers("//and/or//")[0]).toMatchObject({
      text: "and/or",
      italic: true,
    });
    // Flush against another marker, no space between.
    const flush = parseRichMarkers("**bold**//it//");
    expect(flush[0]).toMatchObject({ text: "bold", bold: true });
    expect(flush[1]).toMatchObject({ text: "it", italic: true });
    // Across a soft line break inside one paragraph (bold).
    expect(parseRichMarkers("**two\nlines**")[0]).toMatchObject({
      text: "two\nlines",
      bold: true,
    });
    // Line start + inside punctuation.
    expect(parseRichMarkers("//lead//")[0]).toMatchObject({
      text: "lead",
      italic: true,
    });
    expect(parseRichMarkers("(//x//)")[1]).toMatchObject({
      text: "x",
      italic: true,
    });
  });
});

describe("stripRichMarkers", () => {
  it("drops markers, keeps text", () => {
    expect(stripRichMarkers("say it **louder** and ==clearer==")).toBe(
      "say it louder and clearer"
    );
  });
});

describe("wrapSelection", () => {
  it("wraps the selection and returns the inner range", () => {
    const r = wrapSelection("make it strong", 8, 14, "bold");
    expect(r.text).toBe("make it **strong**");
    expect(r.text.slice(r.selStart, r.selEnd)).toBe("strong");
  });

  it("uses the pinned FE-9 wrappers for italic and the accent", () => {
    expect(wrapSelection("make it strong", 8, 14, "italic").text).toBe(
      "make it //strong//"
    );
    const o = wrapSelection("make it strong", 8, 14, "highlight");
    expect(o.text).toBe("make it {{orange:strong}}");
    expect(o.text.slice(o.selStart, o.selEnd)).toBe("strong");
  });

  it("no-ops a collapsed selection", () => {
    expect(wrapSelection("abc", 1, 1, "highlight").text).toBe("abc");
  });
});

describe("richMarkersToHtml", () => {
  it("escapes HTML then applies tags (accent = orange text, mirroring RichText)", () => {
    expect(richMarkersToHtml("**a<b>** ==x==")).toBe(
      '<b>a&lt;b&gt;</b> <span style="color:#ee7a2b">x</span>'
    );
  });
});
