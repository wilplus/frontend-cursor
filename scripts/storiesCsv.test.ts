/*
GUARD    docs/TEST-STORIES.csv lists every frontend test file's story, and every test file has one.
CATCHES
  C1  a new or edited test whose STORY/GUARD header is missing, or not copied into the CSV
IF REMOVED  the founder reviews a stories file that silently stops matching the tests.
PROVES   C1 -> every test file has a story and the CSV is current
*/
import { describe, expect, it } from "vitest";
import { check } from "./stories-csv.mjs";

describe("docs/TEST-STORIES.csv", () => {
  it("every test file has a story and the CSV is current", () => {
    expect(check()).toEqual([]);
  });
});
