import { describe, expect, it } from "vitest";
import { buildRootPhraseLayer } from "./rootPhraseLayer";

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

  it("can project accepted orange phrases only for the editable deck", () => {
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
});
