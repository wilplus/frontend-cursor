import { describe, expect, it } from "vitest";
import { mapIdealText, segmentIdealText } from "./idealText";

describe("segmentIdealText (delivery layer notebook)", () => {
  const moments = [
    { anchor: "turned stress into charisma", snippetId: "s1", takeSessionId: "t1" },
  ];

  it("bolds the first key phrase and underlines the first anchor occurrence", () => {
    const segs = segmentIdealText(
      "Good morning everyone. Here I turned stress into charisma, truly.",
      ["Good morning"],
      moments
    );
    expect(segs.map((s) => s.text).join("")).toBe(
      "Good morning everyone. Here I turned stress into charisma, truly."
    );
    const bold = segs.find((s) => s.bold);
    expect(bold?.text).toBe("Good morning");
    const linked = segs.find((s) => s.moment);
    expect(linked?.text).toBe("turned stress into charisma");
    expect(linked?.moment?.snippetId).toBe("s1");
  });

  it("matches case-insensitively but preserves the original casing", () => {
    const segs = segmentIdealText("TURNED STRESS INTO CHARISMA now", [], moments);
    expect(segs[0].text).toBe("TURNED STRESS INTO CHARISMA");
    expect(segs[0].moment?.snippetId).toBe("s1");
  });

  it("drops overlapping ranges (earlier start wins) and unmatched anchors", () => {
    const segs = segmentIdealText(
      "alpha beta gamma",
      ["beta gamma"],
      [
        { anchor: "alpha beta", snippetId: "s1", takeSessionId: "t" },
        { anchor: "not present", snippetId: "s2", takeSessionId: "t" },
      ]
    );
    // "alpha beta" (moment) accepted; overlapping phrase "beta gamma" dropped.
    expect(segs.filter((s) => s.moment).length).toBe(1);
    expect(segs.filter((s) => s.bold).length).toBe(0);
    expect(segs.map((s) => s.text).join("")).toBe("alpha beta gamma");
  });

  it("returns [] for empty text and whole-text single segment when nothing matches", () => {
    expect(segmentIdealText("", ["x"], [])).toEqual([]);
    expect(segmentIdealText("plain words", ["zzz"], [])).toEqual([
      { text: "plain words" },
    ]);
  });
});

describe("mapIdealText", () => {
  it("maps the wire shape, defaulting notes to null", () => {
    const v = mapIdealText({
      text: "T",
      key_phrases: ["a", ""],
      key_moments: [
        { anchor: "T", snippet_id: "s", take_session_id: "k" },
        { anchor: "", snippet_id: "x", take_session_id: "k" }, // dropped
      ],
      approved: true,
    });
    expect(v?.keyPhrases).toEqual(["a"]);
    expect(v?.keyMoments).toEqual([
      { anchor: "T", snippetId: "s", takeSessionId: "k" },
    ]);
    expect(v?.approved).toBe(true);
    expect(v?.notes).toBeNull();
  });

  it("nulls on missing text", () => {
    expect(mapIdealText({ key_phrases: [] })).toBeNull();
    expect(mapIdealText(null)).toBeNull();
  });
});
