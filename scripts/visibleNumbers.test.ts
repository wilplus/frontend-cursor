/**
 * AC-9 on a rendered page: the screenshot harness's number scan
 * (e2e/screenshots/visibleNumbers.mjs) fails any visible number on a speaker
 * or coach screen other than a count or a position. These tests pin what
 * counts as one.
 */
import { describe, expect, it } from "vitest";
import { forbiddenNumbers } from "../e2e/screenshots/visibleNumbers.mjs";

const matches = (text: string, allow: RegExp[] = []) =>
  forbiddenNumbers(text, allow).map((f) => f.match);

describe("counts and positions pass", () => {
  it.each([
    "Take 2",
    "AI-generated text · Take 2",
    "Take 2 · Slide 1 of 3",
    "Slide 3",
    "3 Takes",
    "1 Take",
    "12 words",
    "2 of 5",
    "Paragraph 4 of 9",
    "0:12",
    "12:34 / 25:00",
    "1:02:33",
    "Version 3.3",
    "v1.0",
    "2026-10-07",
    "Record Take 3",
    "Judge this moment 2 of 4",
    "Moment 1 of 4 · Judge this moment 0:02",
    "WillpowerLab 2026",
  ])("%s", (text) => {
    expect(matches(text)).toEqual([]);
  });
});

describe("scores, ratios and classifier numbers fail", () => {
  it.each([
    ["Confidence 72%", "72%"],
    ["72 percent confident", "72 percent"],
    ["Score: 8", "8"],
    ["8/10", "8"], // a slash is a ratio, never a position ("2 of 5" is one)
    ["0.83", "0.83"],
    ["Rating 4.5", "4.5"],
    ["Power 93", "93"],
  ])("%s", (text, expected) => {
    const found = matches(text);
    expect(found.length).toBeGreaterThan(0);
    expect(found[0]).toContain(expected);
  });

  it("a percentage fails even when a count is beside it", () => {
    expect(matches("3 Takes · 40%")).toEqual(["40%"]);
  });

  it("reports the words around the number", () => {
    const [hit] = forbiddenNumbers("Your confidence rose to 81 this week");
    expect(hit.match).toBe("81");
    expect(hit.context).toContain("confidence rose to 81");
  });
});

describe("a screen may widen the list for its own legitimate numbers", () => {
  it("accepts an extra form from the manifest entry", () => {
    expect(matches("at least 18 years old")).toEqual(["18"]);
    expect(matches("at least 18 years old", [/\b18 years\b/])).toEqual([]);
  });

  it("but never a percentage", () => {
    expect(matches("40%", [/40%/])).toEqual(["40%"]);
  });
});
