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

  it("no-ops a collapsed selection", () => {
    expect(wrapSelection("abc", 1, 1, "highlight").text).toBe("abc");
  });
});

describe("richMarkersToHtml", () => {
  it("escapes HTML then applies tags", () => {
    expect(richMarkersToHtml("**a<b>** ==x==")).toBe(
      '<b>a&lt;b&gt;</b> <mark style="background:#ee7a2b33;color:inherit">x</mark>'
    );
  });
});
