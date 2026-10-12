import { describe, expect, it } from "vitest";
import {
  mapIdealText,
  mapRecordingRootsPayload,
} from "./idealText";

describe("mapIdealText", () => {

  it("the FE never mints a star the BE omitted (sole-gatekeeper rip, 2026-08-10)", () => {
    // inferHistoricalStars is DELETED: it inferred suggestion stars on
    // historical payloads, which made the FE itself an ungated intervention
    // source. A payload without a star renders without a star — only the
    // coach's verified star survives as an explicit field.
    const ideal = mapIdealText({
      text: "alpha beta gamma delta",
      key_moments: [
        {
          anchor: "alpha",
          snippet_id: "h1",
          take_session_id: "t1",
          suggestion: { kind: "replace", replacement: "x", why: "w" },
        },
        {
          anchor: "gamma",
          snippet_id: "h3",
          take_session_id: "t1",
          star: "verified",
        },
        { anchor: "delta", snippet_id: "h4", take_session_id: "t1" },
      ],
    });
    expect(ideal!.keyMoments.map((m) => m.star)).toEqual([
      null,
      "verified",
      null,
    ]);
  });
});

/* -------------------------------------------------------------------------- */
/*  FE-7 — the key-point tint. The rule that matters is VERIFY BEFORE TINTING:  */
/*  a stale offset that paints anyway accents words the coach never marked.     */
/* -------------------------------------------------------------------------- */

describe("recording roots payload", () => {

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
