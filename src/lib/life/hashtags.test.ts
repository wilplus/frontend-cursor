import { describe, expect, it } from "vitest";
import {
  applyPick,
  filterPicker,
  LIFE_TAGS,
  pickerEntries,
  pickerQuery,
} from "./hashtags";

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
