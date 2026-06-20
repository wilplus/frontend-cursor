import { describe, expect, it } from "vitest";
import { decideReadoutBack } from "./readout";

describe("decideReadoutBack", () => {
  it("collapses the most recently opened moment on the current slide", () => {
    expect(decideReadoutBack(0, ["a", "b"], ["a", "b", "c"])).toEqual({
      type: "collapse",
      key: "b",
    });
  });

  it("ignores expanded moments that are not on the current slide", () => {
    // "x" was opened last but belongs to another slide; collapse "a" instead.
    expect(decideReadoutBack(2, ["a", "x"], ["a", "b"])).toEqual({
      type: "collapse",
      key: "a",
    });
  });

  it("pages back when nothing on the current slide is expanded and cursor > 0", () => {
    expect(decideReadoutBack(2, ["x"], ["a", "b"])).toEqual({ type: "page" });
    expect(decideReadoutBack(1, [], ["a"])).toEqual({ type: "page" });
  });

  it("closes only on the first slide with nothing expanded", () => {
    expect(decideReadoutBack(0, [], ["a", "b"])).toEqual({ type: "close" });
  });

  it("prefers collapse over paging even when cursor > 0", () => {
    expect(decideReadoutBack(3, ["a"], ["a"])).toEqual({
      type: "collapse",
      key: "a",
    });
  });
});
