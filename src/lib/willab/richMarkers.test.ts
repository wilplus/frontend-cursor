import { describe, expect, it } from "vitest";
import {
  markerTokenSpans,
  parseRichMarkers,
  parseRichSpans,
  serializeRichSpans,
  splitSpanParagraphs,
  stripRichMarkers,
  wrapSelection,
  richMarkersToHtml,
} from "./richMarkers";

/** Every token of the five grammars, which FE-1 forbids at the reader. Note
 *  it does NOT include a bare "[[" or "]]": those are ordinary characters a
 *  speaker may well have said, and rule 3 is about tokens "from this grammar",
 *  not about confiscating brackets. */
const FORBIDDEN = /\*\*|__|\/\/|\{\{orange:|\}\}|\[\[moment:|\[\[\/moment\]\]|==/;
const rendered = (t: string) =>
  parseRichMarkers(t)
    .map((s) => s.text)
    .join("");

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
    expect(parseRichMarkers("see https://example.com and http://x.co")).toHaveLength(1);
  });

  it("round-trips every toolbar wrap (the R-it invariant)", () => {
    expect(parseRichMarkers("my//word//")[1]).toMatchObject({ text: "word", italic: true });
    expect(parseRichMarkers("//and/or//")[0]).toMatchObject({ text: "and/or", italic: true });
    const flush = parseRichMarkers("**bold**//it//");
    expect(flush[0]).toMatchObject({ text: "bold", bold: true });
    expect(flush[1]).toMatchObject({ text: "it", italic: true });
    expect(parseRichMarkers("**two\nlines**")[0]).toMatchObject({
      text: "two\nlines",
      bold: true,
    });
    expect(parseRichMarkers("//lead//")[0]).toMatchObject({ text: "lead", italic: true });
    expect(parseRichMarkers("(//x//)")[1]).toMatchObject({ text: "x", italic: true });
  });
});

/* ------------------- FE-1: the five non-negotiable rules ------------------- */

describe("FE-1 rule 1 — flat, not nested", () => {
  it("the first opener wins until its matching closer", () => {
    // The __ is CONTENT of the bold span for matching, so bold closes at the
    // first **, and the trailing __ is then an opener that never closes.
    const segs = parseRichMarkers("**a __b** c__");
    expect(segs[0]).toMatchObject({ text: "a ", bold: true });
    expect(segs[1]).toMatchObject({ text: "b", bold: true, underline: false });
    expect(segs[2]).toMatchObject({ text: " c", bold: false, underline: false });
  });

  it("an inner token never survives as an asterisk or a brace", () => {
    expect(rendered("{{orange:say **it** louder}}")).toBe("say it louder");
    expect(FORBIDDEN.test(rendered("{{orange:say **it** louder}}"))).toBe(false);
  });
});

describe("FE-1 rule 2 — multi-line tolerant", () => {
  it("closes an accent span that straddles a paragraph break", () => {
    // The exact shape from the defect screenshot: an accent opened in one
    // paragraph and closed in the next.
    const doc =
      "realizing how it is important.\n\n{{orange:How little important it is,\n\nwhat he has just achieved.}}\n\nAnd being, in general, human,";
    const segs = parseRichMarkers(doc);
    expect(FORBIDDEN.test(segs.map((s) => s.text).join(""))).toBe(false);
    // The words inside the accent keep their styling on BOTH sides of the break.
    const accented = segs.filter((s) => s.highlight).map((s) => s.text).join("");
    expect(accented).toContain("How little important it is,");
    expect(accented).toContain("what he has just achieved.");
  });

  it("tolerates a newline inside every pinned span", () => {
    for (const doc of ["**a\nb**", "__a\nb__", "{{orange:a\nb}}", "[[moment:s|k]]a\nb[[/moment]]"]) {
      expect(rendered(doc)).toBe("a\nb");
    }
  });
});

