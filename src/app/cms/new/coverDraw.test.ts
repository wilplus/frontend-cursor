import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const DRAW = readFileSync("src/app/cms/new/CoverDraw.tsx", "utf8");
const CLIENT = readFileSync("src/app/cms/new/page.client.tsx", "utf8");
const STEPS = readFileSync("src/app/cms/new/LaneSteps.tsx", "utf8");
const SHELL = readFileSync("src/app/cms/new/LaneShell.tsx", "utf8");

describe("a drawn cover is never lost", () => {
  it("treats a dead connection as a live draw, not a failure", () => {
    expect(DRAW).toContain("UPSTREAM_TIMEOUT");
    expect(DRAW).toContain("adminListCoverImages");
    expect(DRAW).toContain("adminSelectCoverImage");
  });

  it("never asks the backend to skip the attach", () => {
    expect(DRAW).not.toContain("attach: false");
  });
});

describe("the description is the brief, not a steer", () => {
  it("draws fresh every time", () => {
    expect(DRAW).toContain("fresh: true");
  });

  it("caps the description where the backend caps it", () => {
    expect(DRAW).toContain("const MAX_NOTES = 500");
  });
});

describe("the box stays where it belongs", () => {
  it("is image-only", () => {
    expect(STEPS).toContain('draft.coverKind === "image" ? draw : null');
  });

  it("holds the step's CTA while a draw runs", () => {
    expect(CLIENT).toContain("const laneBusy = busy || uploading || drawing");
    expect(CLIENT).toContain("disabled={laneBusy}");
  });
});

describe("the lane chrome", () => {
  it("still closes from the top right", () => {
    expect(SHELL).toContain('aria-label="Close"');
  });

  it("gives the camera screen no Enter, and none mid-write", () => {
    expect(CLIENT).toContain("dark || laneBusy ? undefined : advance");
  });

  it("makes Enter the CTA itself rather than a copy of it", () => {
    // The build prompt spelled both call sites out separately. One value and
    // one call instead: two copies of "what Next does" is how Enter and the
    // button drift the next time a slow step is added.
    expect(CLIENT).toContain("onClick={advance}");
    expect(CLIENT).toContain(
      "const advance = () => (last ? void finish(true) : next())",
    );
  });
});
