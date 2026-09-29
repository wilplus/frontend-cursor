import { describe, expect, it } from "vitest";
import { parseRule } from "./adminRings";

describe("parseRule", () => {
  it("an empty editor is no rule", () => {
    expect(parseRule("")).toEqual({ rule: null, error: null });
    expect(parseRule("   ")).toEqual({ rule: null, error: null });
  });

  it("a rule is an object of lists, values kept as text", () => {
    expect(parseRule('{"region":["PL","DE"],"bucket":[0,7]}')).toEqual({
      rule: { region: ["PL", "DE"], bucket: ["0", "7"] },
      error: null,
    });
  });

  it("anything else is named, not guessed", () => {
    expect(parseRule('{"region":"PL"}').error).toBe('"region" must be a list');
    expect(parseRule("[1]").error).toBe("rule must be an object of lists");
    expect(parseRule("{oops").error).toBe("rule is not valid JSON");
  });
});