describe("FE-1 rule 3 — an unmatched opener is never shown", () => {
  it("drops the token and keeps every word", () => {
    expect(rendered("a **b")).toBe("a b");
    expect(rendered("{{orange:no closer here")).toBe("no closer here");
    expect(rendered("a }} b")).toBe("a  b");
    expect(rendered("__x")).toBe("x");
    expect(rendered("//x")).toBe("x");
    expect(rendered("[[moment:s|k]]orphan")).toBe("orphan");
    expect(rendered("orphan[[/moment]]")).toBe("orphan");
  });

  it("an unmatched opener renders its words UNSTYLED", () => {
    const segs = parseRichMarkers("{{orange:no closer");
    expect(segs).toEqual([
      { text: "no closer", bold: false, italic: false, underline: false, highlight: false },
    ]);
  });

  it("a second {{orange: before any }} unmatches the first", () => {
    const segs = parseRichMarkers("{{orange:one {{orange:two}}");
    expect(FORBIDDEN.test(segs.map((s) => s.text).join(""))).toBe(false);
    expect(segs.find((s) => s.text === "two")).toMatchObject({ highlight: true });
    expect(segs.find((s) => s.text.startsWith("one"))).toMatchObject({ highlight: false });
  });

  it("no grammar character survives, whatever the malformation", () => {
    for (const doc of [
      "**",
      "}}{{orange:",
      "[[moment:]]x[[/moment]]",
      "**a __b //c {{orange:d",
      "==x",
      "{{orange:a}}}}",
      "[[moment:s1|k1]]a[[moment:s2|k2]]b[[/moment]]",
    ]) {
      expect(FORBIDDEN.test(rendered(doc))).toBe(false);
    }
  });

  it("leaves brackets that are NOT this grammar alone", () => {
    // Rule 3 drops grammar tokens, not every bracket the speaker said.
    expect(rendered("a ]] b [[ c")).toBe("a ]] b [[ c");
    expect(rendered("see [1] and (2)")).toBe("see [1] and (2)");
  });
});

describe("FE-1 rule 4 — a key moment needs both ids", () => {
  it("renders plain text (not a dead tap target) when either id is missing", () => {
    expect(parseRichMarkers("[[moment:|se1]]words[[/moment]]")).toEqual([
      { text: "words", bold: false, italic: false, underline: false, highlight: false },
    ]);
    expect(parseRichMarkers("[[moment:sn1|]]words[[/moment]]")).toEqual([
      { text: "words", bold: false, italic: false, underline: false, highlight: false },
    ]);
  });
});

describe("FE-1 rule 5 — idempotent on empty", () => {
  it("empty text is an empty document, not a crash", () => {
    expect(parseRichMarkers("")).toEqual([]);
    expect(parseRichSpans("")).toEqual([]);
    expect(stripRichMarkers("")).toBe("");
    expect(markerTokenSpans("")).toEqual([]);
    expect(splitSpanParagraphs([])).toEqual([]);
  });
});

/* ------------------------- offsets and round-trip -------------------------- */

describe("parseRichSpans", () => {
  it("brackets each span's text in the SOURCE, markers excluded", () => {
    const src = "say {{orange:this bit}} louder";
    const spans = parseRichSpans(src);
    for (const s of spans) {
      expect(src.slice(s.srcStart, s.srcEnd)).toBe(s.text);
    }
    expect(spans[1]).toMatchObject({ text: "this bit", highlight: true, srcStart: 13 });
  });
});

describe("serializeRichSpans", () => {
  it("round-trips a well-formed document byte-for-byte", () => {
    for (const doc of [
      "plain words",
      "say it **louder** and __clearer__",
      "a //i// and {{orange:an accent}} z",
      "[[moment:s1|k1]]{{orange:this bit}}[[/moment]] louder",
      "**two\nlines**\n\nand a second paragraph",
      "a [[moment:s|k]]plain **b**[[/moment]] z",
    ]) {
      expect(serializeRichSpans(parseRichSpans(doc))).toBe(doc);
    }
  });

  it("preserves the LEGACY spelling a span was written with", () => {
    // Rewriting ==x== to {{orange:x}} on save would rewrite documents nobody
    // edited, so the original token pair rides on the span.
    expect(serializeRichSpans(parseRichSpans("a ==x== b"))).toBe("a ==x== b");
    expect(serializeRichSpans(parseRichSpans("a *i* b"))).toBe("a *i* b");
  });

  it("drops what rule 3 dropped, and keeps every word", () => {
    expect(serializeRichSpans(parseRichSpans("a **b"))).toBe("a b");
  });
});

