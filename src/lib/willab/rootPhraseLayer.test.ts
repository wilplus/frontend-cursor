import { describe, expect, it } from "vitest";
import {
  buildCommittedSlideRoots,
  buildRootPhraseLayer,
} from "./rootPhraseLayer";

describe("buildRootPhraseLayer", () => {
  it("preserves paragraph order and keeps one phrase per rooted paragraph", () => {
    expect(
      buildRootPhraseLayer([
        { key: "a", rootPhrase: "  Open with the decision  ", rootType: "flagship" },
        { key: "b", rootPhrase: "Then show the evidence", rootType: "neutral" },
        { key: "c", rootPhrase: null, rootType: "flagship" },
      ]),
    ).toEqual([
      { key: "a", text: "Open with the decision", type: "flagship" },
      { key: "b", text: "Then show the evidence", type: "neutral" },
    ]);
  });

  it("can exclude neutral rehearsal fallbacks when a presenter asks for it", () => {
    expect(
      buildRootPhraseLayer(
        [
          { key: 1, rootPhrase: "Accepted phrase", rootType: "flagship" },
          { key: 2, rootPhrase: "Generated cue", rootType: "neutral" },
        ],
        { includeNeutral: false },
      ),
    ).toEqual([
      { key: 1, text: "Accepted phrase", type: "flagship" },
    ]);
  });

  it("projects only explicitly accepted roots into a later recording", () => {
    expect(buildCommittedSlideRoots([
      { slideIndex: 0, rootPhrase: " Accepted phrase ", rootType: "flagship" },
      { slideIndex: 1, rootPhrase: "Generated fallback", rootType: "neutral" },
      { slideIndex: null, rootPhrase: "Unassigned", rootType: "flagship" },
    ])).toEqual([
      { slideIndex: 0, text: "Accepted phrase", type: "flagship" },
    ]);
  });
});
