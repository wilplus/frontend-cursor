import { describe, expect, it } from "vitest";
import { mapInstantChunk, mapReadoutPayload } from "./readout";

/* The instant-view piece mapper (#190) + the persisted approval set (#199). */

describe("mapInstantChunk", () => {
  it("maps the piece shape (transcript or text) + its fields", () => {
    const c = mapInstantChunk({
      index: 2,
      transcript: "Good morning, everyone.",
      slide_index: 1,
      snippet_id: "n1",
      start_offset_ms: 1500,
      duration_ms: 4000,
      auto_comment: "Sounded steady.",
      user_edited_text: "Great morning, everyone.",
    });
    expect(c).toMatchObject({
      index: 2,
      text: "Good morning, everyone.",
      slideIndex: 1,
      snippetId: "n1",
      startOffsetMs: 1500,
      durationMs: 4000,
      autoComment: "Sounded steady.",
      userEditedText: "Great morning, everyone.",
    });
  });

  it("defaults absent optionals + requires a numeric index", () => {
    const c = mapInstantChunk({ index: 0, text: "hi" });
    expect(c).toMatchObject({
      text: "hi",
      slideIndex: null,
      snippetId: null,
      autoComment: null,
      userEditedText: null,
      appliedUpgradeIndexes: null,
      sayItStronger: null,
    });
    expect(mapInstantChunk({ text: "no index" })).toBeNull();
    expect(mapInstantChunk(null)).toBeNull();
  });
});

describe("mapInstantChunk — applied_upgrade_indexes (#199)", () => {
  it("keeps the approval set, INCLUDING an authoritative empty array", () => {
    // [] means "nothing approved" (authoritative) — distinct from null
    // ("older payload, no set known"), which is what gates the revert model.
    expect(
      mapInstantChunk({ index: 0, text: "t", applied_upgrade_indexes: [1, 0] })
        ?.appliedUpgradeIndexes
    ).toEqual([1, 0]); // order preserved — it IS the approval order
    expect(
      mapInstantChunk({ index: 0, text: "t", applied_upgrade_indexes: [] })
        ?.appliedUpgradeIndexes
    ).toEqual([]);
  });

  it("nulls the set when absent / not an array, and drops junk entries", () => {
    expect(
      mapInstantChunk({ index: 0, text: "t" })?.appliedUpgradeIndexes
    ).toBeNull();
    expect(
      mapInstantChunk({ index: 0, text: "t", applied_upgrade_indexes: "0,1" })
        ?.appliedUpgradeIndexes
    ).toBeNull();
    expect(
      mapInstantChunk({
        index: 0,
        text: "t",
        applied_upgrade_indexes: [0, "1", -2, 1.5, null, 3],
      })?.appliedUpgradeIndexes
    ).toEqual([0, 3]);
  });

  it("rides through the full payload mapper", () => {
    const p = mapReadoutPayload({
      instant_chunks: [
        { index: 0, text: "a", applied_upgrade_indexes: [2] },
        { index: 1, text: "b" },
      ],
    });
    expect(p.instantChunks.map((c) => c.appliedUpgradeIndexes)).toEqual([
      [2],
      null,
    ]);
  });
});