describe("splitSpanParagraphs", () => {
  it("splits on blank lines and keeps source offsets exact", () => {
    const src = "one **bold**\n\ntwo\n\n\nthree";
    const paras = splitSpanParagraphs(parseRichSpans(src));
    expect(paras).toHaveLength(3);
    expect(paras[0].map((s) => s.text).join("")).toBe("one bold");
    expect(paras[1].map((s) => s.text).join("")).toBe("two");
    expect(paras[2].map((s) => s.text).join("")).toBe("three");
    for (const para of paras) {
      for (const s of para) expect(src.slice(s.srcStart, s.srcEnd)).toBe(s.text);
    }
  });

  it("keeps a span's styling on BOTH sides of a break it straddles", () => {
    const paras = splitSpanParagraphs(parseRichSpans("{{orange:first\n\nsecond}}"));
    expect(paras).toHaveLength(2);
    expect(paras[0][0]).toMatchObject({ text: "first", highlight: true });
    expect(paras[1][0]).toMatchObject({ text: "second", highlight: true });
  });

  it("a single newline is a soft break, not a paragraph", () => {
    expect(splitSpanParagraphs(parseRichSpans("one\ntwo"))).toHaveLength(1);
  });
});

describe("markerTokenSpans", () => {
  // The three consumers (segmentIdealText, splitBadgeParagraphs, MomentStars)
  // read this as "regions you must not cut into", so a closed construct has to
  // report its WHOLE extent, not two loose delimiters.
  it("reports the whole construct, opener through closer", () => {
    const src = "say **it** loud";
    expect(markerTokenSpans(src).map(([a, b]) => src.slice(a, b))).toContain("**it**");
  });

  it("guards a construct that straddles a paragraph break", () => {
    const src = "start {{orange:one\n\ntwo}} end";
    const guarded = markerTokenSpans(src);
    const brk = src.indexOf("\n\n");
    expect(guarded.some(([a, b]) => a <= brk && b >= brk + 2)).toBe(true);
  });

  it("reports a dropped token so nothing is cut across it either", () => {
    const src = "a **b";
    expect(markerTokenSpans(src).map(([a, b]) => src.slice(a, b))).toEqual(["**"]);
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
  it("escapes HTML then applies tags (a standalone accent stays colour-only)", () => {
    expect(richMarkersToHtml("**a<b>** ==x==")).toBe(
      '<b>a&lt;b&gt;</b> <span style="color:#ee7a2b">x</span>'
    );
  });

  it("bolds an accent INSIDE a moment (an approved key phrase reads bold+orange)", () => {
    expect(richMarkersToHtml("say [[moment:s1|k1]]{{orange:this bit}}[[/moment]] louder")).toBe(
      'say <span style="color:#ee7a2b;text-decoration:underline dotted;text-underline-offset:3px">' +
        '<span style="color:#ee7a2b;font-weight:600">this bit</span></span> louder'
    );
  });
});

describe("moment wrappers compose with the marks inside them", () => {
  it("parses the serve-time fold shape instead of leaking raw marker syntax", () => {
    expect(parseRichMarkers("[[moment:s1|k1]]{{orange:this bit}}[[/moment]]")).toEqual([
      {
        text: "this bit",
        bold: false,
        italic: false,
        underline: false,
        highlight: true,
        moment: { snippetId: "s1", sessionId: "k1" },
      },
    ]);
  });

  it("stamps the moment across several inner marks and keeps surrounding text", () => {
    const segs = parseRichMarkers("a [[moment:s|k]]plain **b**[[/moment]] z");
    expect(segs.map((s) => s.text)).toEqual(["a ", "plain ", "b", " z"]);
    expect(segs[1]).toMatchObject({ moment: { snippetId: "s", sessionId: "k" }, bold: false });
    expect(segs[2]).toMatchObject({ moment: { snippetId: "s", sessionId: "k" }, bold: true });
    expect(segs[3].moment).toBeUndefined();
  });

  it("an unmarked moment still yields one plain segment (no regression)", () => {
    expect(parseRichMarkers("[[moment:s1|k1]]hello[[/moment]]")).toEqual([
      {
        text: "hello",
        bold: false,
        italic: false,
        underline: false,
        highlight: false,
        moment: { snippetId: "s1", sessionId: "k1" },
      },
    ]);
  });

  it("a lone accent marker parses to a single highlighted segment, no moment", () => {
    expect(parseRichMarkers("{{orange:x}}")).toEqual([
      { text: "x", bold: false, italic: false, underline: false, highlight: true },
    ]);
  });
});
