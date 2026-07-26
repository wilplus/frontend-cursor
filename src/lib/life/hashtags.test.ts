import { describe, expect, it } from "vitest";
import {
  applyPick,
  filterPicker,
  isLifeTagged,
  LIFE_TAGS,
  parseLeadingTag,
  pickerEntries,
  pickerQuery,
} from "./hashtags";

describe("parseLeadingTag", () => {
  it("returns null when there is no leading hashtag", () => {
    // This is the ordinary chat path. Anything other than null here would send
    // a normal question down the life route.
    expect(parseLeadingTag("how does breathing affect pitch?")).toBeNull();
    expect(parseLeadingTag("")).toBeNull();
    expect(parseLeadingTag("talked about #mistake yesterday")).toBeNull();
  });

  it("routes each documented alias to its canonical tag", () => {
    const cases: Array<[string, string, string]> = [
      ["#principle a thing", "mistake", "case"],
      ["#mistake a thing", "mistake", "case"],
      ["#error a thing", "mistake", "case"],
      ["#problem a thing", "mistake", "case"],
      ["#data a thing", "observation", "goal_diff"],
      ["#observation a thing", "observation", "goal_diff"],
      ["#reflection a thing", "observation", "goal_diff"],
      ["#idea a thing", "observation", "goal_diff"],
      ["#finding a thing", "observation", "goal_diff"],
      ["#win a thing", "win", "win"],
      ["#wins a thing", "win", "win"],
      ["#wygrane a thing", "win", "win"],
      ["#liftmeup a thing", "win", "win"],
      ["#add a line", "add", "phrase_add"],
      ["#edit the one thing", "edit", "day_edit"],
    ];
    for (const [input, tag, route] of cases) {
      const parsed = parseLeadingTag(input);
      expect(parsed, input).not.toBeNull();
      expect(parsed!.tag, input).toBe(tag);
      expect(parsed!.route, input).toBe(route);
    }
  });

  it("keeps #sin working while leaving it off the picker", () => {
    // Right for the founder, wrong as a public category in a speaking product.
    expect(parseLeadingTag("#sin something")?.route).toBe("case");
    expect(pickerEntries().some((e) => e.tag === "sin")).toBe(false);
  });

  it("matches on the first token only, so '#lift me up' is not a win", () => {
    // Hashtags break at whitespace. This is exactly why the alias is the
    // single word #liftmeup.
    const parsed = parseLeadingTag("#lift me up");
    expect(parsed?.alias).toBe("lift");
    expect(parsed?.route).toBe("capture");
    expect(isLifeTagged("#lift me up")).toBe(false);
    expect(isLifeTagged("#liftmeup")).toBe(true);
  });

  it("treats an unknown tag as capture, not as an error", () => {
    // Every note lands regardless of tag. Capture never fails and never blocks.
    const parsed = parseLeadingTag("#groceries milk");
    expect(parsed?.route).toBe("capture");
    expect(parsed?.rest).toBe("milk");
  });

  it("is case-insensitive and strips the tag from the rest", () => {
    const parsed = parseLeadingTag("#MISTAKE  I rushed the pitch");
    expect(parsed?.tag).toBe("mistake");
    expect(parsed?.rest).toBe("I rushed the pitch");
  });

  it("handles a tag with no body", () => {
    expect(parseLeadingTag("#win")?.rest).toBe("");
  });
});

describe("pickerQuery", () => {
  it("opens on a bare # and on a partial tag", () => {
    expect(pickerQuery("#")).toBe("");
    expect(pickerQuery("#mi")).toBe("mi");
  });

  it("closes once the tag token is finished", () => {
    expect(pickerQuery("#mistake ")).toBeNull();
    expect(pickerQuery("#mistake I rushed it")).toBeNull();
  });

  it("ignores a # that is not the first token", () => {
    // Matching is first-token only, so offering a tag mid-message would offer
    // something that cannot route.
    expect(pickerQuery("note this #")).toBeNull();
  });
});

describe("filterPicker", () => {
  const entries = pickerEntries();

  it("returns everything for an empty query", () => {
    expect(filterPicker(entries, "")).toHaveLength(LIFE_TAGS.length);
  });

  it("prefers prefix matches", () => {
    expect(filterPicker(entries, "ed").map((e) => e.tag)).toEqual(["edit"]);
  });

  it("falls back to substring when no prefix matches", () => {
    expect(filterPicker(entries, "serv").map((e) => e.tag)).toEqual([
      "observation",
    ]);
  });
});

describe("applyPick", () => {
  it("replaces the in-progress token and leaves a trailing space", () => {
    expect(applyPick("#", "mistake")).toBe("#mistake ");
    expect(applyPick("#mi", "mistake")).toBe("#mistake ");
  });

  it("leaves anything that is not an in-progress tag alone", () => {
    expect(applyPick("already sent #mistake x", "win")).toBe(
      "already sent #mistake x"
    );
  });
});

describe("pickerEntries", () => {
  it("uses a server-supplied list when one is given, minus hidden entries", () => {
    const entries = pickerEntries([
      { tag: "#mistake", label: "a" },
      { tag: "sin", label: "b", hidden: true },
    ]);
    expect(entries).toEqual([{ tag: "mistake", label: "a" }]);
  });

  it("falls back to the local registry when the server sends none", () => {
    expect(pickerEntries(null).length).toBe(LIFE_TAGS.length);
    expect(pickerEntries([]).length).toBe(LIFE_TAGS.length);
  });
});
