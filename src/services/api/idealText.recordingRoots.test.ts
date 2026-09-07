import { describe, expect, it } from "vitest";
import { mapRecordingRootsPayload } from "./idealText";

describe("recording roots payload", () => {
  it("maps exact flagship roots", () => {
    expect(
      mapRecordingRootsPayload({
        document_snapshot_id: "snapshot-1",
        document_snapshot_sha256: "a".repeat(64),
        roots: [
          {
            part_id: "part-1",
            slide_index: 2,
            text: "the memorable phrase",
            type: "flagship",
          },
        ],
      }),
    ).toEqual({
      kind: "ready",
      documentSnapshotId: "snapshot-1",
      documentSnapshotSha256: "a".repeat(64),
      roots: [
        {
          partId: "part-1",
          slideIndex: 2,
          text: "the memorable phrase",
          type: "flagship",
        },
      ],
    });
  });

  it("rejects a root without exact Slide identity", () => {
    expect(
      mapRecordingRootsPayload({
        document_snapshot_id: "snapshot-1",
        document_snapshot_sha256: "a".repeat(64),
        roots: [
          { part_id: "part-1", slide_index: null, text: "phrase", type: "flagship" },
        ],
      }),
    ).toBeNull();
  });
});
